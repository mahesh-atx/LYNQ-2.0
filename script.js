/*
  script.js
  This file contains shared logic and state used across ALL pages.
  
  --- UPDATED: Real Firebase Auth integration ---
  - Removed all "fake" auth logic (handleLogin, showAuthPopup, etc.)
  - Added Firebase init and auth state listener
  - All API calls are now secured with a Firebase Auth token
*/

// --- GLOBAL STATE & API CONFIG ---
let mainChatHistory = [];

// !! IMPORTANT !!
// You must replace this with your own Firebase project configuration
// This MUST match the config in login.html and auth.js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

let currentUser = null; // Store the logged-in Firebase user object

// recentChats will be populated asynchronously
let recentChats = [];
let isNewChat = true;
// activeChatId tracks the chatId (Number from Date.now())
let activeChatId = null;

// --- PLUGIN STATE ---
let installedPlugins = [];

// --- CODE SNAPSHOTS ---
let codeSnapshots = [];
let currentSnapshotIndex = -1;

// --- API Configuration ---
const API_URL = "/api/generate";
const CHAT_API_BASE = "/api/chats"; // New base URL for chat CRUD
let generatedRawCode = "";
let isResponding = false;
let currentController = null;
let currentSelectedModel = "openai/gpt-oss-120b"; // Default model
let systemPromptCache = null; // Cache for the loaded system prompt

// --- SHARED DOM ELEMENTS ---
let body;
let toast;
let confirmDeleteModal;
let confirmDeleteText;
let confirmDeleteCancelBtn;
let confirmDeleteConfirmBtn;
let sidebar;
let mobileOverlay;

// --- NEW: SWIPE AND CLICK OUTSIDE LOGIC GLOBALS ---
let touchStartX = 0;
let touchEndX = 0;
const SWIPE_THRESHOLD = 50; // Minimum distance for a recognized swipe

// --- REMOVED: Fake login/auth functions ---
// handleLogin()
// showAuthPopup()
// closeAuthPopup()
// redirectToLogin()
// redirectToSignup()

// --- NEW: Auth Helper ---
/**
 * Handles auth errors (401, 403) by logging the user out.
 */
function handleAuthError() {
  console.error("Authentication error. Token may be invalid. Logging out.");
  if (typeof logoutUser === "function") {
    logoutUser(); // logoutUser() is defined in auth.js
  }
  showToast("Session expired. Please log in again.");
}

/**
 * Saves or updates a chat to the MongoDB backend.
 * @param {object} chatData The chat object to save ({id, title, history, pinned}).
 */
