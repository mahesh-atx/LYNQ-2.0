/*
  script.js
  This file contains shared logic and state used across ALL pages.
  UI functions specific to index.html (chat/canvas) are now in home.js.
  
  --- UPDATED: LocalStorage replaced with MongoDB API calls ---
*/

// --- GLOBAL STATE & API CONFIG ---
let mainChatHistory = [];
let codeHistory = [];

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

// --- NEW: API FUNCTIONS FOR CHAT PERSISTENCE ---
// --- SIMPLE LOGIN HANDLER (FAKE LOGIN FOR NOW) ---
// --- SIMPLE LOGIN HANDLER (FAKE LOGIN FOR NOW) ---
function handleLogin() {
  localStorage.setItem("lynq_user_logged_in", "true");
  localStorage.removeItem("lynq_skip_auth");

  if (typeof showToast === "function") {
    showToast("Logged in successfully.");
  }
}

// --- AUTH POPUP HELPERS ---
function showAuthPopup() {
  const popup = document.getElementById("auth-popup");
  if (popup) {
    popup.classList.remove("auth-hidden");
  }
}

function closeAuthPopup(event) {
  if (event) event.preventDefault();
  localStorage.setItem("lynq_skip_auth", "true");
  const popup = document.getElementById("auth-popup");
  if (popup) {
    popup.classList.add("auth-hidden");
  }
}

function redirectToLogin() {
  window.location.href = "login.html?action=login"; // MODIFIED: Added explicit parameter
}

function redirectToSignup() {
  window.location.href = "login.html?action=signup";
}

/**
 * Saves or updates a chat to the MongoDB backend.
 * @param {object} chatData The chat object to save ({id, title, history, pinned}).
 */
