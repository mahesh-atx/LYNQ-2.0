import express from "express";
import cors from "cors";
import "dotenv/config"; // Loads .env file into process.env
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose"; // NEW: Import mongoose

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
const API_KEY = process.env.API_KEY;
const MODEL_URL = process.env.MODEL_URL;
const MONGODB_URI = process.env.MONGODB_URI; // NEW: Get MongoDB URI

if (!API_KEY) {
  console.error("Error: API_KEY is not defined. Please check your .env file.");
  process.exit(1);
}
if (!process.env.MODEL) {
  console.error("Error: MODEL is not defined. Please check your .env file.");
  process.exit(1);
}
if (!MONGODB_URI) {
  console.error(
    "Error: MONGODB_URI is not defined. Please check your .env file."
  );
  process.exit(1);
}

// --- NEW: MongoDB Connection & Schema ---
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Successfully connected to MongoDB."))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const MessageSchema = new mongoose.Schema({
  role: { type: String, required: true },
  content: { type: String, required: true },
  attachment: {
    name: String,
    text: String,
    type: String, // e.g., 'pdf'
  },
});

const ChatSchema = new mongoose.Schema({
  // Unique ID for the chat, used by the frontend
  chatId: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  history: [MessageSchema],
  pinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Using a pre-save hook to update the updatedAt timestamp
ChatSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Chat = mongoose.model("Chat", ChatSchema);

// --- NEW: Chat Data API Endpoints ---

// GET: Load all recent chats (sidebar list)
app.get("/api/chats", async (req, res) => {
  try {
    // Only fetch necessary fields for the sidebar list, sorted by last updated
    const chats = await Chat.find({})
      .select("chatId title pinned updatedAt")
      .sort({ updatedAt: -1 });
    res.json(
      chats.map((chat) => ({
        id: chat.chatId, // Map MongoDB ID back to frontend 'id'
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

// GET: Load a single chat (for loading history)
app.get("/api/chats/:id", async (req, res) => {
  try {
    const chatId = req.params.id;
    const chat = await Chat.findOne({ chatId: chatId });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
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

// POST or PUT: Save/Update a chat
app.post("/api/chats/save", async (req, res) => {
  const { id, title, history, pinned } = req.body;

  if (!id || !title || !Array.isArray(history)) {
    return res.status(400).json({ error: "Missing required chat data" });
  }

  try {
    const update = {
      title,
      history,
      pinned: pinned !== undefined ? pinned : false,
    };

    const options = {
      new: true, // Return the updated document
      upsert: true, // Create if not found (though new chats are created with `Date.now()`)
      setDefaultsOnInsert: true,
    };

    const savedChat = await Chat.findOneAndUpdate(
      { chatId: id },
      update,
      options
    );

    res.json({ success: true, id: savedChat.chatId });
  } catch (err) {
    console.error("Error saving chat:", err);
    res.status(500).json({ error: "Failed to save chat" });
  }
});

// DELETE: Delete a chat
app.delete("/api/chats/:id", async (req, res) => {
  try {
    const chatId = req.params.id;
    const result = await Chat.deleteOne({ chatId: chatId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.json({ success: true, message: "Chat deleted" });
  } catch (err) {
    console.error("Error deleting chat:", err);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

// --- Existing Groq API Endpoint ---
// This path /api/generate now lives on the same server as your index.html
app.post("/api/generate", async (req, res) => {
  // 1. Destructure all parts from the client
  // --- UPDATED ---: Added max_tokens here
  const { prompt, systemMessage, history, model, max_tokens } = req.body;

  // 2. Build the messages array for the API
  let messages = [];

  // 3. Add the system message (if it exists)
  if (systemMessage) {
    messages.push({ role: "system", content: systemMessage });
  }

  // 4. Add the past history (if it exists)
  if (history && Array.isArray(history)) {
    messages = messages.concat(history);
  }

  // 5. Add the new user prompt
  if (prompt) {
    messages.push({ role: "user", content: prompt });
  } else {
    // Don't run if there's no new prompt
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
        // --- UPDATED ---: The body now includes max_tokens if it exists
        body: JSON.stringify({
          model: model || process.env.MODEL, // Will use client's model, or fallback to .env
          // 6. Pass the complete, ordered array
          messages: messages,
          // 7. NEW: Add max_tokens if it was sent from the client
          // Ensures it's an integer and only adds the key if max_tokens is present
          ...(max_tokens && { max_tokens: parseInt(max_tokens, 10) }),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Grok API error:", data);
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

// Start the server
app.listen(port, () => {
  console.log(
    `LYNQ AI app (frontend and backend) listening on http://localhost:${port}`
  );
  console.log(`You can now open http://localhost:${port} in your browser.`);
});