async function saveChat(chatData) {
  // --- NEW: Auth Check ---
  if (!currentUser) return null;
  const token = await getAuthToken(); // getAuthToken() is from auth.js
  if (!token) {
    handleAuthError();
    return null;
  }
  // --- END NEW ---

  try {
    const response = await fetch(`${CHAT_API_BASE}/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Add token
      },
      body: JSON.stringify(chatData),
    });

    if (response.status === 401 || response.status === 403) {
      handleAuthError();
      return null;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to save chat.");
    }

    const data = await response.json();
    // After saving, reload all chats to update the sidebar
    await loadAllChats();
    return data.id; // Return the saved chat ID
  } catch (error) {
    console.error("Error saving chat:", error);
    showToast(`Failed to save chat: ${error.message}`);
    return null;
  }
}

/**
 * Loads all recent chat summaries for the sidebar.
 */
async function loadAllChats() {
  // --- NEW: Auth Check ---
  if (!currentUser) {
    console.log("loadAllChats: No user. Skipping.");
    return;
  }
  const token = await getAuthToken();
  if (!token) {
    handleAuthError();
    return;
  }
  // --- END NEW ---

  try {
    const response = await fetch(CHAT_API_BASE, {
      headers: {
        Authorization: `Bearer ${token}`, // Add token
      },
    });

    if (response.status === 401 || response.status === 403) {
      handleAuthError();
      return;
    }
    if (!response.ok) {
      throw new Error("Failed to fetch recent chats.");
    }
    recentChats = await response.json();
    renderRecentChats();

    // If a chat was previously active, ensure it's loaded back if still exists
    if (activeChatId) {
      const activeChatExists = recentChats.some((c) => c.id == activeChatId);
      if (!activeChatExists) {
        // The active chat was likely deleted or doesn't exist anymore
        activeChatId = null;
        isNewChat = true;
        if (typeof resetChat === "function") resetChat();
      }
    }

    // Check if the home page is currently loaded and try to load the active chat
    if (
      (window.location.pathname.endsWith("index.html") ||
        window.location.pathname.endsWith("/")) &&
      typeof loadChat === "function" &&
      activeChatId // activeChatId is now populated by loadState from URL on initial load
    ) {
      // Load the full history for the active chat
      await loadChat(activeChatId);
    }
  } catch (error) {
    console.error("Error loading all chats:", error);
    showToast(`Failed to load chats: ${error.message}.`);
    // Fallback if API fails: keep recentChats array empty/local until save.
  }
}

// --- SHARED FUNCTIONS ---

function toggleChatSearch(show) {
  const label = document.getElementById("recent-chats-label");
  const input = document.getElementById("chat-search-input");
  const trigger = document.getElementById("chat-search-trigger");

  if (!label || !input || !trigger) return;

  if (show) {
    label.style.display = "none";
    trigger.style.display = "none";
    input.style.display = "block";
    input.focus();
  } else {
    label.style.display = "block";
    trigger.style.display = "block";
    input.style.display = "none";
    input.value = "";
    filterRecentChats();
  }
}

function filterRecentChats() {
  const filterInput = document.getElementById("chat-search-input");
  if (!filterInput) return;

  const filter = filterInput.value.toLowerCase();
  const chatItems = document.querySelectorAll(
    "#recent-chats-container .chat-item-wrapper"
  );

  chatItems.forEach((item) => {
    const title = item.querySelector(".chat-title").innerText.toLowerCase();
    if (title.includes(filter)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
}

/**
 * Loads the base system prompt from the external file and combines it
 * with user's custom instructions and context (PDF/Canvas).
 * NOTE: This function is called by home.js.
 */
async function getSystemMessage(taskSpecificContext) {
  // 1. Load base system prompt from file (cache it)
  if (!systemPromptCache) {
    try {
      // NOTE: This assumes systemprompt.txt is available via the server static path
      const response = await fetch("systemprompt.txt");
      if (!response.ok) throw new Error("Failed to load systemprompt.txt");
      systemPromptCache = await response.text();
    } catch (error) {
      console.error("Error loading base system prompt:", error);
      systemPromptCache = "You are a helpful and friendly AI assistant."; // Fallback
    }
  }

  // 2. Add custom instructions from settings
  // Keeping localStorage for non-chat state like settings for simplicity
  const customInstructions = localStorage.getItem("lynq_custom_instructions");
  let finalPrompt = systemPromptCache;

  if (customInstructions) {
    finalPrompt = `${customInstructions}\n\n---\n\n${finalPrompt}`;
  }

  // 3. Add context (PDF/Canvas) specific instructions
  return `${finalPrompt}\n\n${taskSpecificContext}`;
}

// --- NEW: Function to save sidebar state to localStorage ---
function saveSidebarState(isCollapsed) {
  localStorage.setItem(
    "lynq-sidebar-collapsed",
    isCollapsed ? "true" : "false"
  );
}

/**
 * Loads non-chat state and initializes the active chat from the URL.
 * @param {boolean} [loadChats=true] - Flag to control if chats should be loaded.
 */
async function loadState(loadChats = true) {
  // 1. Load non-chat state from localStorage (theme, model, etc.)

  // Theme check
  const savedTheme = localStorage.getItem("lynq-theme");
  if (savedTheme === "light") {
    document.body.classList.remove("dark-mode");
  } else {
    document.body.classList.add("dark-mode");
    localStorage.setItem("lynq-theme", "dark");
  }

  // Sidebar state check (only applies to desktop)
  const isSidebarCollapsed = localStorage.getItem("lynq-sidebar-collapsed");

  if (sidebar) {
    if (window.innerWidth > 768) {
      if (isSidebarCollapsed === "false") {
        // If state is explicitly saved as open, remove 'collapsed' class
        sidebar.classList.remove("collapsed");
      } else if (isSidebarCollapsed === null) {
        // If no state is saved (first run), ensure it's collapsed by default.
        sidebar.classList.add("collapsed");
        saveSidebarState(true);
      }
    } else {
      // Always start collapsed on mobile, regardless of saved desktop state
      sidebar.classList.remove("active");
    }
  }

  // --- NEW: Check URL for active chat ID on initial load ---
  const urlParams = new URLSearchParams(window.location.search);
  const urlChatId = urlParams.get("chatId");

  if (urlChatId) {
    // Must convert to number since chat IDs are generated with Date.now()
    activeChatId = parseInt(urlChatId, 10);
    isNewChat = false;
  }
  // --- END NEW ---

  // 2. Load the recent chats from the server (if user is logged in)
  if (loadChats) {
    await loadAllChats();
  }
}

async function getApiResponse(
  prompt,
  systemMessage = null,
  history = [],
  signal = null
) {
  // --- MODIFIED: Auth is now optional ---
  let headers = { "Content-Type": "application/json" };

  // Only add Auth header if a user is logged in
  if (currentUser) {
    const token = await getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      // This might happen if token refresh fails
      console.warn("Could not get auth token for logged-in user.");
      // We don't call handleAuthError() here, just proceed as guest
    }
  }
  // --- END MODIFIED ---

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: headers, // Use the new conditional headers
      body: JSON.stringify({
        prompt: prompt,
        systemMessage: systemMessage,
        history: history,
        model: currentSelectedModel,
      }),
      signal: signal,
    });

    // We no longer check for 401/403 here, as guests won't send a token
    // and will get a valid response.
    // The server will still block invalid tokens if they ARE sent.
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "The server responded with an error.");
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request cancelled");
    }
    throw error;
  }
}

function showApiError(message, thinkingElement = null) {
  if (message === "Request cancelled") return;
  if (thinkingElement) thinkingElement.remove();

  const errorMsg = `<strong>Oops, an error occurred:</strong><br><br>${message}`;

  // If we are on the home page and addMessage exists
  if (typeof addMessage === "function") {
    const bubble = addMessage("", "ai", true);
    if (bubble) {
      bubble.classList.add("error");
      bubble.innerHTML = errorMsg;
    }
  } else {
    // Fallback if we are not on the chat page
    console.error("API Error: ", message);
    showToast("API Error: " + message);
  }
}

function showToast(message) {
  if (!toast) return;
  toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
  toast.className = "show";
  setTimeout(function () {
    toast.className = toast.className.replace("show", "");
  }, 3000);
}

function toggleTheme() {
  if (!body) return;
  body.classList.toggle("dark-mode");

  if (body.classList.contains("dark-mode")) {
    localStorage.setItem("lynq-theme", "dark");
  } else {
    localStorage.setItem("lynq-theme", "light");
  }

  const settingsToggle = document.getElementById("settings-theme-toggle");
  if (settingsToggle) {
    settingsToggle.checked = body.classList.contains("dark-mode");
  }
}

/**
 * Toggles the sidebar visibility, handling desktop collapsed state and mobile overlay.
 */
function toggleSidebar() {
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    // Mobile mode
    const isActive = sidebar.classList.toggle("active");
    if (mobileOverlay) {
      mobileOverlay.classList.toggle("active", isActive);
    }
  } else {
    // Desktop mode
    const isCollapsed = sidebar.classList.toggle("collapsed");
    saveSidebarState(isCollapsed); // Save the new state
  }
}

/**
 * Explicitly closes the sidebar, handling both mobile and desktop states.
 */
function closeSidebar() {
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    // Mobile mode
    sidebar.classList.remove("active");
    if (mobileOverlay) {
      mobileOverlay.classList.remove("active");
    }
  } else {
    // Desktop mode
    sidebar.classList.add("collapsed");
    saveSidebarState(true); // Save the new state
  }
}

function renderRecentChats() {
  const container = document.getElementById("recent-chats-container");
  if (!container) return;

  container.innerHTML = "";

  // Sorting is now handled by the server (by updatedAt), but we respect 'pinned' first on the client
  recentChats.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0; // Maintain server sort order for unpinned chats
  });

  recentChats.forEach((chat) => {
    const menuId = `chat-menu-${chat.id}`;

    const wrapper = document.createElement("div");
    wrapper.className = "chat-item-wrapper";
    wrapper.id = `chat-wrapper-${chat.id}`;

    const navLink = document.createElement("a");
    navLink.className = "nav-item";
    if (chat.id == activeChatId) {
      navLink.classList.add("active");
    }
    // MODIFIED: Change href to a fragment for better SPA behavior
    navLink.href = `#chat-${chat.id}`;

    // MODIFIED: Fix the link handler to prevent refresh and dynamically load the chat
    navLink.onclick = async (e) => {
      e.preventDefault(); // <-- CRITICAL FIX: Stop the page refresh!

      // Update global state immediately
      activeChatId = chat.id;
      isNewChat = false;

      // Update UI: Remove 'active' class from all, add to this one
      document
        .querySelectorAll("#recent-chats-container .nav-item")
        .forEach((item) => item.classList.remove("active"));
      navLink.classList.add("active");

      // Update URL to persist the state for refreshes
      const newUrl = window.location.pathname + `?chatId=${chat.id}`;
      history.pushState({ chatId: activeChatId }, chat.title, newUrl);

      // Load the full history for the active chat
      if (typeof loadChat === "function") {
        await loadChat(activeChatId);
      }

      // Close sidebar on mobile
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    };

    const icon = chat.pinned
      ? '<i class="fa-solid fa-thumbtack" style="font-size:0.8rem; opacity:0.7;"></i>'
      : '<i class="fa-regular fa-message"></i>';

    navLink.innerHTML = `
            ${icon}
            <span class="chat-title">${chat.title}</span>
        `;

    const optionsTrigger = document.createElement("i");
    optionsTrigger.className = "fa-solid fa-ellipsis chat-options-trigger";
    optionsTrigger.onclick = (event) => toggleContextMenu(event, menuId);

    const contextMenu = document.createElement("div");
    contextMenu.className = "chat-context-menu";
    contextMenu.id = menuId;
    contextMenu.innerHTML = `
            <div class="context-item" onclick="chatAction('pin', '${chat.id}')">
                <i class="fa-solid fa-thumbtack"></i> ${
                  chat.pinned ? "Unpin" : "Pin"
                }
            </div>
            <div class="context-item" onclick="chatAction('rename', '${
              chat.id
            }')">
                <i class="fa-solid fa-pen"></i> Rename
            </div>
            <div class="context-item" onclick="chatAction('delete', '${
              chat.id
            }')">
                <i class="fa-solid fa-trash"></i> Delete
            </div>
        `;

    wrapper.appendChild(navLink);
    wrapper.appendChild(optionsTrigger);
    wrapper.appendChild(contextMenu);
    container.appendChild(wrapper);
  });
}

