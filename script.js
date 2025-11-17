/*
  script.js
  This file contains shared logic and state used across ALL pages.
  UI functions specific to index.html (chat/canvas) are now in home.js.
*/

// --- GLOBAL STATE & API CONFIG ---
let mainChatHistory = [];
let codeHistory = [];

let recentChats = []; // This will hold our chat objects
let isNewChat = true; // Flag to track if we're in a new, unsaved chat
let activeChatId = null; // Tracks which chat we are currently in

// --- PLUGIN STATE ---
let installedPlugins = [];

// --- CODE SNAPSHOTS ---
let codeSnapshots = [];
let currentSnapshotIndex = -1;

// --- API Configuration ---
const API_URL = "/api/generate";
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
      const response = await fetch("systemprompt.txt");
      if (!response.ok) throw new Error("Failed to load systemprompt.txt");
      systemPromptCache = await response.text();
    } catch (error) {
      console.error("Error loading base system prompt:", error);
      systemPromptCache = "You are a helpful and friendly AI assistant."; // Fallback
    }
  }

  // 2. Add custom instructions from settings
  const customInstructions = localStorage.getItem("lynq_custom_instructions");
  let finalPrompt = systemPromptCache;

  if (customInstructions) {
    finalPrompt = `${customInstructions}\n\n---\n\n${finalPrompt}`;
  }

  // 3. Add context (PDF/Canvas) specific instructions
  return `${finalPrompt}\n\n${taskSpecificContext}`;
}

function saveState() {
  const state = {
    codeHistory,
    installedPlugins,
    recentChats,
    isNewChat,
    activeChatId,
    codeSnapshots,
    currentSnapshotIndex,
    generatedRawCode,
  };
  localStorage.setItem("lynq_app_state", JSON.stringify(state));
}

function loadState() {
  const savedState = localStorage.getItem("lynq_app_state");
  if (!savedState) {
    renderRecentChats();
    return;
  }

  try {
    const state = JSON.parse(savedState);

    // Global state restoration
    codeHistory = state.codeHistory || [];
    installedPlugins = state.installedPlugins || [];
    recentChats = state.recentChats || [];
    isNewChat = state.isNewChat !== undefined ? state.isNewChat : true;
    activeChatId = state.activeChatId || null;
    codeSnapshots = state.codeSnapshots || [];
    currentSnapshotIndex = state.currentSnapshotIndex || -1;
    generatedRawCode = state.generatedRawCode || "";

    // If on the home page, load history into view
    const messagesWrapper = document.getElementById("messages-wrapper");
    const welcomeScreen = document.getElementById("welcome-screen");

    if (messagesWrapper && activeChatId) {
      const chat = recentChats.find((c) => c.id === activeChatId);
      if (chat && typeof addMessage === "function") {
        // NOTE: addMessage is defined in home.js, which must be loaded.
        mainChatHistory = chat.history;
        isNewChat = false;
        if (welcomeScreen) welcomeScreen.style.display = "none";
        messagesWrapper.innerHTML = "";
        mainChatHistory.forEach((msg) => {
          addMessage(msg.content, msg.role, true, msg.attachment);
        });
        const chatContainer = document.getElementById("chat-container");
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }

    renderRecentChats();
  } catch (e) {
    console.error("Failed to load state:", e);
    localStorage.removeItem("lynq_app_state");
    renderRecentChats();
  }
}

async function getApiResponse(
  prompt,
  systemMessage = null,
  history = [],
  signal = null
) {
  closeSidebar();

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

  if (window.innerWidth <= 768) {
    sidebar.classList.toggle("active");
  } else {
    sidebar.classList.toggle("collapsed");
  }
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    sidebar.classList.remove("active");
  } else {
    if (!sidebar.classList.contains("collapsed")) {
      sidebar.classList.add("collapsed");
    }
  }
}

function renderRecentChats() {
  const container = document.getElementById("recent-chats-container");
  if (!container) return;

  container.innerHTML = "";

  recentChats.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.id - a.id;
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
      activeChatId = chat.id;
      isNewChat = false;
      saveState();

      if (
        (window.location.pathname.endsWith("index.html") ||
          window.location.pathname.endsWith("/")) &&
        typeof loadChat === "function" // loadChat is now in home.js
      ) {
        e.preventDefault();
        loadChat(chat.id);
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

  const newConfirmBtn = confirmDeleteConfirmBtn.cloneNode(true);
  confirmDeleteConfirmBtn.parentNode.replaceChild(
    newConfirmBtn,
    confirmDeleteConfirmBtn
  );
  confirmDeleteConfirmBtn = newConfirmBtn;

  confirmDeleteConfirmBtn.onclick = () => {
    executeDelete(chatId);
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

function executeDelete(chatId) {
  const chatIndex = recentChats.findIndex((chat) => chat.id == chatId);
  if (chatIndex === -1) return;

  recentChats.splice(chatIndex, 1);

  if (activeChatId == chatId) {
    // resetChat is defined in home.js, check if it exists before calling
    if (typeof resetChat === "function") {
      resetChat();
    } else {
      activeChatId = null;
      isNewChat = true;
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
    showDeleteConfirm(chatId, chat.title);
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

  if (action !== "delete") {
    saveState();
    renderRecentChats();
  }
}

function selectModel(element, modelName, iconClass, iconColor) {
  currentSelectedModel = modelName;

  const btn = document.getElementById("current-model-btn");
  if (!btn) return;

  let shortName = modelName.split("/").pop();
  shortName = shortName.replace("Gemini ", "");

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

  // Apply theme
  const savedTheme = localStorage.getItem("lynq-theme");
  if (savedTheme === "dark") {
    body.classList.add("dark-mode");
  }

  // Load state and render sidebar on every page
  loadState();

  // Set default model on load for the button text
  const currentModelElement = document.querySelector(".model-option.selected");
  if (currentModelElement) {
    const modelName = currentModelElement
      .getAttribute("onclick")
      .match(/'([^']*)'/g)[1]
      .replace(/'/g, "");
    const iconClass = currentModelElement
      .getAttribute("onclick")
      .match(/'([^']*)'/g)[3]
      .replace(/'/g, "");
    const iconColor = currentModelElement
      .getAttribute("onclick")
      .match(/'([^']*)'/g)[5]
      .replace(/'/g, "");
    selectModel(currentModelElement, modelName, iconClass, iconColor);
  }
});
