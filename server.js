import express from "express";
import cors from "cors";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import mongoose from "mongoose";
// --- NEW: Import Firebase Admin SDK ---
import admin from "firebase-admin";
import * as cheerio from "cheerio";
import https from "https";

// --- NEW: Setup for __dirname in ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Load System Prompt from config file ---
const systemPromptPath = path.join(__dirname, "config", "systemprompt.txt");
let DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";
try {
  DEFAULT_SYSTEM_PROMPT = fs.readFileSync(systemPromptPath, "utf-8");
  console.log("✅ System prompt loaded from config/systemprompt.txt");
} catch (err) {
  console.warn("⚠️ Could not load systemprompt.txt, using default prompt.");
}

// --- Load Canvas Prompt from config file ---
const canvasPromptPath = path.join(__dirname, "config", "canvasprompt.txt");
let CANVAS_SYSTEM_PROMPT = "";
try {
  CANVAS_SYSTEM_PROMPT = fs.readFileSync(canvasPromptPath, "utf-8");
  console.log("✅ Canvas prompt loaded from config/canvasprompt.txt");
  CANVAS_SYSTEM_PROMPT = fs.readFileSync(canvasPromptPath, "utf-8");
  console.log("✅ Canvas prompt loaded from config/canvasprompt.txt");
} catch (err) {
  console.warn("⚠️ Could not load canvasprompt.txt, canvas mode will use default.");
}

// --- Load Tool Prompts from config file ---
const toolPromptsPath = path.join(__dirname, "config", "tool_prompts.json");
let TOOL_PROMPTS = {};
try {
  const data = fs.readFileSync(toolPromptsPath, "utf-8");
  TOOL_PROMPTS = JSON.parse(data);
  console.log(`✅ Loaded ${Object.keys(TOOL_PROMPTS).length} tool prompts from config/tool_prompts.json`);
} catch (err) {
  console.warn("⚠️ Could not load tool_prompts.json, tool specific prompts will not work.", err.message);
}

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

// --- Scrape URL Helper Function ---
async function scrapeUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $("script, style, nav, footer, iframe, noscript").remove();

    // Extract main text
    let text = $("body").text();
    text = text.replace(/\s+/g, " ").trim();

    // Limit length
    return text.substring(0, 1500); // Return first 1500 chars
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return null;
  }
}

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


    // --- DEEP RESEARCH MODE: Scrape top 2 results ---
    console.log("🕵️ Deep Research: Scraping top 2 results...");
    const topResults = data.items.slice(0, 2);
    const scrapePromises = topResults.map((item) => scrapeUrl(item.link));
    const scrapedContents = await Promise.all(scrapePromises);

    markdownOutput += `\n### 🕵️ Deep Research Insights\n\n`;

    topResults.forEach((item, index) => {
      const content = scrapedContents[index];
      if (content) {
        markdownOutput += `#### Extracted from [${item.title}](${item.link}):\n`;
        markdownOutput += `> "${content}..."\n\n`;
      }
    });

    return markdownOutput;
  } catch (error) {
    console.error("Web search error:", error);
    return null;
  }
}

// --- MAIN GENERATION ENDPOINT ---
app.post("/api/generate", optionalAuthToken, async (req, res) => {
  // Get request parameters
  let { prompt, systemMessage, history, model, max_tokens, webSearch, canvasMode, toolId } =
    req.body;

  // Determine the system message based on mode
  let finalSystemMessage;
  if (canvasMode && CANVAS_SYSTEM_PROMPT) {
    // Use canvas-specific prompt when canvas mode is active
    finalSystemMessage = CANVAS_SYSTEM_PROMPT;
    console.log("🎨 Canvas Mode: Using canvasprompt.txt");
  } else {
    finalSystemMessage = systemMessage || DEFAULT_SYSTEM_PROMPT;
  }

  // --- TOOL PROMPT INJECTION ---
  if (toolId && TOOL_PROMPTS[toolId]) {
    console.log(`🔧 Injecting system prompt for tool: ${toolId}`);
    // Append the tool prompt to the system message
    finalSystemMessage += `\n\nSYSTEM_INSTRUCTION:\n${TOOL_PROMPTS[toolId]}`;
  }

  let searchResults = null;

  // --- WEB SEARCH LOGIC ---
  // Only perform web search if user explicitly enabled it via toggle
  if (webSearch) {
    console.log(`🔎 Web Search ON. Query: "${prompt}"`);

    searchResults = await performWebSearch(prompt);

    if (searchResults) {
      // Always combine search results with AI for better response
      console.log("🧠 Combining web search results with AI response.");

      finalSystemMessage += `\n\n🌐 WEB SEARCH MODE ACTIVE - INSTRUCTIONS:

You have access to the following REAL-TIME search results from Google:

${searchResults}

⚠️ CRITICAL REQUIREMENTS - YOU MUST FOLLOW THESE:

1.  **VISUALS FIRST (HORIZONTAL SCROLL):**
    - You MUST start your response with a horizontal image row if images are available.
    - Use EXACTLY this HTML structure for the images:
    
    \`\`\`html
    <div class="image-carousel"><div class="image-card"><img src="URL" alt="desc"><p class="caption">Text</p></div><div class="image-card"><img src="URL2" alt="desc2"><p class="caption">Text2</p></div></div>
    \`\`\`
    
    - Do NOT use standard Markdown image syntax (e.g. ![alt](url)).
    - OUTPUT AS RAW HTML. Do not put backticks around the HTML in your final response.
    - Put ALL relevant images into this single carousel at the very top.


2.  **INTENT-AWARE RESPONSE:**
    - **FOR PRODUCTS (e.g., iPhone 17):** Focus on Specs, Price, Release Date, Leaks. Do NOT give generic definitions.
    - **FOR TUTORIALS:** Focus on Steps and "How-To".
    - **FOR CONCEPTS:** Focus on Definitions and Explanations.
    - **FOR NEWS:** Focus on "What happened", "When", and "Why".

3.  **DEEP RESEARCH SYNTHESIS:**
    - Use the "Deep Research Insights" provided above.
    - Quote specific facts, numbers, or code snippets from the scraped content.
    - Cite sources using [Title](url) format.

4.  **VIDEOS & MEDIA:**
    - Provide video links as: **▶ Watch:** [Video Title](youtube_url)

5.  **RESPONSE STRUCTURE:**
    - **Top:** \`<div class="image-carousel">...</div>\`
    - **Middle:** Intent-Specific Answer (synthesized from search + scraped content).
    - **Bottom:** Sources / Useful Links.

REMEMBER: Adapt your answer to the USER'S INTENT. Do not lecture the user if they ask for specs.

⚠️ IMPORTANT: Do NOT call any tools or functions. The web search has already been performed for you. Simply use the search results provided above to craft your response.
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
    // Build request body
    const requestBody = {
      model: model || process.env.MODEL,
      messages: messages,
      ...(max_tokens && { max_tokens: parseInt(max_tokens, 10) }),
    };

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Groq API error:", data);

      // Handle specific Groq tool_use_failed error
      if (data?.error?.code === "tool_use_failed") {
        console.warn("⚠️ Model tried to use tools. Returning search results as fallback.");
        // If we have search results, return them directly as the response
        if (searchResults) {
          return res.json({
            text: `Here's what I found:\n\n${searchResults}\n\n*Note: The AI model encountered an issue. Showing raw search results instead.*`
          });
        }
      }

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
