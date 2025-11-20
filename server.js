import express from "express";
import cors from "cors";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
// --- NEW: Import Firebase Admin SDK ---
import admin from "firebase-admin";
import https from "https";

// --- NEW: Setup for __dirname in ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- Environment Variables ---
const MONGODB_URI = process.env.MONGODB_URI;
// --- Firebase Admin Initialization using FIREBASE_ADMIN_KEY from .env ---
if (!process.env.FIREBASE_ADMIN_KEY) {
  console.error("❌ FIREBASE_ADMIN_KEY is not defined in .env");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
} catch (error) {
  console.error("❌ Failed to parse FIREBASE_ADMIN_KEY JSON:", error);
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("🔥 Firebase Admin SDK initialized via FIREBASE_ADMIN_KEY");
} catch (error) {
  console.error("❌ Firebase Admin SDK initialization error:", error);
  process.exit(1);
}

if (!MONGODB_URI) {
  console.error(
    "Error: MONGODB_URI is not defined. Please check your .env file."
  );
  process.exit(1);
}

// --- MongoDB Connection & Schemas ---
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Successfully connected to MongoDB."))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// --- User Schema ---
const UserSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true },
  displayName: { type: String },
  photoURL: { type: String },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model("User", UserSchema);

// --- Existing Chat Schemas ---
const AttachmentSchema = new mongoose.Schema(
  {
    name: String,
    text: String,
    type: String,
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema({
  role: { type: String, required: true },
  content: { type: String, required: true },
  attachment: { type: AttachmentSchema, required: false },
});

const ChatSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  chatId: { type: Number, required: true, index: true },
  title: { type: String, required: true },
  history: [MessageSchema],
  pinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
ChatSchema.index({ userId: 1, chatId: 1 }, { unique: true });

ChatSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Chat = mongoose.model("Chat", ChatSchema);

// --- Authentication Middleware ---
const optionalAuthToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const idToken = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
    } catch (error) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
};

const verifyAuthToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying auth token:", error);
    return res.status(403).json({ error: "Forbidden: Invalid token" });
  }
};

// --- User API Endpoints ---
app.post("/api/users/sync", verifyAuthToken, async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user;
    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $set: {
          email: email,
          displayName: name,
          photoURL: picture,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    console.error("Error syncing user:", err);
    res.status(500).json({ error: "Failed to sync user data" });
  }
});

