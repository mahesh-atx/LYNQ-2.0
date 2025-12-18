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
app.use(express.json({ limit: "50mb" }));
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

// --- Load Canvas Prompts from config files (Web & Doc Modes) ---
const canvasWebPromptPath = path.join(__dirname, "config", "canvas_web_prompt.txt");
const canvasDocPromptPath = path.join(__dirname, "config", "canvas_doc_prompt.txt");
let CANVAS_WEB_PROMPT = "";
let CANVAS_DOC_PROMPT = "";

try {
  CANVAS_WEB_PROMPT = fs.readFileSync(canvasWebPromptPath, "utf-8");
  console.log("✅ Canvas WEB prompt loaded from config/canvas_web_prompt.txt");
} catch (err) {
  console.warn("⚠️ Could not load canvas_web_prompt.txt, using fallback.");
  CANVAS_WEB_PROMPT = "You are an expert web developer. Output HTML/CSS/JS applications.";
}

try {
  CANVAS_DOC_PROMPT = fs.readFileSync(canvasDocPromptPath, "utf-8");
  console.log("✅ Canvas DOC prompt loaded from config/canvas_doc_prompt.txt");
} catch (err) {
  console.warn("⚠️ Could not load canvas_doc_prompt.txt, doc mode will be limited.");
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

// --- Load Models Config ---
const modelsConfigPath = path.join(__dirname, "config", "models.json");
let AVAILABLE_MODELS = [];
try {
  const data = fs.readFileSync(modelsConfigPath, "utf-8");
  AVAILABLE_MODELS = JSON.parse(data);
  console.log(`✅ Loaded ${AVAILABLE_MODELS.length} models from config/models.json`);
} catch (err) {
  console.warn("⚠️ Could not load models.json, using defaults.");
  // Fallback defaults
  AVAILABLE_MODELS = [
     { id: "openai/gpt-oss-120b", name: "gpt-oss-120b", provider: "groq" }
  ];
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

    // ... (rest of search/scrape code)
// --- Models API Endpoint ---
app.get("/api/models", (req, res) => {
  res.json(AVAILABLE_MODELS);
});

// ============================================
// WEB SEARCH ENHANCEMENT SYSTEM
// ============================================

// --- SEARCH CACHE (5-minute TTL) ---
const searchCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// --- RATE LIMITER (Protect API Quota) ---
const rateLimiter = {
  requests: [],
  maxRequestsPerMinute: 10,
  maxRequestsPerDay: 100,
  dailyCount: 0,
  lastDayReset: Date.now(),

  canMakeRequest() {
    const now = Date.now();
    
    // Reset daily counter at midnight
    if (now - this.lastDayReset > 24 * 60 * 60 * 1000) {
      this.dailyCount = 0;
      this.lastDayReset = now;
      console.log("📅 Daily rate limit reset");
    }

    // Check daily limit
    if (this.dailyCount >= this.maxRequestsPerDay) {
      console.warn("⚠️ Daily API quota exhausted (100/day)");
      return false;
    }

    // Clean old requests (older than 1 minute)
    this.requests = this.requests.filter(time => now - time < 60000);

    // Check per-minute limit
    if (this.requests.length >= this.maxRequestsPerMinute) {
      console.warn("⚠️ Rate limit: Too many requests per minute");
      return false;
    }

    return true;
  },

  recordRequest() {
    this.requests.push(Date.now());
    this.dailyCount++;
    console.log(`📊 API Usage: ${this.dailyCount}/${this.maxRequestsPerDay} daily, ${this.requests.length}/${this.maxRequestsPerMinute} per minute`);
  }
};

// --- SOURCE AUTHORITY SCORING ---
const SOURCE_AUTHORITY = {
  // Highest authority (score: 100)
  highAuthority: ['.gov', '.edu', 'wikipedia.org', 'britannica.com'],
  // High authority (score: 80)
  techAuthority: ['github.com', 'stackoverflow.com', 'developer.mozilla.org', 'docs.microsoft.com', 'cloud.google.com', 'aws.amazon.com'],
  // News authority (score: 70)
  newsAuthority: ['reuters.com', 'bbc.com', 'nytimes.com', 'theguardian.com', 'techcrunch.com', 'theverge.com', 'wired.com', 'arstechnica.com'],
  // Medium authority (score: 50)
  mediumAuthority: ['medium.com', 'dev.to', 'freecodecamp.org', 'geeksforgeeks.org', 'tutorialspoint.com']
};

function getSourceAuthorityScore(url) {
  const urlLower = url.toLowerCase();
  
  for (const domain of SOURCE_AUTHORITY.highAuthority) {
    if (urlLower.includes(domain)) return { score: 100, tier: '🏛️ Official' };
  }
  for (const domain of SOURCE_AUTHORITY.techAuthority) {
    if (urlLower.includes(domain)) return { score: 80, tier: '💻 Tech Authority' };
  }
  for (const domain of SOURCE_AUTHORITY.newsAuthority) {
    if (urlLower.includes(domain)) return { score: 70, tier: '📰 News' };
  }
  for (const domain of SOURCE_AUTHORITY.mediumAuthority) {
    if (urlLower.includes(domain)) return { score: 50, tier: '📝 Community' };
  }
  
  return { score: 30, tier: '🌐 Web' };
}

// --- ENHANCED SCRAPE FUNCTION ---
async function scrapeUrl(url, options = {}) {
  const { maxLength = 3500, timeout = 8000 } = options;
  
  // Skip video URLs (can't scrape)
  if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com')) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`⚠️ Scrape failed for ${url}: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements (expanded list)
    $("script, style, nav, footer, iframe, noscript, aside, .sidebar, .advertisement, .ad, .ads, .cookie-banner, .popup, .modal, header, .nav, .menu, .comments, .related-posts").remove();

    // Try to extract main content first (more relevant text)
    let text = "";
    const mainSelectors = ['article', 'main', '.content', '.post-content', '.article-body', '.entry-content', '#content', '.main-content'];
    
    for (const selector of mainSelectors) {
      const mainContent = $(selector).text();
      if (mainContent && mainContent.length > 200) {
        text = mainContent;
        break;
      }
    }

    // Fallback to body if no main content found
    if (!text || text.length < 200) {
      text = $("body").text();
    }

    // Clean up whitespace
    text = text.replace(/\s+/g, " ").trim();

    // Extract metadata for context
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const pageTitle = $('title').text() || '';

    // Combine metadata with content
    let enrichedContent = '';
    if (metaDescription) {
      enrichedContent += `Summary: ${metaDescription}\n\n`;
    }
    enrichedContent += text.substring(0, maxLength);

    console.log(`✅ Scraped ${url.substring(0, 50)}... (${enrichedContent.length} chars)`);
    return enrichedContent;

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`⏱️ Scrape timeout for ${url}`);
    } else {
      console.error(`❌ Scrape error for ${url}:`, error.message);
    }
    return null;
  }
}