function togglePricing() {
  const modal = document.getElementById("pricing-modal");
  if (modal) modal.classList.toggle("active");
}

function toggleModelDropdown() {
  const dropdown = document.getElementById("model-dropdown");
  if (dropdown) dropdown.classList.toggle("show");
}

function toggleContextMenu(event, menuId) {
  event.stopPropagation();
  event.preventDefault();
  document.querySelectorAll(".chat-context-menu").forEach((menu) => {
    if (menu.id !== menuId) menu.classList.remove("show");
  });
  document.getElementById(menuId)?.classList.toggle("show");
}

function showDeleteConfirm(chatId, chatTitle) {
  if (!confirmDeleteModal) {
    if (confirm(`Are you sure you want to delete "${chatTitle}"?`)) {
      executeDelete(chatId);
    }
    return;
  }

  if (confirmDeleteText) {
    confirmDeleteText.innerHTML = `Are you sure you want to delete "<strong>${chatTitle}</strong>"? This action cannot be undone.`;
  }

  // Re-attach event listeners (important for non-modal fallback safety)
  const newConfirmBtn = confirmDeleteConfirmBtn.cloneNode(true);
  confirmDeleteConfirmBtn.parentNode.replaceChild(
    newConfirmBtn,
    confirmDeleteConfirmBtn
  );
  confirmDeleteConfirmBtn = newConfirmBtn;

  confirmDeleteConfirmBtn.onclick = async () => {
    await executeDelete(chatId);
    confirmDeleteModal.classList.remove("active");
  };

  const newCancelBtn = confirmDeleteCancelBtn.cloneNode(true);
  confirmDeleteCancelBtn.parentNode.replaceChild(
    newCancelBtn,
    confirmDeleteCancelBtn
  );
  confirmDeleteCancelBtn = newCancelBtn;

  confirmDeleteCancelBtn.onclick = () => {
    confirmDeleteModal.classList.remove("active");
  };

  confirmDeleteModal.classList.add("active");
}

