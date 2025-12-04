/* api.js */

const API_BASE = "/api";
const CHAT_API_BASE = "/api/chats";

/**
 * Generic authenticated fetch wrapper.
 */
async function authenticatedFetch(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // 1. Get the current user directly from the global Firebase SDK
  const user = firebase.auth().currentUser;

  if (user) {
    try {
      // Force refresh to ensure token isn't expired
      const token = await user.getIdToken(true);
      headers["Authorization"] = `Bearer ${token}`;
    } catch (error) {
      console.error("Token retrieval failed:", error);
    }
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(endpoint, config);

    // 2. Global Error Handling
    if (response.status === 401 || response.status === 403) {
      console.warn("Unauthorized request. Session might be expired.");
      // Optional: Trigger a logout or UI update here
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Request failed: ${response.statusText}`
      );
    }

    // Return JSON if content exists, else null
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// --- ATTACH TO WINDOW (Makes it accessible to script.js and home.js) ---
window.api = {
  // Chat CRUD
  getChats: () => authenticatedFetch(CHAT_API_BASE),

  getChat: (id) => authenticatedFetch(`${CHAT_API_BASE}/${id}`),

  saveChat: (chatData) =>
    authenticatedFetch(`${CHAT_API_BASE}/save`, {
      method: "POST",
      body: JSON.stringify(chatData),
    }),

  deleteChat: (id) =>
    authenticatedFetch(`${CHAT_API_BASE}/${id}`, {
      method: "DELETE",
    }),

  // AI Generation
  // Note: We pass 'signal' to allow the Stop button to work
  generateResponse: (payload, signal) =>
    authenticatedFetch("/api/generate", {
      method: "POST",
      body: JSON.stringify(payload),
      signal: signal,
    }),

  // User Sync
  syncUser: () =>
    authenticatedFetch("/api/users/sync", {
      method: "POST",
    }),
};