// --- CACHE HELPER FUNCTIONS ---
function getCacheKey(query) {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

function getCachedResult(query) {
  const key = getCacheKey(query);
  const cached = searchCache.get(key);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    console.log(`📦 Cache HIT for: "${query.substring(0, 30)}..."`);
    return cached.data;
  }
  
  if (cached) {
    searchCache.delete(key); // Clean expired cache
  }
  
  return null;
}

function setCachedResult(query, data) {
  const key = getCacheKey(query);
  searchCache.set(key, { data, timestamp: Date.now() });
  
  // Limit cache size (max 50 entries)
  if (searchCache.size > 50) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }
  
  console.log(`💾 Cached result for: "${query.substring(0, 30)}..." (cache size: ${searchCache.size})`);
}

// --- ENHANCED WEB SEARCH FUNCTION ---
async function performWebSearch(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    console.log("❌ Google Search API keys missing! Aborting search.");
    return null;
  }

  // Check cache first
  const cachedResult = getCachedResult(query);
  if (cachedResult) {
    return cachedResult;
  }

  // Check rate limits
  if (!rateLimiter.canMakeRequest()) {
    console.log("⚠️ Rate limited - returning cached or null");
    return null;
  }

  // --- QUERY ENHANCEMENT ---
  let finalQuery = query;
  let isVideoMode = false;
  let queryIntent = 'general';

  // Detect query intent for better handling
  const queryLower = query.toLowerCase();
  
  if (queryLower.match(/(tutorial|learning|guide|course|how to|learn)/)) {
    finalQuery += " youtube";
    isVideoMode = true;
    queryIntent = 'educational';
    console.log(`🎥 Educational query detected: "${finalQuery}"`);
  } else if (queryLower.match(/(news|latest|today|breaking|update)/)) {
    queryIntent = 'news';
    console.log(`📰 News query detected: "${query}"`);
  } else if (queryLower.match(/(buy|price|review|best|vs|comparison|deal)/)) {
    queryIntent = 'shopping';
    console.log(`🛒 Shopping/comparison query detected: "${query}"`);
  } else if (queryLower.match(/(code|programming|developer|api|library|framework)/)) {
    queryIntent = 'technical';
    console.log(`💻 Technical query detected: "${query}"`);
  }

  try {
    // Record API request
    rateLimiter.recordRequest();
    
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(
      finalQuery
    )}&num=8&gl=in&safe=active`;

    console.log(`🔎 Searching: "${finalQuery}"`);
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.error) {
      console.error("❌ Google API Error:", data.error.message);
      return null;
    }

    if (!data.items || data.items.length === 0) {
      console.log("❌ No search results found");
      return null;
    }

    // --- SCORE AND SORT RESULTS BY AUTHORITY ---
    const scoredResults = data.items.map(item => ({
      ...item,
      authorityInfo: getSourceAuthorityScore(item.link)
    })).sort((a, b) => b.authorityInfo.score - a.authorityInfo.score);

    // --- BUILD IMAGE CAROUSEL DATA ---
    const images = [];
    scoredResults.forEach((item) => {
      if (item.pagemap) {
        let imageUrl = null;
        let imageAlt = item.title || 'Image';
        
        // Try multiple image sources
        if (item.pagemap.cse_image?.length > 0) {
          imageUrl = item.pagemap.cse_image[0].src;
        } else if (item.pagemap.metatags?.[0]?.["og:image"]) {
          imageUrl = item.pagemap.metatags[0]["og:image"];
        } else if (item.pagemap.cse_thumbnail?.length > 0) {
          imageUrl = item.pagemap.cse_thumbnail[0].src;
        }

        // Get better alt text from og:title or page title
        if (item.pagemap.metatags?.[0]?.["og:title"]) {
          imageAlt = item.pagemap.metatags[0]["og:title"];
        }

        if (imageUrl && !imageUrl.includes('placeholder') && images.length < 6) {
          images.push({ url: imageUrl, alt: imageAlt, source: item.link });
        }
      }
    });

    // --- BUILD MARKDOWN OUTPUT ---
    let markdownOutput = "";

    // Add images section (for non-video queries)
    if (images.length > 0 && !isVideoMode) {
      markdownOutput += "### 🖼️ Related Images\n\n";
      markdownOutput += `**IMAGE_CAROUSEL_DATA:** ${JSON.stringify(images)}\n\n`;
    }

    markdownOutput += "### 🌐 Web Results (Sorted by Authority)\n\n";

    scoredResults.slice(0, 6).forEach((item, index) => {
      const title = item.title || "No Title";
      const link = item.link;
      const snippet = item.snippet || "";
      const isVideo = link.includes("youtube.com") || link.includes("youtu.be");
      const authorityBadge = item.authorityInfo.tier;

      markdownOutput += `#### ${index + 1}. [${title}](${link})\n`;
      markdownOutput += `${authorityBadge} | Score: ${item.authorityInfo.score}/100\n\n`;

      if (isVideo) {
        markdownOutput += `**▶ Watch Video:** ${link}\n\n`;
      }

      markdownOutput += `> ${snippet}\n\n`;
      markdownOutput += `---\n\n`;
    });

    // --- DEEP RESEARCH: Scrape top 3 authoritative results ---
    console.log("🕵️ Deep Research: Scraping top 3 authoritative results...");
    
    // Filter out video URLs for scraping, take top 3
    const scrapableResults = scoredResults
      .filter(item => !item.link.includes('youtube.com') && !item.link.includes('youtu.be'))
      .slice(0, 3);

    const scrapePromises = scrapableResults.map((item) => 
      scrapeUrl(item.link, { maxLength: 3500, timeout: 8000 })
    );
    const scrapedContents = await Promise.all(scrapePromises);

    markdownOutput += `\n### 🕵️ Deep Research Insights\n\n`;

    let insightsAdded = 0;
    scrapableResults.forEach((item, index) => {
      const content = scrapedContents[index];
      if (content && content.length > 100) {
        markdownOutput += `#### From [${item.title}](${item.link}) ${item.authorityInfo.tier}\n`;
        markdownOutput += `${content}\n\n`;
        insightsAdded++;
      }
    });

    if (insightsAdded === 0) {
      markdownOutput += `> No detailed content could be extracted from the sources.\n\n`;
    }

    // Add query metadata for AI context
    markdownOutput += `\n---\n**Query Metadata:**\n`;
    markdownOutput += `- Query Intent: ${queryIntent}\n`;
    markdownOutput += `- Results Retrieved: ${scoredResults.length}\n`;
    markdownOutput += `- Sources Scraped: ${insightsAdded}\n`;
    markdownOutput += `- Images Found: ${images.length}\n`;

    // Cache the result
    setCachedResult(query, markdownOutput);

    return markdownOutput;

  } catch (error) {
    console.error("❌ Web search error:", error);
    return null;
  }
}

