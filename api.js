/*
  api.js
  Centralized service for handling all backend communication.
  - Automatically injects Firebase Auth headers.
  - Centralizes error handling.
  - Prevents code repetition across the app.
*/

// We will import the auth instance from our refactored auth module
import { getAuth } from "./auth.js";

const API_BASE = "/api";
const CHAT_API_BASE = "/api/chats";

/**
 * Generic authenticated fetch wrapper.
 * @param {string} endpoint - relative path (e.g., '/chats')
 * @param {object} options - fetch options (method, body, etc.)
 */
async function authenticatedFetch(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // 1. Get the current user and token securely
  const auth = getAuth();
  const user = auth.currentUser;

  if (user) {
    try {
      // Force refresh to ensure token isn't expired
      const token = await user.getIdToken(true);
      headers["Authorization"] = `Bearer ${token}`;
    } catch (error) {
      console.error("Token retrieval failed:", error);
      // We don't block the request here; the server will decide if it's 401
    }
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(endpoint, config);

    // 2. Global Error Handling (401/403)
    if (response.status === 401 || response.status === 403) {
      console.warn("Unauthorized request. Session might be expired.");
      document.dispatchEvent(new CustomEvent("auth-error"));
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

// --- PUBLIC API METHODS ---

export const api = {
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
  generateResponse: (payload) =>
    authenticatedFetch("/api/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // User Sync
  syncUser: () =>
    authenticatedFetch("/api/users/sync", {
      method: "POST",
    }),
};