// --- Chat Data API Endpoints ---
app.get("/api/chats", verifyAuthToken, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user.uid })
      .select("chatId title pinned updatedAt")
      .sort({ updatedAt: -1 });

    res.json(
      chats.map((chat) => ({
        id: chat.chatId,
        title: chat.title,
        pinned: chat.pinned,
        updatedAt: chat.updatedAt,
      }))
    );
  } catch (err) {
    console.error("Error fetching chats:", err);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

app.get("/api/chats/:id", verifyAuthToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const chat = await Chat.findOne({
      chatId: chatId,
      userId: req.user.uid,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found or access denied" });
    }

    res.json({
      id: chat.chatId,
      title: chat.title,
      history: chat.history,
      pinned: chat.pinned,
    });
  } catch (err) {
    console.error("Error fetching single chat:", err);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

app.post("/api/chats/save", verifyAuthToken, async (req, res) => {
  const { id, title, history, pinned } = req.body;

  if (!id || !title || !Array.isArray(history)) {
    return res.status(400).json({ error: "Missing required chat data" });
  }

  try {
    const update = {
      userId: req.user.uid,
      title,
      history,
      pinned: pinned !== undefined ? pinned : false,
    };
    const options = { new: true, upsert: true, setDefaultsOnInsert: true };
    const savedChat = await Chat.findOneAndUpdate(
      { chatId: id, userId: req.user.uid },
      update,
      options
    );
    res.json({ success: true, id: savedChat.chatId });
  } catch (err) {
    console.error("Error saving chat:", err);
    res.status(500).json({ error: "Failed to save chat" });
  }
});

app.delete("/api/chats/:id", verifyAuthToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const result = await Chat.deleteOne({
      chatId: chatId,
      userId: req.user.uid,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Chat not found or access denied" });
    }
    res.json({ success: true, message: "Chat deleted" });
  } catch (err) {
    console.error("Error deleting chat:", err);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

app.delete("/api/chats", verifyAuthToken, async (req, res) => {
  try {
    const result = await Chat.deleteMany({
      userId: req.user.uid,
    });
    res.json({
      success: true,
      message: "All history deleted",
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("Error deleting all chats:", err);
    res.status(500).json({ error: "Failed to delete history" });
  }
});

// --- Web Search Helper Function ---
async function performWebSearch(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    console.log("❌ Keys missing! Aborting search.");
    return null;
  }

  // --- UPDATED LOGIC: Boost YouTube results for learning queries ---
  let finalQuery = query;
  let isVideoMode = false; // <--- NEW: Flag to track if we are in video mode

  if (query.toLowerCase().match(/(tutorial|learning|guide|course|how to)/)) {
    finalQuery += " youtube";
    isVideoMode = true; // <--- Set flag
    console.log(
      `🎥 Educational query detected. Adding 'youtube' to search: "${finalQuery}"`
    );
  }
  // ----------------------------------------------------------------

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(
      finalQuery
    )}&num=6&gl=in`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.items || data.items.length === 0) return null;

    let markdownOutput = "### 🌐 Real-Time Web Results\n\n";

    data.items.forEach((item) => {
      const title = item.title || "No Title";
      const link = item.link;
      const snippet = item.snippet || "";

      let imageUrl = "";
      if (item.pagemap) {
        if (item.pagemap.cse_image?.length > 0) {
          imageUrl = item.pagemap.cse_image[0].src;
        } else if (item.pagemap.metatags?.[0]?.["og:image"]) {
          imageUrl = item.pagemap.metatags[0]["og:image"];
        }
      }

      const isVideo = link.includes("youtube.com") || link.includes("youtu.be");

      markdownOutput += `### [${title}](${link})\n`;

      if (isVideo) {
        markdownOutput += `**▶ Watch Video:** ${link}\n\n`;
      } else if (imageUrl && !isVideoMode) {
        // --- FIX: SUPPRESS IMAGES IN VIDEO MODE ---
        // If we are in "Video Mode" (isVideoMode = true), we intentionally SKIP adding the static image.
        // This prevents duplicate thumbnails appearing alongside the video players.
        markdownOutput += `![Image](${imageUrl})\n`;
      }

      markdownOutput += `> ${snippet}\n\n`;
      markdownOutput += `---\n`;
    });

    return markdownOutput;
  } catch (error) {
    console.error("Web search error:", error);
    return null;
  }
}

// --- MAIN GENERATION ENDPOINT ---
app.post("/api/generate", optionalAuthToken, async (req, res) => {
  // 1. Get the original flag from the user (usually 'false' if button is off)
  let { prompt, systemMessage, history, model, max_tokens, webSearch } =
    req.body;

  // 2. Define "Trigger Keywords" to FORCE Deep Research
  const complexKeywords = [
    "roadmap",
    "tutorial",
    "code",
    "generate",
    "write",
    "essay",
    "script",
    "plan",
    "difference",
    "explain",
    "how to",
    "list",
    "summary",
    "guide",
    "best practice",
    "what is", // Auto-trigger for "what is ai"
    "who is", // Auto-trigger for "who is..."
    "price", // Auto-trigger for shopping/pricing
    "vs", // Auto-trigger for comparisons
    "latest", // Auto-trigger for news
    "current", // Auto-trigger for updates
    "news",
  ];

  // 3. Check if prompt contains any keywords
  const hasTriggerKeyword = complexKeywords.some((keyword) =>
    prompt.toLowerCase().includes(keyword)
  );

  // 4. AUTO-TRIGGER: Force Search ON if keyword found
  if (hasTriggerKeyword) {
    webSearch = true;
    console.log(
      `⚡ Auto-Trigger: Keyword detected in "${prompt}". Forcing Web Search ON.`
    );
  }

  // 5. Determine Deep Research Mode
  const isDeepResearchNeeded = hasTriggerKeyword;

  let finalSystemMessage = systemMessage || "You are a helpful AI.";
  let searchResults = null;

  // --- WEB SEARCH LOGIC ---
  if (webSearch) {
    console.log(
      `🔎 Web Search ON. Query: "${prompt}" | Deep Mode: ${isDeepResearchNeeded}`
    );

    searchResults = await performWebSearch(prompt);

    if (searchResults) {
      // SCENARIO A: Direct Mode (Simple Query)
      if (!isDeepResearchNeeded) {
        console.log(
          "🚀 Fast Path: Returning Search Results directly (Skipping AI)."
        );
        return res.json({ text: searchResults });
      }

      // SCENARIO B: Deep Mode (Complex Query)
      console.log("🧠 Deep Path: Synthesizing results with AI.");

      finalSystemMessage += `\n\nINSTRUCTIONS: You have access to the following real-time search results.
      
      ${searchResults}
      
      IMPORTANT REQUEST:
      1. Answer the user's question comprehensively using this information.
      2. **INTEGRATE IMAGES & VIDEOS**: Do not list the search results at the end. Instead, pick the most relevant images/videos from the results and EMBED them directly into your response using Markdown (e.g., ![Image Title](url)).
      3. Place the images naturally near the text they illustrate.
      4. Use the exact URLs provided in the search results.
      `;
    } else {
      console.log("❌ Search returned no data. Falling back to standard AI.");
    }
  }

  // --- STANDARD AI GENERATION ---
  let messages = [{ role: "system", content: finalSystemMessage }];

  if (history && Array.isArray(history)) {
    messages = messages.concat(history);
  }

  if (prompt) {
    messages.push({ role: "user", content: prompt });
  } else {
    return res.status(400).json({ error: "No prompt provided" });
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
        body: JSON.stringify({
          model: model || process.env.MODEL,
          messages: messages,
          ...(max_tokens && { max_tokens: parseInt(max_tokens, 10) }),
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Groq API error:", data);
      return res.status(response.status).json({ error: data });
    }

    const reply = data.choices?.[0]?.message?.content;
    if (!reply) {
      return res.status(500).json({ error: "No reply from model" });
    }

    // --- CHANGED: WE NO LONGER FORCE APPEND AT THE END ---
    let finalResponse = reply;

    res.json({ text: finalResponse });
  } catch (err) {
    console.error("Server-side fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Internal Self-Ping Logic ---
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
const PING_INTERVAL_MS = 14 * 60 * 1000;

if (RENDER_URL) {
  setInterval(() => {
    try {
      https
        .get(RENDER_URL, (res) => {
          if (res.statusCode === 200) {
            console.log(
              `[Self-Ping] Successful. Status: ${res.statusCode}. Server remains awake.`
            );
          } else {
            console.log(
              `[Self-Ping] Received status: ${res.statusCode}. Server remains awake.`
            );
          }
        })
        .on("error", (err) => {
          console.error("[Self-Ping] Error:", err.message);
        });
    } catch (error) {
      console.error("[Self-Ping] Error initiating ping:", error);
    }
  }, PING_INTERVAL_MS);
  console.log(
    `✅ Self-Ping job scheduled to run every 14 minutes on ${RENDER_URL}`
  );
} else {
  console.log("⚠️ Self-Ping skipped: RENDER_EXTERNAL_URL not found.");
}

app.listen(port, () => {
  console.log(
    `LYNQ AI app (frontend and backend) listening on http://localhost:${port}`
  );
});
