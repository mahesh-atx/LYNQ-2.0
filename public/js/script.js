/*
  script.js
  This file contains shared logic and state used across ALL pages.
  
  --- UPDATED: Refactored for modular architecture ---
  Global state is now managed by store.js
  Sidebar logic moved to sidebar.js
  Theme logic moved to theme.js
  Model selection moved to model-selector.js
  Chat list moved to chat-list.js
*/

// --- GLOBAL STATE ---
// NOTE: These variables are now provided by store.js via backward compatibility proxies
// Do NOT redeclare them here - they are accessed via window.mainChatHistory, window.currentUser, etc.

// --- API Configuration ---
const API_URL = "/api/generate";
const CHAT_API_BASE = "/api/chats"; // New base URL for chat CRUD

// --- SHARED DOM ELEMENTS ---
// NOTE: sidebar, mobileOverlay, and swipe variables are now in sidebar.js
let body;
let toast;
let confirmDeleteModal;
let confirmDeleteText;
let confirmDeleteCancelBtn;
let confirmDeleteConfirmBtn;

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
    if (forceState) {
      modalWrapper.classList.add("active");
      if (window.AccessibilityUtils) window.AccessibilityUtils.trapFocus(modalWrapper);
    } else {
      modalWrapper.classList.remove("active");
    }
  } else {
    const isActive = modalWrapper.classList.toggle("active");
    if (isActive && window.AccessibilityUtils) {
      window.AccessibilityUtils.trapFocus(modalWrapper);
    }
  }
}