async function executeDelete(chatId) {
  // --- NEW: Auth Check ---
  if (!currentUser) return;
  const token = await getAuthToken();
  if (!token) {
    handleAuthError();
    return;
  }
  // --- END NEW ---

  const chatIndex = recentChats.findIndex((chat) => chat.id == chatId);
  if (chatIndex === -1) return;

  try {
    // 1. Delete on server
    const response = await fetch(`${CHAT_API_BASE}/${chatId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`, // Add token
      },
    });

    if (response.status === 401 || response.status === 403) {
      handleAuthError();
      return;
    }
    if (!response.ok) {
      throw new Error("Server failed to delete chat.");
    }

    // 2. Delete in local array
    recentChats.splice(chatIndex, 1);

    // 3. Reset UI if active chat was deleted
    if (activeChatId == chatId) {
      // resetChat is defined in home.js, check if it exists before calling
      if (typeof resetChat === "function") {
        resetChat();
      } else {
        activeChatId = null;
        isNewChat = true;
      }
    }

    showToast("Chat deleted successfully!");
    renderRecentChats();
  } catch (error) {
    console.error("Error executing delete:", error);
    showToast(`Failed to delete chat: ${error.message}`);
  }
}

async function chatAction(action, chatId) {
  // --- NEW: Auth Check for rename/pin ---
  if (!currentUser) return;
  const token = await getAuthToken();
  if (!token) {
    handleAuthError();
    return;
  }
  // --- END NEW ---

  const chatIndex = recentChats.findIndex((chat) => chat.id == chatId);
  if (chatIndex === -1) return;

  const chat = recentChats[chatIndex];

  if (action === "delete") {
    showDeleteConfirm(chatId, chat.title);
    return;
  } else if (action === "rename") {
    const newName = prompt("Rename chat:", chat.title);
    if (newName && newName.trim() !== "") {
      chat.title = newName.trim();
    }
  } else if (action === "pin") {
    chat.pinned = !chat.pinned;
  }

  document
    .querySelectorAll(".chat-context-menu")
    .forEach((menu) => menu.classList.remove("show"));

  // Find the full chat object to save the updated metadata (title/pinned status)
  try {
    const chatHistoryResponse = await fetch(`${CHAT_API_BASE}/${chatId}`, {
      headers: {
        Authorization: `Bearer ${token}`, // Add token
      },
    });
    if (
      chatHistoryResponse.status === 401 ||
      chatHistoryResponse.status === 403
    ) {
      handleAuthError();
      return;
    }
    if (!chatHistoryResponse.ok)
      throw new Error("Could not fetch chat history for update.");
    const fullChat = await chatHistoryResponse.json();

    // Update the properties that changed
    fullChat.title = chat.title;
    fullChat.pinned = chat.pinned;

    // Save the updated chat back to the server
    await saveChat(fullChat); // saveChat already handles its own auth
    showToast(`Chat ${action}d successfully.`);
  } catch (error) {
    console.error(`Error performing chat action (${action}):`, error);
    showToast(`Failed to perform chat action: ${error.message}`);
  }
}

