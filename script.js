/*
  script.js
  This file contains shared logic and state used across ALL pages.
*/

// --- GLOBAL STATE & API CONFIG ---
// All state variables are kept here so saveState/loadState can access them
// from any page.

// --- HISTORY STATE ---
let mainChatHistory = [];
let codeHistory = [];

let recentChats = []; // This will hold our chat objects
let isNewChat = true; // Flag to track if we're in a new, unsaved chat
let activeChatId = null; // Tracks which chat we are currently in

// --- PLUGIN STATE ---
let installedPlugins = []; // NEW: To track installed plugins

// --- CODE SNAPSHOTS ---
let codeSnapshots = [];
let currentSnapshotIndex = -1;

// --- API Configuration ---
const API_URL = "/api/generate";
let generatedRawCode = "";
let isResponding = false;
let currentController = null;
let currentSelectedModel = "openai/gpt-oss-20b"; // Default model // ADDED BACK

// --- Removed Roadmap Interaction Function ---

// --- SHARED DOM ELEMENTS (Loaded in DOMContentLoaded) ---
let body;
let toast;
// Modal elements
let confirmDeleteModal;
let confirmDeleteText;
let confirmDeleteCancelBtn;
let confirmDeleteConfirmBtn;

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
    input.value = ""; // Clear search on blur
    filterRecentChats(); // Reset filter
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

function getSystemMessage(taskSpecificPrompt) {
  const customInstructions = localStorage.getItem("lynq_custom_instructions");
  if (customInstructions) {
    return `${customInstructions}\n\n---\n\n${taskSpecificPrompt}`;
  }
  return taskSpecificPrompt;
}

function saveState() {
  const state = {
    // mainChatHistory, // REMOVED to clear chat history on refresh
    codeHistory,
    installedPlugins, // ADDED
    // recentChats, // REMOVED to clear chat history on refresh
    // isNewChat, // REMOVED to clear chat history on refresh
    // activeChatId, // REMOVED to clear chat history on refresh
    codeSnapshots,
    currentSnapshotIndex,
    generatedRawCode,
  };
  localStorage.setItem("lynq_app_state", JSON.stringify(state));
}

