import express from "express";
import cors from "cors";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
// --- NEW: Import Firebase Admin SDK ---
import admin from "firebase-admin";

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

// --- NEW: User Schema ---
// This links our Mongoose DB to Firebase Auth
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
  // --- NEW: Link to the User's *Firebase UID* ---
  userId: { type: String, required: true, index: true },
  chatId: { type: Number, required: true, index: true }, // Keep frontend ID
  title: { type: String, required: true },
  history: [MessageSchema],
  pinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
// Create a compound index for efficient user-specific chat lookups
ChatSchema.index({ userId: 1, chatId: 1 }, { unique: true });

ChatSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Chat = mongoose.model("Chat", ChatSchema);

// --- NEW: Optional Authentication Middleware ---
/**
 * Tries to verify a Firebase Auth token.
 * If valid, attaches user to `req.user`.
 * If invalid or missing, sets `req.user = null` and continues.
 */
const optionalAuthToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const idToken = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken; // Add user info
    } catch (error) {
      // Token is invalid, expired, or something else. Treat as guest.
      req.user = null;
    }
  } else {
    // No token provided. Treat as guest.
    req.user = null;
  }
  next(); // Continue to the endpoint
};

// --- NEW: Authentication Middleware ---
/**
 * Verifies the Firebase Auth token sent from the client.
 * If valid, attaches the decoded user token to `req.user`.
 */
const verifyAuthToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Add user info (uid, email, etc.) to the request
    next();
  } catch (error) {
    console.error("Error verifying auth token:", error);
    return res.status(403).json({ error: "Forbidden: Invalid token" });
  }
};

// --- NEW: User API Endpoints ---

/**
 * POST /api/users/sync
 * Called by the client (auth.js) after a successful login/signup.
 * Creates or updates the user's profile in our Mongoose DB.
 */
app.post("/api/users/sync", verifyAuthToken, async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user; // Get info from the *verified token*

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $set: {
          email: email,
          displayName: name,
          photoURL: picture,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true } // Create if not exist
    );

    res.json({ success: true, user });
  } catch (err) {
    console.error("Error syncing user:", err);
    res.status(500).json({ error: "Failed to sync user data" });
  }
});

// --- SECURED: Chat Data API Endpoints ---
// All these routes now require a valid token and are user-specific.

// GET: Load all recent chats for the *authenticated user*
app.get("/api/chats", verifyAuthToken, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user.uid }) // Filter by user ID
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