/**
 * Helper function to update the model selector button text.
 * @param {string} modelName The full model name.
 * @param {string} iconClass The font-awesome class.
 * @param {string} iconColor The color hex or name.
 */
function updateModelButton(modelName, iconClass, iconColor) {
  const btn = document.getElementById("current-model-btn");
  if (!btn) return;

  let shortName = modelName.split("/").pop();
  shortName = shortName.replace("Gemini ", "");

  btn.innerHTML = `<i class="fa-solid ${iconClass}" style="color:${iconColor};"></i> ${shortName} <i class="fa-solid fa-chevron-down chevron"></i>`;
}

function selectModel(element, modelName, iconClass, iconColor) {
  currentSelectedModel = modelName;
  updateModelButton(modelName, iconClass, iconColor); // Centralized function

  document
    .querySelectorAll(".check-icon")
    .forEach((icon) => (icon.style.display = "none"));
  document
    .querySelectorAll(".model-option")
    .forEach((opt) => opt.classList.remove("selected"));
  element.classList.add("selected");
  element.querySelector(".check-icon").style.display = "block";
  document.getElementById("model-dropdown")?.classList.remove("show");
}

// --- NEW: SWIPE DETECTION HANDLERS ---
function handleTouchStart(event) {
  // Only capture touch start to get initial X coordinate
  touchStartX = event.touches[0].clientX;
  touchEndX = 0; // Reset end X for new gesture
}

