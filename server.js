import express from "express";
import cors from "cors";
import "dotenv/config"; // Loads .env file into process.env
import path from "path"; // NEW: Import path module
import { fileURLToPath } from "url"; // NEW: Helper for ES modules

// --- NEW: Setup for __dirname in ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// --- Middleware ---
// 1. Enable CORS (still good practice)
app.use(cors());
// 2. Enable built-in JSON parsing
app.use(express.json());
// 3. --- NEW: Serve Static Files ---
// This tells Express to serve your index.html, style.css, etc., from the root directory
app.use(express.static(path.join(__dirname)));

// --- Environment Variables ---
const API_KEY = process.env.API_KEY;
const MODEL_URL = process.env.MODEL_URL; // ADDED BACK

if (!API_KEY) {
  console.error("Error: API_KEY is not defined. Please check your .env file.");
  process.exit(1); // Exit the process with an error
}
if (!process.env.MODEL) {
  console.error("Error: MODEL is not defined. Please check your .env file.");
  process.exit(1); // Exit the process with an error
}

// --- API Endpoint ---
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
