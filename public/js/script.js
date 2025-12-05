/*
  script.js
  This file contains shared logic and state used across ALL pages.
  
  --- UPDATED: Fixed Auth Flicker & Theme Logic ---
*/

// --- GLOBAL STATE & API CONFIG ---
let mainChatHistory = [];

// Firebase config is now centralized in auth.js (FIREBASE_CONFIG)

let currentUser = null; // Store the logged-in Firebase user object

// recentChats will be populated asynchronously
let recentChats = [];
let isNewChat = true;
// activeChatId tracks the chatId (Number from Date.now())
let activeChatId = null;

// --- API Configuration ---
const API_URL = "/api/generate";
const CHAT_API_BASE = "/api/chats"; // New base URL for chat CRUD
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

// --- NEW: Auth Helper ---
function handleAuthError() {
  console.error("Authentication error. Token may be invalid. Logging out.");
  if (typeof logoutUser === "function") {
    logoutUser();
  }
  showToast("Session expired. Please log in again.");
}

async function saveChat(chatData) {
  // --- NEW: Auth Check ---
  if (!currentUser) return null;
  const token = await getAuthToken();
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
        Authorization: `Bearer ${token}`,
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

    if (activeChatId) {
      const activeChatExists = recentChats.some((c) => c.id == activeChatId);
      if (!activeChatExists) {
        activeChatId = null;
        isNewChat = true;
        if (typeof resetChat === "function") resetChat();
      }
    }

    // REMOVED: The logic to call loadChat(activeChatId) was here.
    // It has been moved to loadState() to prevent UI resets during chatting.
  } catch (error) {
    console.error("Error loading all chats:", error);
    showToast(`Failed to load chats: ${error.message}.`);
  }
}

// --- SHARED FUNCTIONS ---

function toggleProfilePopup(forceState) {
  const modalWrapper = document.getElementById("profile-popup"); // This is the overlay
  if (!modalWrapper) return;

  // 1. Detect Sidebar Click
  const activeEl = document.activeElement;
  const isSidebar =
    activeEl &&
    (activeEl.id === "nav-profile-wrapper" ||
      activeEl.closest("#nav-profile-wrapper"));

  // 2. Apply Position Class
  // Only apply logic if we are about to OPEN it (currently inactive)
  if (!modalWrapper.classList.contains("active")) {
    if (isSidebar) {
      modalWrapper.classList.add("sidebar-mode");
    } else {
      modalWrapper.classList.remove("sidebar-mode");
    }
  }

  // 3. Toggle Visibility
  if (forceState !== undefined) {
    if (forceState) modalWrapper.classList.add("active");
    else modalWrapper.classList.remove("active");
  } else {
    modalWrapper.classList.toggle("active");
  }
}

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

async function getSystemMessage(taskSpecificContext) {
  // If there's no task-specific context, return null so backend uses its loaded systemprompt.txt
  const customInstructions = localStorage.getItem("lynq_custom_instructions");

  // If no custom instructions and no context, let backend handle the system prompt
  if (!customInstructions && !taskSpecificContext) {
    return null;
  }

  // Build prompt only if we have custom instructions or context
  let finalPrompt = "";

  if (customInstructions) {
    finalPrompt = customInstructions;
  }

  if (taskSpecificContext) {
    finalPrompt = finalPrompt
      ? `${finalPrompt}\n\n---\n\n${taskSpecificContext}`
      : taskSpecificContext;
  }

  return finalPrompt || null;
}

function saveSidebarState(isCollapsed) {
  localStorage.setItem(
    "lynq-sidebar-collapsed",
    isCollapsed ? "true" : "false"
  );
}