function loadState() {
  const savedState = localStorage.getItem("lynq_app_state");
  if (!savedState) {
    renderRecentChats(); // Render empty chat list if no state
    return;
  }

  try {
    const state = JSON.parse(savedState);
    mainChatHistory = state.mainChatHistory || [];
    codeHistory = state.codeHistory || [];
    installedPlugins = state.installedPlugins || []; // ADDED
    recentChats = state.recentChats || [];
    isNewChat = state.isNewChat !== undefined ? state.isNewChat : true;
    activeChatId = state.activeChatId || null;
    codeSnapshots = state.codeSnapshots || [];
    currentSnapshotIndex = state.currentSnapshotIndex || -1;
    generatedRawCode = state.generatedRawCode || "";

    // --- Page-Specific Loading ---
    // Only try to load chat messages if we are on the home page
    const messagesWrapper = document.getElementById("messages-wrapper");
    const welcomeScreen = document.getElementById("welcome-screen");

    if (messagesWrapper && welcomeScreen && activeChatId) {
      // We are on the home page and in an active chat
      const chat = recentChats.find((c) => c.id === activeChatId);
      if (chat) {
        mainChatHistory = chat.history;
        isNewChat = false;
        welcomeScreen.style.display = "none";
        messagesWrapper.innerHTML = "";
        mainChatHistory.forEach((msg) => {
          // addMessage is defined in home.js, which is loaded
          // on this page, so this should work.
          if (typeof addMessage === "function") {
            addMessage(msg.content, msg.role, true); // true to skip re-adding to history
          }
        });
        const chatContainer = document.getElementById("chat-container");
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }

    // Only try to load tool-specific state if on explore page
    const codeBlock = document.getElementById("code-output-block");
    if (codeBlock && generatedRawCode) {
      // We are on the explore page and have code history
      setTimeout(() => {
        if (typeof updateCodePreview === "function") {
          updateCodePreview(generatedRawCode);
          updateCodeHistoryNav();

          const resultContainer = document.getElementById("code-result");
          const placeholder = document.getElementById("code-placeholder");
          if (resultContainer && placeholder) {
            placeholder.style.display = "none";
            resultContainer.style.display = "grid";
          }
        }
      }, 100);
    }

    renderRecentChats(); // Always render the sidebar
  } catch (e) {
    console.error("Failed to load state:", e);
    localStorage.removeItem("lynq_app_state"); // Clear bad state
    renderRecentChats();
  }
}

async function getApiResponse(
  prompt,
  systemMessage = null,
  history = [],
  signal = null
) {
  // ADDED: Close sidebar when starting a new response
  closeSidebar();

  try {
    // Set your desired max_tokens value directly.
    // const maxTokensValue = 4096; // <-- Or 8192, 1024, etc.

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt,
        systemMessage: systemMessage,
        history: history,
        model: currentSelectedModel, // ADDED BACK
        // max_tokens: maxTokensValue, // Send the hardcoded value
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
  console.log("Showing API error:", message);

  const errorMsg = `<strong>Oops, an error occurred:</strong><br><br>${message}`;

  // Try to find an active tool pane first
  const toolPane = document.querySelector(".tool-result-pane.active-tool-pane");
  if (toolPane) {
    const errorBlock = document.createElement("div");
    errorBlock.className = "prompt-display ai";
    errorBlock.innerHTML = `<div class="avatar ai"><i class="fa-solid fa-bolt"></i></div>
            <div class="bubble error">${errorMsg}</div>`;
    toolPane.appendChild(errorBlock);
    toolPane.scrollTop = toolPane.scrollHeight;
  } else if (typeof addMessage === "function") {
    // Fallback to main chat window if addMessage exists
    const bubble = addMessage("", "ai", true); // true to skip history
    if (bubble) {
      bubble.classList.add("error");
      bubble.innerHTML = errorMsg;
    }
  } else {
    // As a last resort, use toast
    showToast("Error: " + message);
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

  // Save preference
  if (body.classList.contains("dark-mode")) {
    localStorage.setItem("lynq-theme", "dark");
  } else {
    localStorage.setItem("lynq-theme", "light");
  }

  // Also update the toggle if it's on the page
  const settingsToggle = document.getElementById("settings-theme-toggle");
  if (settingsToggle) {
    settingsToggle.checked = body.classList.contains("dark-mode");
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    sidebar.classList.toggle("active"); // For mobile
  } else {
    sidebar.classList.toggle("collapsed"); // For desktop
  }
}

// NEW FUNCTION to close the sidebar
function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    // On mobile, 'active' means open. Remove it to close.
    sidebar.classList.remove("active");
  } else {
    // On desktop, 'collapsed' means closed (shrunk). Add it to close.
    if (!sidebar.classList.contains("collapsed")) {
      sidebar.classList.add("collapsed");
    }
  }
}

function renderRecentChats() {
  const container = document.getElementById("recent-chats-container");
  if (!container) return;

  container.innerHTML = ""; // Clear the list

  // Sort chats: pinned first, then by date (most recent)
  recentChats.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.id - a.id; // Assuming ID is a timestamp
  });

  recentChats.forEach((chat) => {
    const menuId = `chat-menu-${chat.id}`;

    const wrapper = document.createElement("div");
    wrapper.className = "chat-item-wrapper";
    wrapper.id = `chat-wrapper-${chat.id}`;

    const navLink = document.createElement("a");
    navLink.className = "nav-item";
    if (chat.id == activeChatId) {
      // Use == for potential type mismatch
      navLink.classList.add("active");
    }
    // This now links to the home page and calls loadChat
    navLink.href = "index.html";
    navLink.onclick = (e) => {
      // We only prevent default if we're *already* on index.html
      // A bit complex, maybe just storing in state is better.
      // Let's just store it and let loadState handle it on the new page.

      // Simpler: Just save the activeChatId and let the page load.
      // `loadState` on index.html will see this and load the chat.
      activeChatId = chat.id;
      isNewChat = false;
      saveState();

      // If we are already on index.html, we need to manually load the chat
      if (
        window.location.pathname.endsWith("index.html") ||
        window.location.pathname.endsWith("/")
      ) {
        // Check if home.js's loadChat is available
        if (typeof loadChat === "function") {
          e.preventDefault(); // Prevent page reload
          loadChat(chat.id);
        }
      }
      // Otherwise, just let the link navigate
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

// ADDED FUNCTION BACK
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

/**
 * Shows the delete confirmation modal.
 * @param {string|number} chatId - The ID of the chat to delete.
 * @param {string} chatTitle - The title of the chat.
 */
function showDeleteConfirm(chatId, chatTitle) {
  // Check if modal exists. If not (e.g., on another page), do nothing.
  if (!confirmDeleteModal) {
    console.error("Delete modal not found in this HTML file.");
    // Fallback to a simple confirm if the modal isn't on the page
    if (confirm(`Are you sure you want to delete "${chatTitle}"?`)) {
      executeDelete(chatId);
    }
    return;
  }

  // Set the confirmation text
  if (confirmDeleteText) {
    // Use innerHTML to allow for strong tag
    confirmDeleteText.innerHTML = `Are you sure you want to delete "<strong>${chatTitle}</strong>"? This action cannot be undone.`;
  }

  // Set up event listeners
  // Clone and replace to remove any old listeners from previous calls
  const newConfirmBtn = confirmDeleteConfirmBtn.cloneNode(true);
  confirmDeleteConfirmBtn.parentNode.replaceChild(
    newConfirmBtn,
    confirmDeleteConfirmBtn
  );
  confirmDeleteConfirmBtn = newConfirmBtn;

  // Add the new click listener
  confirmDeleteConfirmBtn.onclick = () => {
    executeDelete(chatId);
    confirmDeleteModal.classList.remove("active");
  };

  // Also re-add cancel listener (or clone it too)
  const newCancelBtn = confirmDeleteCancelBtn.cloneNode(true);
  confirmDeleteCancelBtn.parentNode.replaceChild(
    newCancelBtn,
    confirmDeleteCancelBtn
  );
  confirmDeleteCancelBtn = newCancelBtn;

  confirmDeleteCancelBtn.onclick = () => {
    confirmDeleteModal.classList.remove("active");
  };

  // Show the modal
  confirmDeleteModal.classList.add("active");
}

/**
 * Performs the actual deletion logic.
 * @param {string|number} chatId - The ID of the chat to delete.
 */
function executeDelete(chatId) {
  const chatIndex = recentChats.findIndex((chat) => chat.id == chatId);
  if (chatIndex === -1) return;

  recentChats.splice(chatIndex, 1);

  if (activeChatId == chatId) {
    // If we are on home page (where resetChat is defined), reset chat
    if (typeof resetChat === "function") {
      resetChat();
    } else {
      // If on another page, just clear state
      activeChatId = null;
      isNewChat = true;
      // We might want to redirect to home
      // window.location.href = 'index.html';
    }
  }

  saveState();
  renderRecentChats();
}

function chatAction(action, chatId) {
  const chatIndex = recentChats.findIndex((chat) => chat.id == chatId);
  if (chatIndex === -1) return;

  const chat = recentChats[chatIndex];

  if (action === "delete") {
    // This will now call the function.
    // If the modal elements aren't found (wrong page), it will log an error.
    showDeleteConfirm(chatId, chat.title);
  } else if (action === "rename") {
    const newName = prompt("Rename chat:", chat.title);
    if (newName && newName.trim() !== "") {
      chat.title = newName.trim();
    }
  } else if (action === "pin") {
    chat.pinned = !chat.pinned;
  }

  // Close all context menus
  document
    .querySelectorAll(".chat-context-menu")
    .forEach((menu) => menu.classList.remove("show"));

  // Save and render are now called inside executeDelete for delete action,
  // but we still need it for rename and pin.
  if (action !== "delete") {
    saveState();
    renderRecentChats();
  }
}

// ADDED FUNCTION BACK
function selectModel(element, modelName, iconClass, iconColor) {
  currentSelectedModel = modelName;

  const btn = document.getElementById("current-model-btn");
  if (!btn) return;

  let shortName = modelName.split("/").pop(); // Get text after last '/'
  shortName = shortName.replace("Gemini ", ""); // Tidy up

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
  // ADDED BACK
  // Close model dropdown
  if (!event.target.closest(".model-selector-wrapper")) {
    document.getElementById("model-dropdown")?.classList.remove("show");
  }
  // Close pricing modal
  if (event.target === document.getElementById("pricing-modal")) {
    togglePricing();
  }
  // Close chat context menus
  if (!event.target.closest(".chat-item-wrapper")) {
    document
      .querySelectorAll(".chat-context-menu")
      .forEach((menu) => menu.classList.remove("show"));
  }

  // Close confirm modal if clicking overlay
  if (event.target === document.getElementById("confirm-delete-modal")) {
    document.getElementById("confirm-delete-modal").classList.remove("active");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Get shared elements
  body = document.body;
  toast = document.getElementById("toast");

  // Get modal elements
  // This will find them ON THE PAGES WHERE THEY EXIST (like index.html)
  // On other pages, they will be null, which is handled in showDeleteConfirm
  confirmDeleteModal = document.getElementById("confirm-delete-modal");
  confirmDeleteText = document.getElementById("confirm-delete-text");
  confirmDeleteCancelBtn = document.getElementById("confirm-delete-cancel");
  confirmDeleteConfirmBtn = document.getElementById("confirm-delete-confirm");

  // Apply theme on every page load
  const savedTheme = localStorage.getItem("lynq-theme");
  if (savedTheme === "dark") {
    body.classList.add("dark-mode");
  }

  // Load state and render sidebar on every page
  loadState();
});