function handleTouchMove(event) {
  // Continuously capture touch end to calculate difference
  touchEndX = event.touches[0].clientX;
}

function handleTouchEnd(event) {
  if (window.innerWidth > 768 || !sidebar || touchEndX === 0) return; // Only apply on mobile and if touch moved

  const isSidebarOpen = sidebar.classList.contains("active");
  const diffX = touchEndX - touchStartX;

  // MODIFIED: Increased touchStartX boundary from 50px to 100px for easier opening swipe.
  const OPEN_TRIGGER_AREA = 300; // Pixels from left edge to start swipe-to-open

  if (Math.abs(diffX) > SWIPE_THRESHOLD) {
    if (diffX > 0 && touchStartX < OPEN_TRIGGER_AREA && !isSidebarOpen) {
      // Swipe right near the edge to open
      toggleSidebar();
      // Prevent scrolling on the main content right after opening
      event.preventDefault();
    } else if (diffX < 0 && isSidebarOpen) {
      // Check if swipe started on the sidebar itself (approximate check)
      // If the swipe starts roughly within the sidebar width (80% of screen), close it.
      if (touchStartX < window.innerWidth * 0.8) {
        // Swipe left to close
        closeSidebar();
      }
    }
  }
  // Reset touch coordinates is redundant here but good practice
  touchStartX = 0;
  touchEndX = 0;
}

/**
 * Finds the currently selected model and updates the button text.
 */