// --- MAIN GENERATION ENDPOINT ---
app.post("/api/generate", optionalAuthToken, async (req, res) => {
  // Get request parameters
  let { prompt, systemMessage, history, model, max_tokens, webSearch, canvasMode, toolId, attachment } =
    req.body;

  // Determine the system message based on mode
  let finalSystemMessage;
  
  if (canvasMode) {
    let baseCanvasPrompt;
    if (canvasMode === 'doc') {
       // Document Mode (Resume, Essays, Markdown)
       baseCanvasPrompt = CANVAS_DOC_PROMPT || CANVAS_WEB_PROMPT; 
       console.log("🎨 Canvas Mode: Using DOC prompt (Resume/Text)");
    } else {
       // Web/App Mode (Default for Canvas)
       baseCanvasPrompt = CANVAS_WEB_PROMPT;
       console.log("🎨 Canvas Mode: Using WEB prompt (HTML/App)");
    }

    // CRITICAL: If the frontend sent a systemMessage (likely containing FILE CONTEXT), 
    // we must combine it with the Canvas Prompt, otherwise the AI ignores the file.
    if (systemMessage && systemMessage !== DEFAULT_SYSTEM_PROMPT && systemMessage.length > 100) {
        console.log("📎 Combining Canvas Prompt with File Context/System Message");
        finalSystemMessage = baseCanvasPrompt + "\n\n" + 
            "## 📎 CONTEXT & DATA\n" + 
            "The user has provided the following context (files/data). USE THIS DATA to generate the document:\n\n" + 
            systemMessage;
    } else {
        finalSystemMessage = baseCanvasPrompt;
    }

  } else {
    finalSystemMessage = systemMessage || DEFAULT_SYSTEM_PROMPT;
  }

  // --- TOOL PROMPT INJECTION (APPEND TO PRESERVE CONTEXT) ---
  // Tool-specific prompts are APPENDED to preserve any context (like uploaded data)
  if (toolId && TOOL_PROMPTS[toolId]) {
    // APPEND tool prompt to existing system message (which may contain data context)
    finalSystemMessage = finalSystemMessage + "\n\n---\n\n" + TOOL_PROMPTS[toolId];
    console.log(`🔧 Tool Mode Active: "${toolId}" - Appended specialized prompt (${TOOL_PROMPTS[toolId].length} chars)`);
  }

  // --- OPENROUTER REASONING SUPPRESSION ---
  // Add instruction to hide chain-of-thought reasoning for OpenRouter models
  const selectedModelConfig = AVAILABLE_MODELS.find(m => m.id === model) || { provider: "groq" };
  if (selectedModelConfig.provider === "openrouter") {
    finalSystemMessage += "\n\n---\nIMPORTANT: Provide ONLY your final answer. Do NOT show your thinking process, chain-of-thought, reasoning steps, or internal thoughts. Give direct, clean responses without any <thinking>, <reasoning>, or similar tags.";
    console.log("🧠 OpenRouter: Added reasoning suppression prompt");
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

6.  **DATE AWARENESS:**
    - Today is ${new Date().toLocaleDateString()}. Prioritize recent results.

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
    const userMsg = { role: "user", content: prompt };
    if (attachment) {
        userMsg.attachment = attachment;
    }
    messages.push(userMsg);
  } else {
    return res.status(400).json({ error: "No prompt provided" });
  }

  try {
    // --- MODEL SELECTION & PROVIDER LOGIC ---
    let selectedModelConfig = AVAILABLE_MODELS.find(m => m.id === model);
    if (!selectedModelConfig) {
        // Fallback or check if it's one of the hardcoded types
        if (model.includes("llama")) {
            selectedModelConfig = { provider: "groq" };
        } else {
             selectedModelConfig = { provider: "groq" }; // Default to groq
        }
    }

    let apiUrl = "https://api.groq.com/openai/v1/chat/completions";
    let apiKey = process.env.API_KEY;

    if (selectedModelConfig.provider === "groq") {
        apiUrl = "https://api.groq.com/openai/v1/chat/completions";
        apiKey = process.env.GROQ_API_KEY || process.env.API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Groq API Key is missing in server environment." });
        }
    } else if (selectedModelConfig.provider === "google") {
        apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        apiKey = process.env.GOOGLE_GENERATIVE_AI_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Google Generative AI Key is missing in server environment." });
        }
    } else if (selectedModelConfig.provider === "openrouter") {
        apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "OpenRouter API Key is missing. Get one at openrouter.ai" });
        }
    }
    
    console.log(`🤖 Processing request with model: ${model} (Provider: ${selectedModelConfig.provider})`);

    // Vision handling for Gemini (Google) if needed
    // The OpenAI compatibility layer for Gemini supports image_url, so the existing formatting might work.
    // However, we should ensure the model name is correct.

    // --- AUTO-SWITCH TO VISION MODEL FOR IMAGES ---
    // (Logic preserved but adapted)
    const hasImageAttachment = messages.some(msg => msg.attachment && msg.attachment.type === "image");
    
    if (hasImageAttachment) {
        // Only auto-switch if we aren't already on a multimodal model
        // Gemini models are multimodal by default usually, but let's check config
        const isMultimodal = selectedModelConfig.id?.includes("gemini") || selectedModelConfig.id?.includes("vision") || selectedModelConfig.id?.includes("scout");
        
        if (!isMultimodal) {
             const visionModel = "meta-llama/llama-4-scout-17b-16e-instruct"; 
             model = visionModel;
             selectedModelConfig = AVAILABLE_MODELS.find(m => m.id === model) || { provider: "groq" };
             console.log(`🔄 Auto-switched to '${model}' for image support.`);
        }
    }

     // --- VISION MESSAGE FORMATTING ---
    if (hasImageAttachment) {
      const lastMsgIndex = messages.length - 1;
      const lastMsg = messages[lastMsgIndex];

      if (lastMsg.role === "user" && lastMsg.attachment && lastMsg.attachment.type === "image" && lastMsg.attachment.data_url) {
        console.log("👁️ Vision request processing...");
        
        const newContent = [
          { type: "text", text: lastMsg.content || "Describe this image." },
          { 
            type: "image_url", 
            image_url: { 
              url: lastMsg.attachment.data_url 
            } 
          }
        ];
        
        messages[lastMsgIndex].content = newContent;
        // Remove attachment property
        delete messages[lastMsgIndex].attachment;
      }
    }

    // Prepare clean messages for API (remove internal fields like 'attachment')
    const finalMessages = messages.map(msg => {
        const { attachment, ...rest } = msg;
        return rest;
    });

    const requestBody = {
      model: model,
      messages: finalMessages,
      ...(max_tokens && { max_tokens: parseInt(max_tokens, 10) }),
    };

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    // Add OpenRouter-specific headers
    if (selectedModelConfig.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://lynq.ai"; // Your site URL
      headers["X-Title"] = "LYNQ AI"; // Your app name
    }

    // --- RETRY LOGIC: Retry for up to 10 seconds ---
    const MAX_RETRY_TIME_MS = 10000; // 10 seconds
    const startTime = Date.now();
    let lastError = null;
    let response = null;
    let data = null;
    let retryCount = 0;

    while (Date.now() - startTime < MAX_RETRY_TIME_MS) {
      try {
        response = await fetch(
          apiUrl,
          {
            method: "POST",
            headers: headers,
            body: JSON.stringify(requestBody),
          }
        );

        data = await response.json();

        // If successful response, break out of retry loop
        if (response.ok && data?.choices?.[0]?.message?.content) {
          break;
        }

        // If rate limited or server error, retry
        if (response.status === 429 || response.status >= 500) {
          retryCount++;
          const waitTime = Math.min(1000 * retryCount, 3000); // Exponential backoff, max 3s
          console.log(`⏳ API failed (${response.status}), retrying in ${waitTime}ms... (Attempt ${retryCount})`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        // For other errors, don't retry
        break;

      } catch (fetchError) {
        lastError = fetchError;
        retryCount++;
        const waitTime = Math.min(1000 * retryCount, 3000);
        console.log(`⏳ Fetch error, retrying in ${waitTime}ms... (Attempt ${retryCount})`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }

    if (retryCount > 0) {
      console.log(`🔄 Total retry attempts: ${retryCount}`);
    }

    if (!response || !data) {
      throw lastError || new Error("Failed to get response after retries");
    }

    if (!response.ok) {
      console.error(`${selectedModelConfig.provider} API error:`, data);
      
      // Handle tool_use_failed (Groq specific) or generic errors
      if (data?.error?.code === "tool_use_failed") {
          if (searchResults) {
             return res.json({
               text: `Here's what I found:\n\n${searchResults}\n\n*Note: The AI model encountered an issue. Showing raw search results instead.*`
             });
          }
      }

      // IMPROVED ERROR HANDLING
      let errorMessage = "An unknown error occurred.";
      
      if (selectedModelConfig.provider === "google") {
          if (response.status === 429 || data?.error?.status === "RESOURCE_EXHAUSTED") {
              errorMessage = "Google AI Quota Exceeded. Please try a different model (like Llama) or wait a moment. The free tier limits may have been reached.";
          } else if (data?.error?.message) {
              errorMessage = `Google API Error: ${data.error.message}`;
          } else {
             errorMessage = `Google API Error (${response.status})`;
          }
      } else {
          // Groq or other provider
          errorMessage = data?.error?.message || `API Error (${response.status})`;
      }

      return res.status(response.status).json({ error: errorMessage });
    }

    const reply = data.choices?.[0]?.message?.content;
    if (!reply) {
      return res.status(500).json({ error: "No reply from model" });
    }

    // --- POST-PROCESS: Strip reasoning/thinking tags from response ---
    // Some OpenRouter models (like DeepSeek R1T) include <thinking> tags
    let cleanReply = reply;
    if (selectedModelConfig.provider === "openrouter") {
      // Remove <thinking>...</thinking> blocks
      cleanReply = cleanReply.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
      // Remove <reasoning>...</reasoning> blocks
      cleanReply = cleanReply.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
      // Remove <thought>...</thought> blocks
      cleanReply = cleanReply.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
      // Clean up any leftover whitespace
      cleanReply = cleanReply.trim();
      
      if (cleanReply !== reply) {
        console.log("🧹 OpenRouter: Stripped reasoning tags from response");
      }
    }

    res.json({ text: cleanReply });
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