async function saveChat(chatData) {
  try {
    const response = await fetch(`${CHAT_API_BASE}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatData),
    });

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
  try {
    const response = await fetch(CHAT_API_BASE);
    if (!response.ok) {
      throw new Error("Failed to fetch recent chats.");
    }
    recentChats = await response.json();
    renderRecentChats();

    // If a chat was previously active, ensure it's loaded back if still exists
    if (activeChatId) {
      const activeChatExists = recentChats.some((c) => c.id === activeChatId);
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
      activeChatId // FIX: Only attempt to load if activeChatId is valid
    ) {
      // Load the full history for the active chat
      await loadChat(activeChatId);
    }
  } catch (error) {
    console.error("Error loading all chats:", error);
    showToast(
      `Failed to load chats: ${error.message}. Using temporary storage.`
    );
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
  // Keeping localStorage for non-chat state like settings for simplicity, though in a real app these should also be dynamic.
  const customInstructions = localStorage.getItem("lynq_custom_instructions");
  let finalPrompt = systemPromptCache;

  if (customInstructions) {
    finalPrompt = `${customInstructions}\n\n---\n\n${finalPrompt}`;
  }

  // 3. Add context (PDF/Canvas) specific instructions
  return `${finalPrompt}\n\n${taskSpecificContext}`;
}

// --- REMOVED: saveState function (replaced by saveChat) ---

// --- NEW: Function to save sidebar state to localStorage ---
function saveSidebarState(isCollapsed) {
  localStorage.setItem(
    "lynq-sidebar-collapsed",
    isCollapsed ? "true" : "false"
  );
}

// --- UPDATED: loadState function (now async and loads sidebar state) ---
async function loadState() {
  const sidebar = document.getElementById("sidebar");
  // 1. Load non-chat state from localStorage (theme, model, etc.)

  // Theme check
  const savedTheme = localStorage.getItem("lynq-theme");
  if (savedTheme === "light") {
    document.body.classList.remove("dark-mode");
  } else {
    document.body.classList.add("dark-mode");
    localStorage.setItem("lynq-theme", "dark");
  }

  // Sidebar state check
  const isSidebarCollapsed = localStorage.getItem("lynq-sidebar-collapsed");

  if (sidebar) {
    if (isSidebarCollapsed === "false") {
      // If state is explicitly saved as open, remove 'collapsed' class
      sidebar.classList.remove("collapsed");
    } else if (isSidebarCollapsed === null) {
      // If no state is saved (first run), ensure it's collapsed by default.
      sidebar.classList.add("collapsed");
      saveSidebarState(true);
    }
    // If isSidebarCollapsed is 'true' or null (and we set it to true), the default HTML class handles it.
  }

  // 2. Load the recent chats from the server
  await loadAllChats();
}

async function getApiResponse(
  prompt,
  systemMessage = null,
  history = [],
  signal = null
) {
  // closeSidebar(); // REMOVED: We no longer automatically close the sidebar on message send.

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt,
        systemMessage: systemMessage,
        history: history,
        model: currentSelectedModel,
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

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  // On mobile (less than 768px), we use the 'active' class for the overlay slide
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle("active");
  } else {
    // On desktop, we toggle the 'collapsed' class
    const isCollapsed = !sidebar.classList.contains("collapsed");
    sidebar.classList.toggle("collapsed");
    saveSidebarState(!isCollapsed); // Save the new state
  }
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    // Mobile mode
    sidebar.classList.remove("active");
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
    navLink.href = "index.html";
    navLink.onclick = (e) => {
      // NOTE: We don't preventDefault here because we want the page refresh
      // This ensures sidebar state persists across navigation clicks without JS hacks
      // The state is saved/restored in loadState/toggleSidebar

      // Update global state immediately
      activeChatId = chat.id;
      isNewChat = false;

      // Navigate and load (handled by browser's default link behavior)
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
    // This is the fallback if the modal is not on the page
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
  const chatIndex = recentChats.findIndex((chat) => chat.id == chatId);
  if (chatIndex === -1) return;

  try {
    // 1. Delete on server
    const response = await fetch(`${CHAT_API_BASE}/${chatId}`, {
      method: "DELETE",
    });

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
  // For simplicity, we assume metadata change doesn't change history, but we need the full object to save.
  try {
    const chatHistoryResponse = await fetch(`${CHAT_API_BASE}/${chatId}`);
    if (!chatHistoryResponse.ok)
      throw new Error("Could not fetch chat history for update.");
    const fullChat = await chatHistoryResponse.json();

    // Update the properties that changed
    fullChat.title = chat.title;
    fullChat.pinned = chat.pinned;

    // Save the updated chat back to the server
    await saveChat(fullChat);
    showToast(`Chat ${action}d successfully.`);
  } catch (error) {
    console.error(`Error performing chat action (${action}):`, error);
    showToast(`Failed to perform chat action: ${error.message}`);
  }
}

function selectModel(element, modelName, iconClass, iconColor) {
  currentSelectedModel = modelName;

  const btn = document.getElementById("current-model-btn");
  if (!btn) return;

  let shortName = modelName.split("/").pop();
  shortName = shortName.replace("Gemini s", ""); // Changed "Gemini " to "Gemini \s" in case there is no space

  btn.innerHTML = `<i class="fa-solid ${iconClass}" style="color:${iconColor};"></i> ${shortName} <i class="fa-solid fa-chevron-down chevron"></i>`;
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

  // Note: toolsDropdown closure logic is now in home.js
};

document.addEventListener("DOMContentLoaded", () => {
  // Get shared elements
  body = document.body;
  toast = document.getElementById("toast");

  // Get modal elements
  confirmDeleteModal = document.getElementById("confirm-delete-modal");
  confirmDeleteText = document.getElementById("confirm-delete-text");
  confirmDeleteCancelBtn = document.getElementById("confirm-delete-cancel");
  confirmDeleteConfirmBtn = document.getElementById("confirm-delete-confirm");

  // Load state will now handle setting dark-mode as default and restoring sidebar state
  loadState();

  // --- SHOW AUTH POPUP FOR NEW / LOGGED-OUT USERS ---
  const isLoggedIn = localStorage.getItem("lynq_user_logged_in");
  const skipped = localStorage.getItem("lynq_skip_auth");

  const onHomePage =
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname === "/" ||
    window.location.pathname === "";

  if (onHomePage && !isLoggedIn && !skipped) {
    // small delay so the UI loads first
    setTimeout(() => {
      showAuthPopup();
    }, 500);
  }

  // Set default model on load for the button text
  const currentModelElement = document.querySelector(".model-option.selected");
  if (currentModelElement) {
    const onclickAttr = currentModelElement.getAttribute("onclick");

    if (onclickAttr && typeof onclickAttr === "string") {
      const matches = onclickAttr.match(/'([^']*)'/g) || [];

      // Extract values safely
      const modelName = matches[0]?.replace(/'/g, "") || "unknown-model";
      const iconClass = matches[1]?.replace(/'/g, "") || "fa-bolt";
      const iconColor = matches[2]?.replace(/'/g, "") || "#FFD700";

      const btn = document.getElementById("current-model-btn");
      if (btn) {
        let shortName = modelName.split("/").pop();
        shortName = shortName.replace("Gemini s", ""); // Changed "Gemini " to "Gemini \s" in case there is no space

        btn.innerHTML = `
                <i class="fa-solid ${iconClass}" style="color:${iconColor};"></i>
                ${shortName}
                <i class="fa-solid fa-chevron-down chevron"></i>`;
      }
    }
  }
});