// GET: Load a single chat, ensuring it belongs to the *authenticated user*
app.get("/api/chats/:id", verifyAuthToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const chat = await Chat.findOne({
      chatId: chatId,
      userId: req.user.uid, // Ensure user ownership
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

// POST or PUT: Save/Update a chat for the *authenticated user*
app.post("/api/chats/save", verifyAuthToken, async (req, res) => {
  const { id, title, history, pinned } = req.body;

  if (!id || !title || !Array.isArray(history)) {
    return res.status(400).json({ error: "Missing required chat data" });
  }

  try {
    const update = {
      userId: req.user.uid, // Ensure userId is set
      title,
      history,
      pinned: pinned !== undefined ? pinned : false,
    };

    const options = {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    };

    // Find by compound key: chatId AND userId
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

// DELETE: Delete a chat, ensuring it belongs to the *authenticated user*
app.delete("/api/chats/:id", verifyAuthToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const result = await Chat.deleteOne({
      chatId: chatId,
      userId: req.user.uid, // Ensure user ownership
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

// --- NEW: Web Search Helper Function ---
// server.js

// --- NEW: Brave Search Helper Function ---
// server.js

// --- NEW: Google Search Helper Function ---
// server.js

// --- UPDATED: Universal India-First Search ---
async function performWebSearch(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    console.warn("Google Search Keys missing.");
    return null;
  }

  try {
    // 1. Request A: Web Search (India Priority via &gl=in)
    // We DO NOT use 'cr=countryIN' so it can still find global info if needed.
    const webUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=4&gl=in`;
    
    // 2. Request B: Image Search (India Priority via &gl=in)
    const imgUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=4&searchType=image&gl=in`;

    // Run parallel requests
    const [webRes, imgRes] = await Promise.all([
      fetch(webUrl),
      fetch(imgUrl)
    ]);

    const webData = await webRes.json();
    const imgData = await imgRes.json();

    // Format results
    let contextString = "\n\n--- REAL-TIME SEARCH RESULTS (India Priority) ---\n";

    // A. Text Results (General Info)
    if (webData.items && webData.items.length > 0) {
      webData.items.forEach((item, index) => {
        contextString += `Source [${index + 1}]: ${item.title}\nURL: ${item.link}\nSummary: ${item.snippet}\n\n`;
      });
    }

    // B. Image Results (Generic - Works for Products, News, Diagrams, etc.)
    contextString += "--- RELEVANT IMAGES (Embed these using ![Alt](url)) ---\n";
    
    if (imgData.items && imgData.items.length > 0) {
      imgData.items.forEach((item, index) => {
        // Google Image Search returns direct image links
        contextString += `Image [${index + 1}]: ${item.link}\n`;
      });
    } else {
      contextString += "No images found.\n";
    }

    contextString += "--- END SEARCH RESULTS ---\n\n";
    return contextString;

  } catch (error) {
    console.error("Web search error:", error);
    return null;
  }
}

// --- Existing Groq API Endpoint (NOW PUBLIC, OPTIONALLY AUTHED) ---
// Only authenticated users can access the AI
app.post("/api/generate", optionalAuthToken, async (req, res) => {
  const { prompt, systemMessage, history, model, max_tokens, webSearch } =
    req.body; // Added webSearch flag

  let messages = [];
  let finalSystemMessage = systemMessage || "You are a helpful AI.";

  // --- STEP 1: THE CHAIN (Web Search) ---
  // --- STEP 1: THE CHAIN (Web Search) ---
  // --- STEP 1: THE CHAIN (Web Search) ---
  if (webSearch) {
    console.log("Performing Web Search for:", prompt);
    const searchContext = await performWebSearch(prompt);

    if (searchContext) {
      finalSystemMessage += `\n\nINSTRUCTIONS: You have access to the following real-time search results. 
    Use them to answer the user query.

    REQUIRED OUTPUT RULES:
    1. ALWAYS include helpful images and links from search results (even if user didn't ask).
    2. IMAGE RULES:
       - If any result contains an image URL, embed it using Markdown:
         ![Image](URL)
       - Include multiple images if relevant.
    3. VIDEO RULES:
       - If results contain a YouTube URL (youtube.com or youtu.be), include it as:
         **▶ Watch Video:** [Title](URL)
       - Include multiple useful videos if relevant.
    4. WEB LINKS:
       - Provide clickable reference links to top useful pages:
         - **Source:** [Title](URL)
    5. Provide short descriptions for images & videos (why they're useful).
    6. Cite written info as [Source 1], [Source 2], etc.

    ${searchContext}`;
    }
  }

  // --- STEP 2: Construct Messages ---
  messages.push({ role: "system", content: finalSystemMessage });

  if (history && Array.isArray(history)) {
    messages = messages.concat(history);
  }

  if (prompt) {
    messages.push({ role: "user", content: prompt });
  } else {
    return res.status(400).json({ error: "No prompt provided" });
  }

  // --- STEP 3: Call AI (Groq) ---
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
    res.json({ text: reply });
  } catch (err) {
    console.error("Server-side fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});
// DELETE: Delete ALL chats for the authenticated user
app.delete("/api/chats", verifyAuthToken, async (req, res) => {
  try {
    const result = await Chat.deleteMany({
      userId: req.user.uid, // Ensure we only delete the requesting user's chats
    });

    res.json({ 
      success: true, 
      message: "All history deleted", 
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error("Error deleting all chats:", err);
    res.status(500).json({ error: "Failed to delete history" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(
    `LYNQ AI app (frontend and backend) listening on http://localhost:${port}`
  );
});