async function loadState(loadChats = true) {
  // Theme check
  const savedTheme = localStorage.getItem("lynq-theme");

  // NOTE: Inline script handles body class. We just sync the toggle.
  const settingsToggle = document.getElementById("settings-theme-toggle");

  if (savedTheme === "light") {
    document.body.classList.remove("dark-mode");
    if (settingsToggle) settingsToggle.checked = false;
  } else {
    document.body.classList.add("dark-mode");
    localStorage.setItem("lynq-theme", "dark");
    if (settingsToggle) settingsToggle.checked = true;
  }
  // --- Accent Color Check ---
  const savedAccent = localStorage.getItem("lynq-accent-color");
  if (savedAccent) {
    // Apply to the global CSS variable
    document.documentElement.style.setProperty("--bg-gold", savedAccent);

    // Optional: Try to update the Logo icon if it exists on this page
    // (Wait slightly for DOM to be ready if needed, or apply directly)
    setTimeout(() => {
      const logoIcon = document.querySelector(".top-logo-title i.fa-bolt");
      if (logoIcon) logoIcon.style.color = savedAccent;
    }, 50);
  }

  // Sidebar state check - FORCE CLOSED DEFAULT
  if (sidebar) {
    if (window.innerWidth > 768) {
      // Force collapsed class on desktop load
      sidebar.classList.add("collapsed");
    } else {
      // Ensure inactive on mobile load
      sidebar.classList.remove("active");
    }
  }

  // Check URL for active chat ID on initial load
  const urlParams = new URLSearchParams(window.location.search);
  const urlChatId = urlParams.get("chatId");

  if (urlChatId) {
    activeChatId = parseInt(urlChatId, 10);
    isNewChat = false;
  }

  // 2. Load the recent chats from the server (if user is logged in)
  if (loadChats) {
    await loadAllChats();

    // MOVED HERE: Load the active chat content only on initial state load
    if (
      (window.location.pathname.endsWith("index.html") ||
        window.location.pathname.endsWith("/")) &&
      typeof loadChat === "function" &&
      activeChatId
    ) {
      await loadChat(activeChatId);
    }
  }
}

// script.js

async function getApiResponse(
  prompt,
  systemMessage = null,
  history = [],
  signal = null,
  webSearchActive = false,
  canvasMode = false // NEW: Canvas mode flag
) {
  // --- MODIFIED: Auth is now optional ---
  let headers = { "Content-Type": "application/json" };

  // Only add Auth header if a user is logged in
  if (currentUser) {
    const token = await getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      console.warn("Could not get auth token for logged-in user.");
    }
  }

  /* --- PRESERVED KEYWORD GUESSING LOGIC (COMMENTED OUT) ---
  const searchTriggers = [
    "search",
    "find",
    "google",
    "latest",
    "news",
    "current",
    "price",
    "who is",
    "what is",
  ];
  const shouldSearch = searchTriggers.some((keyword) =>
    prompt.toLowerCase().includes(keyword)
  );
  */

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        prompt: prompt,
        systemMessage: systemMessage,
        history: history,
        model: currentSelectedModel,
        // Use the button state instead of the keyword guess
        webSearch: webSearchActive,
        canvasMode: canvasMode, // NEW: Pass canvas mode flag
      }),
      signal: signal,
    });

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
    navLink.href = `#chat-${chat.id}`;

    navLink.onclick = async (e) => {
      e.preventDefault(); // CRITICAL FIX: Stop the page refresh!

      // Update global state immediately
      activeChatId = chat.id;
      isNewChat = false;

      document
        .querySelectorAll("#recent-chats-container .nav-item")
        .forEach((item) => item.classList.remove("active"));
      navLink.classList.add("active");

      const newUrl = window.location.pathname + `?chatId=${chat.id}`;
      history.pushState({ chatId: activeChatId }, chat.title, newUrl);

      if (typeof loadChat === "function") {
        await loadChat(activeChatId);
      }

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
                <i class="fa-solid fa-thumbtack"></i> ${chat.pinned ? "Unpin" : "Pin"
      }
            </div>
            <div class="context-item" onclick="chatAction('rename', '${chat.id
      }')">
                <i class="fa-solid fa-pen"></i> Rename
            </div>
            <div class="context-item" onclick="chatAction('delete', '${chat.id
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

    fullChat.title = chat.title;
    fullChat.pinned = chat.pinned;

    await saveChat(fullChat);
    showToast(`Chat ${action}d successfully.`);
  } catch (error) {
    console.error(`Error performing chat action (${action}):`, error);
    showToast(`Failed to perform chat action: ${error.message}`);
  }
}

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
  touchStartX = event.touches[0].clientX;
  touchEndX = 0;
}

function handleTouchMove(event) {
  touchEndX = event.touches[0].clientX;
}

function handleTouchEnd(event) {
  if (window.innerWidth > 768 || !sidebar || touchEndX === 0) return;

  const isSidebarOpen = sidebar.classList.contains("active");
  const diffX = touchEndX - touchStartX;
  const OPEN_TRIGGER_AREA = 300;

  if (Math.abs(diffX) > SWIPE_THRESHOLD) {
    if (diffX > 0 && touchStartX < OPEN_TRIGGER_AREA && !isSidebarOpen) {
      toggleSidebar();
      event.preventDefault();
    } else if (diffX < 0 && isSidebarOpen) {
      if (touchStartX < window.innerWidth * 0.8) {
        closeSidebar();
      }
    }
  }
  touchStartX = 0;
  touchEndX = 0;
}

