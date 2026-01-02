
import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000";

async function query() {
    console.log("❓ Asking AI about the secret code...");
    try {
        const response = await fetch(BASE_URL + "/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: "What is the secret launch code?",
                model: "gpt-oss-120b"
            })
        });
        
        const data = await response.json();
        console.log("\n🤖 AI Response:\n", data.text);
        
        if (data.text && data.text.includes("PURPLE")) {
             console.log("\n✅ RAG VERIFIED: Secret code retrieved.");
        } else {
             console.log("\n❌ RAG FAILED: Secret code NOT retrieved.");
        }
    } catch (err) {
        console.error("Query failed", err);
    }
}

query();