function initializeModelButton() {
  const currentModelElement = document.querySelector(".model-option.selected");
  if (currentModelElement) {
    const onclickAttr = currentModelElement.getAttribute("onclick");

    if (onclickAttr && typeof onclickAttr === "string") {
      const matches = onclickAttr.match(/'([^']*)'/g) || [];

      // Extract values safely
      const modelName = matches[0]?.replace(/'/g, "") || "unknown-model";
      const iconClass = matches[1]?.replace(/'/g, "") || "fa-bolt";
      const iconColor = matches[2]?.replace(/'/g, "") || "#FFD700";

      currentSelectedModel = modelName; // Ensure the global state is set
      updateModelButton(modelName, iconClass, iconColor);
    }
  }
}

/**
 * --- NEW: Updates the global UI based on the user's auth state. ---
 * @param {object|null} user - The Firebase user object, or null if logged out.
 */
function updateUIAfterAuth(user) {
  const loginSignupBtn = document.getElementById("login-signup-btn");
  const topProfileBtn = document.getElementById("top-profile-btn-user");
  const topProfileAvatar = document.getElementById("top-profile-avatar");
  const topProfileName = document.getElementById("top-profile-name");

  const navLoginLink = document.getElementById("nav-login-link");
  const navProfileWrapper = document.getElementById("nav-profile-wrapper");
  const navProfileAvatar = document.getElementById("nav-profile-avatar");
  const navProfileName = document.getElementById("nav-profile-name");

  const navLogoutLink = document.getElementById("nav-logout-link");
  const welcomeName = document.getElementById("welcome-name");

  if (user) {
    // --- User is Logged In ---
    const displayName = user.displayName || user.email.split("@")[0];
    const avatarInitial = (displayName[0] || "U").toUpperCase();

    if (loginSignupBtn) loginSignupBtn.style.display = "none";
    if (navLoginLink) navLoginLink.style.display = "none";

    if (topProfileBtn) {
      topProfileBtn.style.display = "flex";
      if (topProfileName) topProfileName.innerText = displayName;
      if (topProfileAvatar) topProfileAvatar.innerText = avatarInitial;
    }
    if (navProfileWrapper) {
      navProfileWrapper.style.display = "flex";
      if (navProfileName) navProfileName.innerText = displayName;
      if (navProfileAvatar) navProfileAvatar.innerText = avatarInitial;
    }
    if (navLogoutLink) navLogoutLink.style.display = "flex";
    if (welcomeName) welcomeName.innerText = `Hello, ${displayName}`;

    // Load user-specific data
    loadState(true); // Pass true to load chats
  } else {
    // --- User is Logged Out ---
    if (loginSignupBtn) loginSignupBtn.style.display = "flex";
    if (navLoginLink) navLoginLink.style.display = "flex";

    if (topProfileBtn) topProfileBtn.style.display = "none";
    if (navProfileWrapper) navProfileWrapper.style.display = "none";
    if (navLogoutLink) navLogoutLink.style.display = "none";
    if (welcomeName) welcomeName.innerText = "Hello, Guest";

    // Clear user-specific data
    recentChats = [];
    renderRecentChats();
    if (typeof resetChat === "function") {
      resetChat();
    }
    // Load non-chat state (theme, etc.)
    loadState(false); // Pass false to skip chat loading
  }
}

// --- GLOBAL EVENT LISTENERS ---

window.onclick = function (event) {
  if (!event.target.closest(".model-selector-wrapper")) {
    document.getElementById("model-dropdown")?.classList.remove("show");
  }
  if (event.target === document.getElementById("pricing-modal")) {
    togglePricing();
  }
  if (!event.target.closest(".chat-item-wrapper")) {
    document
      .querySelectorAll(".chat-context-menu")
      .forEach((menu) => menu.classList.remove("show"));
  }
  if (event.target === document.getElementById("confirm-delete-modal")) {
    document.getElementById("confirm-delete-modal").classList.remove("active");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Get shared elements
  body = document.body;
  toast = document.getElementById("toast");
  sidebar = document.getElementById("sidebar"); // Initialize global sidebar reference
  mobileOverlay = document.getElementById("mobile-overlay"); // Initialize global overlay reference

  // Get modal elements
  confirmDeleteModal = document.getElementById("confirm-delete-modal");
  confirmDeleteText = document.getElementById("confirm-delete-text");
  confirmDeleteCancelBtn = document.getElementById("confirm-delete-cancel");
  confirmDeleteConfirmBtn = document.getElementById("confirm-delete-confirm");

  // --- NEW: Initialize Firebase and Auth ---
  // auth.js must be loaded before this script in index.html
  if (typeof initializeFirebase === "function") {
    initializeFirebase(firebaseConfig);
  } else {
    console.error("auth.js not loaded correctly. Firebase auth will fail.");
  }

  // Listen for the 'authStateReady' event from auth.js
  // This event fires when auth.js knows if a user is logged in or out
  document.addEventListener("authStateReady", (e) => {
    currentUser = e.detail.user; // Set the global user
    updateUIAfterAuth(currentUser); // Update UI based on auth state
  });
  // --- END NEW ---

  // Initialize the model button display
  initializeModelButton(); // Use the new centralized function

  // --- NEW: Attach global swipe listeners ---
  document.addEventListener("touchstart", handleTouchStart, { passive: true });
  document.addEventListener("touchmove", handleTouchMove, { passive: false });
  document.addEventListener("touchend", handleTouchEnd, { passive: true });

  // --- NEW: Attach click listener to mobile overlay to close sidebar ---
  if (mobileOverlay) {
    mobileOverlay.addEventListener("click", closeSidebar);
  }

  // --- REMOVED: Old fake auth popup logic ---
});