function initializeModelButton() {
  const currentModelElement = document.querySelector(".model-option.selected");
  if (currentModelElement) {
    const onclickAttr = currentModelElement.getAttribute("onclick");

    if (onclickAttr && typeof onclickAttr === "string") {
      const matches = onclickAttr.match(/'([^']*)'/g) || [];

      const modelName = matches[0]?.replace(/'/g, "") || "unknown-model";
      const iconClass = matches[1]?.replace(/'/g, "") || "fa-bolt";
      const iconColor = matches[2]?.replace(/'/g, "") || "#FFD700";

      currentSelectedModel = modelName;
      updateModelButton(modelName, iconClass, iconColor);
    }
  }
}

/**
 * --- NEW: Updates the global UI based on the user's auth state. ---
 * @param {object|null} user - The Firebase user object, or null if logged out.
 */
function updateUIAfterAuth(user) {
  // Top Bar Elements
  const headerLoginBtn = document.getElementById("header-login-btn");
  const headerSignupBtn = document.getElementById("header-signup-btn");
  const authDivider = document.getElementById("auth-divider");
  const headerGreeting = document.getElementById("header-greeting");
  const greetingName = document.getElementById("greeting-name");

  const welcomeName = document.getElementById("welcome-name");
  const guestBanner = document.getElementById("guest-banner");

  if (user) {
    // --- User is Logged In ---
    const displayName = user.displayName || user.email.split("@")[0];
    const avatarInitial = (displayName[0] || "U").toUpperCase();

    // Hide Login/Signup buttons and divider
    if (headerLoginBtn) headerLoginBtn.style.display = "none";
    if (headerSignupBtn) headerSignupBtn.style.display = "none";
    if (authDivider) authDivider.style.display = "none";
    if (guestBanner) guestBanner.style.display = "none";

    // Show greeting with user name
    if (headerGreeting) {
      headerGreeting.style.display = "flex";
      if (greetingName) greetingName.innerText = displayName;
    }

    if (welcomeName) welcomeName.innerText = `Hello, ${displayName}`;

    // Load user-specific data
    loadState(true);
  } else {
    // --- User is Logged Out (Guest) ---
    // Show Login/Signup buttons and divider
    if (headerLoginBtn) headerLoginBtn.style.display = "flex";
    if (headerSignupBtn) headerSignupBtn.style.display = "flex";
    if (authDivider) authDivider.style.display = "inline";
    if (guestBanner) guestBanner.style.display = "flex";

    // Hide greeting
    if (headerGreeting) headerGreeting.style.display = "none";

    if (welcomeName) welcomeName.innerText = "Hello, Guest";

    // Clear user-specific data
    recentChats = [];
    renderRecentChats();
    if (typeof resetChat === "function") {
      resetChat();
    }
    // Load non-chat state (theme, etc.)
    loadState(false);
  }
  const loader = document.getElementById("skeleton-loader");
  if (loader) {
    loader.style.opacity = "0";
    setTimeout(() => {
      loader.style.display = "none";
    }, 300); // Wait for fade out
  }
}

window.onclick = function (event) {
  if (!event.target.closest(".model-selector-wrapper")) {
    document.getElementById("model-dropdown")?.classList.remove("show");
  }
  if (event.target === document.getElementById("pricing-modal")) {
    togglePricing();
  }
  if (event.target === document.getElementById("profile-popup")) {
    toggleProfilePopup(false); // Close when clicking background
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
  sidebar = document.getElementById("sidebar");
  mobileOverlay = document.getElementById("mobile-overlay");

  // Get modal elements
  confirmDeleteModal = document.getElementById("confirm-delete-modal");
  confirmDeleteText = document.getElementById("confirm-delete-text");
  confirmDeleteCancelBtn = document.getElementById("confirm-delete-cancel");
  confirmDeleteConfirmBtn = document.getElementById("confirm-delete-confirm");

  if (typeof initializeFirebase === "function") {
    initializeFirebase(); // Uses centralized FIREBASE_CONFIG from auth.js
  } else {
    console.error("auth.js not loaded correctly. Firebase auth will fail.");
  }

  document.addEventListener("authStateReady", (e) => {
    currentUser = e.detail.user;
    updateUIAfterAuth(currentUser);
  });

  initializeModelButton();

  document.addEventListener("touchstart", handleTouchStart, { passive: true });
  document.addEventListener("touchmove", handleTouchMove, { passive: false });
  document.addEventListener("touchend", handleTouchEnd, { passive: true });

  if (mobileOverlay) {
    mobileOverlay.addEventListener("click", closeSidebar);
  }
});