function toggleChatSearch(show) {
  const searchWrapper = document.getElementById("chat-search-wrapper");
  const searchInput = document.getElementById("chat-search-input");

  if (!searchWrapper || !searchInput) return;

  if (show) {
    searchWrapper.style.display = "flex";
    searchInput.focus();
  } else {
    searchWrapper.style.display = "none";
    searchInput.value = "";
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

// function saveSidebarState removed - handles by sidebar.js

async function loadState(loadChats = true) {
  // 1. Initialize Theme and Sidebar from shared modules
  if (typeof initTheme === "function") initTheme();
  if (typeof initSidebar === "function") initSidebar();

  // 2. Extra page-specific state logic below


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
  canvasMode = false, // NEW: Canvas mode flag
  toolId = null, // NEW: Tool ID for backend prompt injection
  attachment = null // NEW: Attachment data
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

  // Determine effective canvas mode (web vs doc)
  let effectiveCanvasMode = canvasMode;
  
  if (canvasMode) {
    const p = prompt.toLowerCase();
    // Keywords indicating document/text intent rather than app/web intent
    if (
        p.includes("resume") || 
        p.includes("essay") || 
        p.includes("article") || 
        p.includes("cover letter") || 
        p.includes("summary") || 
        p.includes("report") || 
        p.includes("blog post") ||
        (p.includes("markdown") && !p.includes("html"))
    ) {
        effectiveCanvasMode = "doc";
        console.log("📝 Canvas Intent: Document Mode Detected");
    } else {
        effectiveCanvasMode = "web"; // Default to web/app mode
    }
    window.currentCanvasMode = effectiveCanvasMode; // EXPOSE GLOBAL
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        prompt: prompt,
        systemMessage: systemMessage,
        history: history,
        model: currentSelectedModel,
        max_tokens: 6000,
        // Use the button state instead of the keyword guess
        webSearch: webSearchActive,
        canvasMode: effectiveCanvasMode, // Use detected mode
        toolId: toolId, // NEW: Pass toolId
        attachment: attachment // NEW: Pass attachment
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

/* toggleTheme removed - handled by theme.js */

/* toggleSidebar and closeSidebar removed - handled by sidebar.js */

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
  if (modal) {
    const isActive = modal.classList.toggle("active");
    if (isActive && window.AccessibilityUtils) {
      window.AccessibilityUtils.trapFocus(modal);
    }
  }
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
  if (window.AccessibilityUtils) {
    window.AccessibilityUtils.trapFocus(confirmDeleteModal);
  }
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
  const headerProfileContainer = document.getElementById("header-profile-container");
  
  // Profile dropdown elements
  const dropdownName = document.getElementById("dropdown-name");
  const dropdownEmail = document.getElementById("dropdown-email");
  const headerAvatarInitial = document.getElementById("header-avatar-initial");
  const dropdownAvatarInitial = document.getElementById("dropdown-avatar-initial");

  const welcomeNameSpan = document.getElementById("welcome-name-span");
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

    // Show profile    // Update profile displays
    // --- NEW: Sync Sidebar Profile ---
    updateSidebarUserInfo(user);
    
    if (headerProfileContainer) { // Changed from headerProfileAvatar to headerProfileContainer
      headerProfileContainer.style.display = "flex";
    }
    
    // Update dropdown user info
    if (dropdownName) dropdownName.textContent = displayName;
    if (dropdownEmail) dropdownEmail.textContent = user.email || "";
    
    // Set default initial if no avatar is saved
    if (headerAvatarInitial) headerAvatarInitial.textContent = avatarInitial;
    if (dropdownAvatarInitial) dropdownAvatarInitial.textContent = avatarInitial;
    
    // Load saved avatar (if any)
    if (typeof loadSavedAvatar === "function") {
      loadSavedAvatar();
    }

    if (welcomeNameSpan) welcomeNameSpan.innerText = displayName;

    // Update sidebar user info
    updateSidebarUserInfo(user);

    // Load user-specific data
    loadState(true);
  } else {
    // --- User is Logged Out (Guest) ---
    // Show Login/Signup buttons and divider
    if (headerLoginBtn) headerLoginBtn.style.display = "flex";
    if (headerSignupBtn) headerSignupBtn.style.display = "flex";
    if (authDivider) authDivider.style.display = "inline";
    if (guestBanner) guestBanner.style.display = "flex";

    // Hide profile container
    if (headerProfileContainer) headerProfileContainer.style.display = "none";

    if (welcomeNameSpan) welcomeNameSpan.innerText = "Guest";

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

// --- NEW: Sidebar Profile Menu Functions ---
/* Sidebar Profile Menu functions removed - handled by sidebar.js */

// --- NEW: Header Model Dropdown Functions ---
// --- NEW: Header Model Dropdown Functions ---
// 1. Tier Dropdown (LYNQ / LYNQ Pro)
function toggleHeaderModelDropdown() {
  const dropdown = document.getElementById("header-model-dropdown");
  const btn = document.getElementById("header-model-btn");

  // Close other dropdown if open
  document.getElementById("model-list-dropdown")?.style.setProperty("display", "none");
  document.getElementById("model-list-btn")?.classList.remove("active");

  if (dropdown) {
    const isVisible = dropdown.style.display === "flex";
    dropdown.style.display = isVisible ? "none" : "flex";
    btn?.classList.toggle("active", !isVisible);
  }
}

// 2. Specific Model Dropdown (llama / gpt)
function toggleModelListDropdown() {
  const dropdown = document.getElementById("model-list-dropdown");
  const btn = document.getElementById("model-list-btn");

  // Close other dropdown if open
  document.getElementById("header-model-dropdown")?.style.setProperty("display", "none");
  document.getElementById("header-model-btn")?.classList.remove("active");

  if (dropdown) {
    const isVisible = dropdown.style.display === "flex";
    dropdown.style.display = isVisible ? "none" : "flex";
    btn?.classList.toggle("active", !isVisible);
  }
}

// Select Tier (LYNQ / Pro)
function selectHeaderTier(element, displayName, description) {
  const headerModelName = document.getElementById("header-model-name");
  if (headerModelName) {
    headerModelName.textContent = displayName;
  }

  // Update selected state in tier list
  const tierItems = document.querySelectorAll("#header-model-dropdown .model-dropdown-item");
  tierItems.forEach(item => item.classList.remove("selected"));
  element.classList.add("selected");

  // Close dropdown
  document.getElementById("header-model-dropdown").style.display = "none";
  document.getElementById("header-model-btn")?.classList.remove("active");
}

// Select Specific Model
function selectSpecificModel(element, modelName, displayName, description) {
  currentSelectedModel = modelName;

  // Update button text
  const listBtnName = document.getElementById("model-list-name");
  if (listBtnName) {
    listBtnName.textContent = displayName;
  }

  // Update active state in model list
  const modelItems = document.querySelectorAll("#model-list-dropdown .model-dropdown-item");
  modelItems.forEach(item => item.classList.remove("selected"));
  element.classList.add("selected");

  // Close dropdown
  document.getElementById("model-list-dropdown").style.display = "none";
  document.getElementById("model-list-btn")?.classList.remove("active");
}

/* Original selectHeaderModel preserved for backward compat if needed, 
   but we are switching to split functions. */
function selectHeaderModel(element, modelName, displayName, description) {
  selectSpecificModel(element, modelName, displayName, description);
}


// --- NEW: Update Sidebar User Info ---
// --- NEW: Update Sidebar User Info ---
function updateSidebarUserInfo(user, retryCount = 0) {
  const avatar = document.getElementById("sidebar-user-avatar");
  const name = document.getElementById("sidebar-user-name");
  const plan = document.getElementById("sidebar-user-plan");

  // If elements aren't found, retry a few times (waiting for injection)
  if ((!avatar || !name) && retryCount < 5) {
    console.log(`Sidebar elements not found, retrying sync (${retryCount + 1}/5)...`);
    setTimeout(() => updateSidebarUserInfo(user, retryCount + 1), 500);
    return;
  }

  if (user) {
    const displayName = user.displayName || user.email?.split("@")[0] || "User";
    const initial = displayName.charAt(0).toUpperCase();

    if (avatar) avatar.textContent = initial;
    if (name) name.textContent = displayName;
    if (plan) plan.textContent = "Free"; // Could be dynamic based on subscription
  } else {
    if (avatar) avatar.textContent = "U";
    if (name) name.textContent = "User";
    if (plan) plan.textContent = "Free";
  }
}

window.onclick = function (event) {
  // Close old model dropdown (input toolbar - if it exists)
  if (!event.target.closest(".model-selector-wrapper")) {
    document.getElementById("model-dropdown")?.classList.remove("show");
  }

  // Close header TIER dropdown
  if (!event.target.closest("#header-model-btn") && !event.target.closest("#header-model-dropdown")) {
    const headerDropdown = document.getElementById("header-model-dropdown");
    if (headerDropdown) headerDropdown.style.display = "none";
    document.getElementById("header-model-btn")?.classList.remove("active");
  }

  // Close header MODEL LIST dropdown
  if (!event.target.closest("#model-list-btn") && !event.target.closest("#model-list-dropdown")) {
    const listDropdown = document.getElementById("model-list-dropdown");
    if (listDropdown) listDropdown.style.display = "none";
    document.getElementById("model-list-btn")?.classList.remove("active");
  }

  // Close sidebar profile menu
  if (!event.target.closest(".sidebar-footer-profile")) {
    closeSidebarProfileMenu();
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

  // Close input model dropdown
  if (!event.target.closest(".input-model-selector")) {
    const inputModelDropdown = document.getElementById("input-model-dropdown");
    if (inputModelDropdown) inputModelDropdown.classList.remove("active");
    document.getElementById("input-model-btn")?.classList.remove("active");
  }

  // Close attach dropdown
  if (!event.target.closest(".attach-dropdown-wrapper")) {
    const attachDropdown = document.getElementById("attach-dropdown");
    if (attachDropdown) attachDropdown.classList.remove("active");
  }

  // Close tools dropdown
  if (!event.target.closest(".tools-dropdown-wrapper")) {
    const toolsDropdown = document.getElementById("tools-dropdown");
    if (toolsDropdown) toolsDropdown.classList.remove("active");
  }
};

/* --- INPUT MODEL SELECTOR FUNCTIONS --- */
// NOTE: toggleInputModelDropdown, selectInputModel, fetchAvailableModels, 
// and renderModelDropdown are defined in model-selector.js
// (removed duplicates to prevent override)

/* --- SELECTED TOOL INDICATOR FUNCTIONS --- */
// NOTE: currentSelectedTool is now managed by store.js

function showSelectedToolIndicator(toolId, iconClass, toolName, hideXButton = false) {
  const indicator = document.getElementById("selected-tool-indicator");
  const iconEl = document.getElementById("selected-tool-icon");
  const labelEl = document.getElementById("selected-tool-label");
  const xBtn = document.querySelector(".deselect-tool-btn");
  const toolsWrapper = document.querySelector(".tools-dropdown-wrapper");

  if (indicator && iconEl) {
    iconEl.className = iconClass;
    if (labelEl && toolName) {
      labelEl.textContent = toolName;
    }
    // Hide or show X button based on parameter
    if (xBtn) {
      xBtn.style.display = hideXButton ? "none" : "flex";
    }
    indicator.style.display = "flex";
    currentSelectedTool = toolId;
    
    // Hide the tools button wrapper when a tool is selected
    if (toolsWrapper) {
      toolsWrapper.style.display = "none";
    }
  }
}

function deselectTool() {
  const indicator = document.getElementById("selected-tool-indicator");
  if (indicator) {
    indicator.style.display = "none";
  }

  currentSelectedTool = null;

  // Reset currentToolId (for library tools)
  if (typeof currentToolId !== "undefined") {
    currentToolId = null;
  }

  // Restore Tools button if it was hidden
  const toolsWrapper = document.querySelector(".tools-dropdown-wrapper");
  if (toolsWrapper) {
    toolsWrapper.style.display = "flex";
  }

  // Deselect canvas mode if active
  if (typeof isCanvasModeActive !== "undefined" && isCanvasModeActive) {
    if (typeof toggleCanvasMode === "function") toggleCanvasMode(false);
  }

  // Deselect web search if active
  if (typeof isWebSearchActive !== "undefined" && isWebSearchActive) {
    isWebSearchActive = false;
    const btn = document.getElementById("web-search-toggle-btn");
    if (btn) btn.classList.remove("active");
  }

  // Toast removed for cleaner UX
}

/* --- DESKTOP TOOL HANDLERS --- */
function handleDesktopTool(action) {
  // Close dropdown and remove active state from button
  const dropdown = document.getElementById("tools-dropdown");
  const toolsBtn = document.getElementById("tools-btn");
  if (dropdown) dropdown.classList.remove("active");
  if (toolsBtn) toolsBtn.classList.remove("active");

  // Handle tool selection
  switch (action) {
    case 'image':
      showSelectedToolIndicator('imagegen', 'fa-solid fa-paintbrush', 'Create Image');
      break;
    case 'deep-research':
      showSelectedToolIndicator('deepresearch', 'fa-solid fa-microscope', 'Deep Research');
      break;
    case 'shopping':
      showSelectedToolIndicator('shoppingresearch', 'fa-solid fa-bag-shopping', 'Shopping');
      break;
    case 'thinking':
      showSelectedToolIndicator('thinking', 'fa-solid fa-brain', 'Thinking');
      break;
  }
}

function handleDesktopAttach(action) {
  // Close attach dropdown
  const dropdown = document.getElementById("attach-dropdown");
  if (dropdown) dropdown.classList.remove("active");

  const fileInput = document.getElementById('file-upload');
  if (!fileInput) return;

  switch (action) {
    case 'camera':
      fileInput.setAttribute('accept', 'image/*');
      fileInput.setAttribute('capture', 'environment');
      fileInput.click();
      setTimeout(() => {
        fileInput.removeAttribute('capture');
        fileInput.setAttribute('accept', 'application/pdf');
      }, 1000);
      break;
    case 'photos':
      fileInput.setAttribute('accept', 'image/*');
      fileInput.click();
      setTimeout(() => fileInput.setAttribute('accept', 'application/pdf'), 1000);
      break;
    case 'files':
      fileInput.setAttribute('accept', '*/*');
      fileInput.click();
      setTimeout(() => fileInput.setAttribute('accept', 'application/pdf'), 1000);
      break;
  }
}

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

/* --- MOBILE ACTION SHEET LOGIC --- */
function toggleMobileActionSheet(show) {
  const sheet = document.getElementById("mobile-action-sheet");
  const overlay = document.getElementById("mobile-sheet-overlay");

  if (show) {
    sheet.classList.add("active");
    overlay.classList.add("active");
  } else {
    sheet.classList.remove("active");
    overlay.classList.remove("active");
  }
}

function handleMobileAction(action) {
  toggleMobileActionSheet(false);

  setTimeout(() => {
    switch (action) {
      case 'camera':
        const fileInputC = document.getElementById('file-upload');
        if (fileInputC) {
          fileInputC.setAttribute('accept', 'image/*');
          fileInputC.setAttribute('capture', 'environment');
          fileInputC.click();
          setTimeout(() => {
            fileInputC.removeAttribute('capture');
            fileInputC.setAttribute('accept', 'application/pdf');
          }, 1000);
        }
        break;
      case 'photos':
        const fileInputP = document.getElementById('file-upload');
        if (fileInputP) {
          fileInputP.setAttribute('accept', 'image/*');
          fileInputP.click();
          setTimeout(() => fileInputP.setAttribute('accept', 'application/pdf'), 1000);
        }
        break;
      case 'files':
        const fileInputF = document.getElementById('file-upload');
        if (fileInputF) {
          fileInputF.setAttribute('accept', '*/*');
          fileInputF.click();
          setTimeout(() => fileInputF.setAttribute('accept', 'application/pdf'), 1000);
        }
        break;
      case 'image':
        showSelectedToolIndicator('imagegen', 'fa-solid fa-paintbrush', 'Create Image');
        break;
      case 'deep-research':
        showSelectedToolIndicator('deepresearch', 'fa-solid fa-microscope', 'Deep Research');
        break;
      case 'shopping':
        showSelectedToolIndicator('shoppingresearch', 'fa-solid fa-bag-shopping', 'Shopping');
        break;
      case 'thinking':
        showSelectedToolIndicator('thinking', 'fa-solid fa-brain', 'Thinking');
        break;
      case 'web-search':
        // Just call toggleWebSearch - it handles everything including indicator
        if (typeof toggleWebSearch === "function") {
          toggleWebSearch();
        }
        break;
      case 'canvas':
        // Just call toggleCanvasMode - it handles everything including indicator
        if (typeof toggleCanvasMode === "function") {
          toggleCanvasMode();
        }
        break;
    }
  }, 300);
}

/* --- MOBILE MODEL SHEET FUNCTIONS --- */
// NOTE: Mobile model sheet functions moved to model-selector.js
// - toggleMobileModelSheet()
// - initModelSheetSwipe()
// - selectMobileSheetModel()
// - handleMobileModelClick()

// ============================================
// === PROFILE AVATAR PICKER FUNCTIONALITY ===
// ============================================

// Preset avatars - fun emoji-based avatars with gradient backgrounds
const PRESET_AVATARS = [
  { type: 'emoji', emoji: '🦊', bg: 'linear-gradient(135deg, #ff9a56 0%, #ff6b6b 100%)' },
  { type: 'emoji', emoji: '🐱', bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { type: 'emoji', emoji: '🐼', bg: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { type: 'emoji', emoji: '🦁', bg: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
  { type: 'emoji', emoji: '🐸', bg: 'linear-gradient(135deg, #96e6a1 0%, #d4fc79 100%)' },
  { type: 'emoji', emoji: '🦄', bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { type: 'emoji', emoji: '🐲', bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { type: 'emoji', emoji: '🦋', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { type: 'emoji', emoji: '🌸', bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { type: 'emoji', emoji: '🌊', bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { type: 'emoji', emoji: '🔥', bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { type: 'emoji', emoji: '⚡', bg: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
  { type: 'emoji', emoji: '🎮', bg: 'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)' },
  { type: 'emoji', emoji: '🚀', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { type: 'emoji', emoji: '🎨', bg: 'linear-gradient(135deg, #ff9a56 0%, #ff6b6b 100%)' },
  { type: 'emoji', emoji: '💎', bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { type: 'emoji', emoji: '🌙', bg: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)' },
  { type: 'emoji', emoji: '☀️', bg: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
  { type: 'emoji', emoji: '🍀', bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { type: 'emoji', emoji: '🎪', bg: 'linear-gradient(135deg, #fc5c7d 0%, #6a82fb 100%)' },
];

let selectedAvatarData = null;

// Toggle Header Profile Dropdown
function toggleHeaderProfileMenu(forceState) {
  const dropdown = document.getElementById('header-profile-dropdown');
  if (!dropdown) return;
  
  if (forceState !== undefined) {
    dropdown.classList.toggle('active', forceState);
  } else {
    dropdown.classList.toggle('active');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const container = document.getElementById('header-profile-container');
  const dropdown = document.getElementById('header-profile-dropdown');
  if (dropdown && container && !container.contains(e.target)) {
    dropdown.classList.remove('active');
  }
});

// Open Avatar Picker Modal
function openAvatarPicker() {
  toggleHeaderProfileMenu(false); // Close dropdown
  
  const modal = document.getElementById('avatar-picker-modal');
  if (modal) {
    modal.classList.add('active');
    populateAvatarGrid();
  }
}

// Close Avatar Picker Modal
function closeAvatarPicker() {
  const modal = document.getElementById('avatar-picker-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  selectedAvatarData = null;
}

// Switch Avatar Picker Tabs
function switchAvatarTab(tab) {
  const tabs = document.querySelectorAll('.avatar-tab');
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector(`.avatar-tab[data-tab="${tab}"]`)?.classList.add('active');
  
  const avatarGrid = document.getElementById('avatar-grid');
  const uploadSection = document.getElementById('avatar-upload-section');
  
  if (tab === 'avatars') {
    if (avatarGrid) avatarGrid.style.display = 'grid';
    if (uploadSection) uploadSection.style.display = 'none';
  } else {
    if (avatarGrid) avatarGrid.style.display = 'none';
    if (uploadSection) uploadSection.style.display = 'block';
  }
}

// Populate Avatar Grid
function populateAvatarGrid() {
  const grid = document.getElementById('avatar-grid');
  if (!grid) return;
  
  grid.innerHTML = PRESET_AVATARS.map((avatar, index) => `
    <button class="avatar-option" onclick="selectPresetAvatar(${index})" data-index="${index}" style="background: ${avatar.bg}">
      <span class="avatar-emoji">${avatar.emoji}</span>
    </button>
  `).join('');
}

// Select Preset Avatar
function selectPresetAvatar(index) {
  const avatar = PRESET_AVATARS[index];
  selectedAvatarData = { type: 'preset', index, ...avatar };
  
  // Update UI selection
  document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
  document.querySelector(`.avatar-option[data-index="${index}"]`)?.classList.add('selected');
}

// Handle Avatar Upload
function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image must be less than 2MB');
    return;
  }
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    selectedAvatarData = { type: 'upload', dataUrl: e.target.result };
    
    // Show preview in dropzone
    const dropzone = document.getElementById('avatar-dropzone');
    if (dropzone) {
      dropzone.innerHTML = `
        <img src="${e.target.result}" alt="Preview" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;">
        <p style="margin-top: 12px;">Image selected! Click Save to apply.</p>
      `;
    }
  };
  reader.readAsDataURL(file);
}

// Save Selected Avatar
function saveSelectedAvatar() {
  if (!selectedAvatarData) {
    showToast('Please select an avatar first');
    return;
  }
  
  // Save to localStorage
  localStorage.setItem('lynq-user-avatar', JSON.stringify(selectedAvatarData));
  
  // Update all avatar displays
  updateAvatarDisplays(selectedAvatarData);
  
  closeAvatarPicker();
  showToast('Avatar updated successfully!');
}

// Update all avatar displays across the UI
function updateAvatarDisplays(avatarData) {
  const headerAvatarImg = document.getElementById('header-avatar-img');
  const headerAvatarInitial = document.getElementById('header-avatar-initial');
  const dropdownAvatarImg = document.getElementById('dropdown-avatar-img');
  const dropdownAvatarInitial = document.getElementById('dropdown-avatar-initial');
  const headerAvatar = document.getElementById('header-profile-avatar');
  const dropdownAvatar = document.getElementById('dropdown-avatar');
  
  if (avatarData.type === 'upload' && avatarData.dataUrl) {
    // Show uploaded image
    if (headerAvatarImg) {
      headerAvatarImg.src = avatarData.dataUrl;
      headerAvatarImg.style.display = 'block';
    }
    if (headerAvatarInitial) headerAvatarInitial.style.display = 'none';
    if (dropdownAvatarImg) {
      dropdownAvatarImg.src = avatarData.dataUrl;
      dropdownAvatarImg.style.display = 'block';
    }
    if (dropdownAvatarInitial) dropdownAvatarInitial.style.display = 'none';
    
    // Reset background to simple color
    if (headerAvatar) headerAvatar.style.background = 'transparent';
    if (dropdownAvatar) dropdownAvatar.style.background = 'transparent';
  } else if (avatarData.type === 'preset' || avatarData.type === 'emoji') {
    // Show emoji avatar
    if (headerAvatarImg) headerAvatarImg.style.display = 'none';
    if (headerAvatarInitial) {
      headerAvatarInitial.style.display = 'flex';
      headerAvatarInitial.textContent = avatarData.emoji;
      headerAvatarInitial.style.fontSize = '1.3rem';
    }
    if (dropdownAvatarImg) dropdownAvatarImg.style.display = 'none';
    if (dropdownAvatarInitial) {
      dropdownAvatarInitial.style.display = 'flex';
      dropdownAvatarInitial.textContent = avatarData.emoji;
      dropdownAvatarInitial.style.fontSize = '1.5rem';
    }
    
    // Set gradient background
    if (headerAvatar) headerAvatar.style.background = avatarData.bg;
    if (dropdownAvatar) dropdownAvatar.style.background = avatarData.bg;
  }
  
  // Also update profile page avatar if it exists
  const profileAvatarEl = document.getElementById('profile-avatar');
  const profileAvatarImg = document.getElementById('profile-avatar-img');
  const profileAvatarInitial = document.getElementById('profile-avatar-initial');
  
  if (profileAvatarEl) {
    if (avatarData.type === 'upload' && avatarData.dataUrl) {
      if (profileAvatarImg) {
        profileAvatarImg.src = avatarData.dataUrl;
        profileAvatarImg.style.display = 'block';
      }
      if (profileAvatarInitial) profileAvatarInitial.style.display = 'none';
      profileAvatarEl.style.background = 'transparent';
    } else if (avatarData.type === 'preset' || avatarData.type === 'emoji') {
      if (profileAvatarImg) profileAvatarImg.style.display = 'none';
      if (profileAvatarInitial) {
        profileAvatarInitial.style.display = 'flex';
        profileAvatarInitial.textContent = avatarData.emoji;
        profileAvatarInitial.style.fontSize = '3rem';
      }
      profileAvatarEl.style.background = avatarData.bg;
    }
  }
}

// Load saved avatar on page load
function loadSavedAvatar() {
  const saved = localStorage.getItem('lynq-user-avatar');
  if (saved) {
    try {
      const avatarData = JSON.parse(saved);
      updateAvatarDisplays(avatarData);
    } catch (e) {
      console.error('Error loading saved avatar:', e);
    }
  }
}

// Initialize avatar on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadSavedAvatar, 100);

  // --- Mobile Action Sheet Swipe to Close ---
  const mobileSheet = document.getElementById('mobile-action-sheet');
  
  if (mobileSheet) {
    let sheetStartY = 0;
    let sheetCurrentY = 0;
    
    mobileSheet.addEventListener('touchstart', (e) => {
      // Logic to prevent dragging if content is scrolled down (optional)
      // For now, simple drag down
      const scrollTop = mobileSheet.querySelector('.sheet-models-list')?.scrollTop || 0;
      if (scrollTop > 0) return; // Don't drag sheet if list is scrolled

      sheetStartY = e.touches[0].clientY;
      sheetCurrentY = sheetStartY;
      mobileSheet.style.transition = 'none';
    }, { passive: true });

    mobileSheet.addEventListener('touchmove', (e) => {
      sheetCurrentY = e.touches[0].clientY;
      const deltaY = sheetCurrentY - sheetStartY;

      if (deltaY > 0) { // Dragging down
        mobileSheet.style.transform = `translateY(${deltaY}px)`;
        e.preventDefault(); // Prevent scrolling body
      }
    }, { passive: false });

    mobileSheet.addEventListener('touchend', () => {
      const deltaY = sheetCurrentY - sheetStartY;
      mobileSheet.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';

      if (deltaY > 100) { // Threshold to close
        // Force slide down to hidden
        mobileSheet.style.transform = 'translateY(100%)';
        
        // Remove active class after transition
        setTimeout(() => {
          toggleMobileActionSheet(false);
          // Wait a tick before clearing transform so it doesn't flash back
          setTimeout(() => {
             mobileSheet.style.transform = ''; 
          }, 50);
        }, 300);
      } else {
        mobileSheet.style.transform = '';
      }
    });
  }
});
