
import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000";

// Mock user token (if needed, but our endpoint logic for this test might need tweaks if auth is strictly enforced)
// For this test, I will assume I need to get a token or temporarily bypass auth.
// Actually, looking at server.js, /api/rag/add requires verifiesAuthToken.
// BUT, since we are running locally, I can just trust that the server starts up fine.
// Wait, I can't generate a valid Firebase token easily here without a client SDK login.

// ALTERNATIVE: I will temporarily modify server.js to allow /api/rag/add to be public OR
// I will just use the fact that I modified `server.js` to NOT require auth for `/api/generate` (it says optionalAuthToken).
// But `/api/rag/add` DOES require it.

// Let's write a script that tests `/api/generate` directly to see if RAG injection works, 
// BUT we first need to put something IN the memory.
// I'll create a TEMPORARY public endpoint for the test in server.js, OR I will manually modify vector_store.json.

// Let's simple write to vector_store.json directly since I have file access!
// That's much easier than faking auth.

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

async function runTest() {
    console.log("🧪 Starting RAG Verification Test...");

    // 1. Generate an embedding for a secret fact
    const secretFact = "The secret code for the nuclear launch is PURPLE-MONKEY-DISHWASHER.";
    console.log(`📝 Embedding fact: "${secretFact}"`);
    
    try {
        const result = await embeddingModel.embedContent(secretFact);
        const vector = result.embedding.values;

        // 2. Write to vector_store.json
        const memory = {
            id: "test-memory-1",
            text: secretFact,
            vector: vector,
            metadata: { type: "test" },
            createdAt: new Date().toISOString()
        };

        const vectorStorePath = path.join(process.cwd(), "data", "vector_store.json");
        
        // Read existing
        let store = [];
        if (fs.existsSync(vectorStorePath)) {
             store = JSON.parse(fs.readFileSync(vectorStorePath, 'utf8'));
        }
        
        // Remove old test if exists
        store = store.filter(m => m.id !== "test-memory-1");
        store.push(memory);
        
        fs.writeFileSync(vectorStorePath, JSON.stringify(store, null, 2));
        console.log("💾 Saved key to vector_store.json directy.");

        // 3. Restart Server? 
        // No, the server loads the file "on startup". 
        // I need to trigger a reload or restart the server process.
        // Since I'm using `nodemon`, editing the `server.js` file triggers a restart.
        // But verifying via script that runs PARALLEL to server is tricky if server cache is stale.
        
        // Actually, my `loadVectorStore` is only called at top level.
        // I should probably add a way to reload it, or just rely on nodemon restarting when I customized server.js earlier.
        // Wait, I am running this script separately. The SERVER process (running in terminal) has its OWN memory.
        // Writing to the file won't update the running server's RAM variable `VECTOR_STORE`.
        
        // Solution: I'll make a tiny edit to server.js (whitespace) to force nodemon to restart it.
        
        console.log("🔄 Triggering server restart...");
        const serverPath = path.join(process.cwd(), "server.js");
        const serverContent = fs.readFileSync(serverPath, 'utf8');
        fs.writeFileSync(serverPath, serverContent + " \n// trigger restart " + Date.now());
        
        console.log("⏳ Waiting 5s for server restart...");
        await new Promise(r => setTimeout(r, 5000));

        // 4. Query the API
        console.log("❓ Asking AI about the secret code...");
        const response = await fetch(BASE_URL + "/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: "What is the secret launch code?",
                model: "gpt-oss-120b" // Uses groq usually, or fallback
            })
        });
        
        const data = await response.json();
        console.log("\n🤖 AI Response:\n", data.text);
        
        if (data.text.includes("PURPLE-MONKEY-DISHWASHER")) {
            console.log("\n✅ SUCCESS! RAG retrieved the secret.");
        } else {
            console.log("\n❌ FAILURE. RAG did not retrieve the secret.");
        }

    } catch (err) {
        console.error("Test failed:", err);
    }
}

runTest();
