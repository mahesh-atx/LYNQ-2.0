/*
  chat.js
  This file contains core chat logic for the Home/Chat page (index.html).
  It relies on global state and functions defined in script.js.
  Canvas, Voice, and PDF functionality are in separate files.
  
  --- UPDATED: loadChat() is now secured with auth token. ---
*/

// --- HOME/CHAT PAGE DOM ELEMENTS (Page Specific) ---
let chatInput;
let messagesWrapper;
let welcomeScreen;
let sendBtn;
let stopBtn;
let toolsToggleBtn;
let toolsDropdown;
let isWebSearchActive = false;

// --- HOME/CHAT PAGE STATE ---
const TOKEN_LIMIT = 2000; // Define context limit once
let currentToolId = null; // --- NEW: Track the active tool ID ---
let FILE_CONTEXT_PROMPTS = {}; // Stores file-specific system prompts loaded from JSON

// Fetch file prompts configuration
fetch('config/file_prompts.json')
  .then(response => response.json())
  .then(data => {
    FILE_CONTEXT_PROMPTS = data;
    console.log('✅ File prompts loaded:', Object.keys(data).join(', '));
  })
  .catch(err => console.error('❌ Failed to load file prompts:', err));

// --- Tool-Specific System Prompts ---
// Optimization: Prompts moved to backend (config/tool_prompts.json) to reduce bundle size.
// The backend now injects the correct prompt based on the toolId sent in the request.
const TOOL_SYSTEM_PROMPTS = {}; // Kept empty object to avoid reference errors

// --- Tool Welcome Messages ---
// NOTE: TOOL_MESSAGES is now defined in tools.js (loaded before chat.js)
// Using TOOL_MESSAGES instead of duplicate TOOL_WELCOME_MESSAGES

// --- NEW: Inline Suggestion Prompts Pool (varied lengths) ---
const INLINE_SUGGESTION_PROMPTS = [
  // Short (2-3 words)
  "Write code",
  "Explain this",
  "Summarize",
  "Translate",
  "Fix bugs",
  // Medium (3-5 words)
  "Top movies of 2024",
  "Plan a weekend trip",
  "Debug my code",
  "Best pizza recipe",
  "How to learn fast",
  // Long (6+ words)
  "Create a stunning portfolio website for me",
  "Recommend the best comedy shows on Netflix",
  "Explain machine learning like I'm five",
  "Write a professional email to my boss",
  "Help me prepare for a job interview",
  "What are the latest trends in AI",
  "Give me workout tips for beginners",
];

/**
 * Gets random suggestions from the pool
 */
function getRandomSuggestions(count = 3) {
  const shuffled = [...INLINE_SUGGESTION_PROMPTS].sort(
    () => Math.random() - 0.5
  );
  return shuffled.slice(0, count);
}

/**
 * Adds suggestion text to the input field with animation (doesn't send)
 */
function addToInput(text, event, element) {
  if (event) event.preventDefault(); // Prevent blur from firing

  // Animate the clicked suggestion
  if (element) {
    element.classList.add("clicked");
  }

  if (chatInput) {
    chatInput.value = text;
    chatInput.focus();
    // Trigger height adjustment
    chatInput.style.height = "auto";
    chatInput.style.height = chatInput.scrollHeight + "px";

    // Hide inline suggestions after adding
    const inlineSuggestions = document.getElementById("inline-suggestions");
    if (inlineSuggestions) {
      inlineSuggestions.classList.remove("visible");
    }
  }
}

// Colorful dot colors for inline suggestions
const DOT_COLORS = [
  "#667eea",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
];

/**
 * Updates the inline suggestions with random prompts and colorful dots
 */
function updateInlineSuggestions() {
  const container = document.getElementById("inline-suggestions");
  if (!container) return;

  const suggestions = getRandomSuggestions(3);
  container.innerHTML = suggestions
    .map((text, index) => {
      const dotColor = DOT_COLORS[index % DOT_COLORS.length];
      return `<button class="inline-suggestion" onmousedown="addToInput('${text.replace(
        /'/g,
        "\\'"
      )}', event, this)">
            <span class="suggestion-dot" style="background: ${dotColor};"></span> ${text}
        </button>`;
    })
    .join("");
}

/**
 * Toggles the visibility state of the Tools dropdown menu.
 */
function toggleToolsDropdown(forceState) {
  if (!toolsDropdown || !toolsToggleBtn) return;
  const newState = forceState ?? !toolsDropdown.classList.contains("active");
  if (newState) {
    toolsDropdown.classList.add("active");
    toolsToggleBtn.classList.add("active");
  } else {
    toolsDropdown.classList.remove("active");
    toolsToggleBtn.classList.remove("active");
  }
}

/**
 * Toggles the Web Search mode state.
 */
function toggleWebSearch() {
  const btn = document.getElementById("web-search-toggle-btn");
  if (!btn) return;

  // Toggle state
  isWebSearchActive = !isWebSearchActive;

  // Close the tools dropdown when toggling
  const toolsDropdown = document.getElementById("tools-dropdown");
  const toolsBtn = document.getElementById("tools-btn");
  if (toolsDropdown) toolsDropdown.classList.remove("active");
  if (toolsBtn) toolsBtn.classList.remove("active");

  // Update UI
  if (isWebSearchActive) {
    btn.classList.add("active");
    // Show tool indicator (this also hides the tools wrapper)
    if (typeof showSelectedToolIndicator === "function") {
      showSelectedToolIndicator(
        "websearch",
        "fa-solid fa-earth-americas",
        "Web Search"
      );
    }
  } else {
    btn.classList.remove("active");
    // Hide tool indicator and restore tools button
    if (typeof deselectTool === "function") {
      deselectTool();
    }
  }
}

function sendSuggestion(text) {
  if (chatInput) {
    chatInput.value = text;
    handleSend();
  }
}

/**
 * Resets the current chat view and state to a new chat.
 */
function resetChat() {
  // Destroy all chart instances before clearing messages (prevent memory leaks)
  if (messagesWrapper && typeof destroyChartsInElement === "function") {
    destroyChartsInElement(messagesWrapper);
  }
  
  if (messagesWrapper) messagesWrapper.innerHTML = "";
  if (welcomeScreen) {
    welcomeScreen.style.display = "flex";
    welcomeScreen.style.animation = "fadeIn 0.4s ease forwards";
  }

  const spotlightBg = document.querySelector(".hero-spotlight-bg");
  if (spotlightBg) {
    spotlightBg.style.transition = "opacity 0.5s ease";
    spotlightBg.style.opacity = "1";
  }

  // Hide the topbar new chat button when resetting
  const topbarNewChatBtn = document.getElementById("topbar-new-chat-btn");
  if (topbarNewChatBtn) {
    topbarNewChatBtn.style.display = "none";
  }

  // 2. Reset Global State (defined in script.js)
  mainChatHistory = [];
  isNewChat = true;
  activeChatId = null;

  // 3. Reset Attachments & Canvas
  if (typeof clearAttachment === "function") clearAttachment();
  if (typeof resetCanvasUI === "function") resetCanvasUI();

  // Reset active tool
  currentToolId = null;

  if (chatInput) {
    chatInput.value = "";
    chatInput.style.height = "auto";
  }

  // 4. Refresh Sidebar UI
  if (typeof renderRecentChats === "function") renderRecentChats();

  // 5. Update URL
  if (window.history && window.history.pushState) {
    const newUrl = window.location.pathname;
    history.pushState({}, document.title, newUrl);
  }

  if (typeof updateInlineSuggestions === "function") {
    setTimeout(() => {
      updateInlineSuggestions();
    }, 200);
  }

  // Close sidebar on mobile
  if (window.innerWidth <= 768 && typeof closeSidebar === "function") {
    setTimeout(() => {
      closeSidebar();
    }, 200);
  }
}

/**
 * Handles tool mode activation from URL parameters
 */
function handleToolModeFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const toolParam = urlParams.get("tool");
  const promptParam = urlParams.get("prompt");

  if (!toolParam) return;

  console.log("🔧 Tool mode detected:", toolParam);

  // Use global TOOL_INFO from tools.js (loaded before chat.js)

  switch (toolParam) {
    case "canvas":
      if (typeof toggleCanvasMode === "function") toggleCanvasMode(true);
      break;
    case "websearch":
      isWebSearchActive = true;
      const webSearchBtn = document.getElementById("web-search-toggle-btn");
      if (webSearchBtn) webSearchBtn.classList.add("active");
      break;
  }

  currentToolId = toolParam;

  const toolsWrapper = document.querySelector(".tools-dropdown-wrapper");
  if (toolsWrapper) {
    toolsWrapper.style.display = "none";
  }

  if (TOOL_INFO[toolParam] && typeof showSelectedToolIndicator === "function") {
    showSelectedToolIndicator(
      toolParam,
      TOOL_INFO[toolParam].icon,
      TOOL_INFO[toolParam].name,
      true
    );
  }

  const welcomeMessage = TOOL_MESSAGES[toolParam];
  if (welcomeMessage && welcomeScreen) {
    welcomeScreen.style.display = "none";
    addMessage(welcomeMessage, "ai", true);
  }

  if (promptParam && chatInput) {
    chatInput.value = decodeURIComponent(promptParam);
    chatInput.style.height = "auto";
    chatInput.style.height = chatInput.scrollHeight + "px";
    chatInput.focus();
  }

  if (window.history && window.history.replaceState) {
    const cleanUrl = window.location.pathname;
    history.replaceState({}, document.title, cleanUrl);
  }
}

/**
 * Loads an existing chat's history into the view.
 */
async function loadChat(chatId) {
  if (!currentUser) return;
  const token = await getAuthToken();
  if (!token) {
    handleAuthError();
    return;
  }

  if (typeof recentChats === "undefined") return;
  const chat = recentChats.find((c) => c.id == chatId);

  if (!chat) {
    if (typeof showToast === "function")
      showToast("Error: Chat history not found.");
    resetChat();
    return;
  }

  if (welcomeScreen) welcomeScreen.style.display = "none";
  if (messagesWrapper) messagesWrapper.innerHTML = "";

  const spotlightBg = document.querySelector(".hero-spotlight-bg");
  if (spotlightBg) {
    spotlightBg.style.transition = "opacity 0.5s ease";
    spotlightBg.style.opacity = "0";
  }

  // Show the topbar new chat button when loading a chat
  const topbarNewChatBtn = document.getElementById("topbar-new-chat-btn");
  if (topbarNewChatBtn) {
    topbarNewChatBtn.style.display = "flex";
  }

  try {
    const response = await fetch(`${CHAT_API_BASE}/${chatId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      handleAuthError();
      return;
    }
    if (!response.ok) throw new Error("Failed to fetch full chat history.");
    const fullChat = await response.json();

    mainChatHistory = fullChat.history;
    activeChatId = chatId;
    isNewChat = false;

    mainChatHistory.forEach((msg) => {
      addMessage(msg.content, msg.role, true, msg.attachment);
    });

    const chatContainer = document.getElementById("chat-container");
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

    if (typeof clearAttachment === "function") clearAttachment();
    if (typeof resetCanvasUI === "function") resetCanvasUI();
    if (typeof renderRecentChats === "function") renderRecentChats();
  } catch (error) {
    console.error("Error loading chat:", error);
    if (typeof showToast === "function")
      showToast(`Failed to load chat history: ${error.message}`);
    resetChat();
  }
}

/**
 * Builds the system message with context.
 */

async function buildContextualSystemMessage(attachment) {
  let contextAddon = "";

  if (attachment && attachment.text) {
    let contextText = attachment.text;
    
    // Determine file type category
    let type = 'text'; // Default
    if (attachment.type === 'data') type = 'data';
    else if (attachment.type === 'pdf') type = 'pdf';
    else if (attachment.fileType && attachment.fileType.includes('image')) type = 'image';
    else if (attachment.fileType && (attachment.fileType.includes('javascript') || attachment.fileType.includes('python') || attachment.fileType.includes('html'))) type = 'code';
    
    // Truncate if too long
    if (contextText.length > TOKEN_LIMIT * 4) {
      contextText = contextText.substring(0, TOKEN_LIMIT * 4);
      if (typeof showToast === "function")
        showToast("Note: The file content was truncated due to size.");
    }

    // Get prompt template from loaded config, fallback to default if missing
    let promptTemplate = FILE_CONTEXT_PROMPTS[type] || FILE_CONTEXT_PROMPTS['text'];
    
    // Fallback if config failed to load
    if (!promptTemplate) {
        if (type === 'data') promptTemplate = "DATA: {{CONTENT}}";
        else promptTemplate = "CONTEXT: {{CONTENT}}";
    }

    // Replace placeholder with actual content
    contextAddon = promptTemplate.replace('{{CONTENT}}', contextText);
    
    console.log(`📎 ${type.toUpperCase()} attached (${contextText.length} chars)`);
  }

  if (currentToolId) {
    console.log(`🔧 Tool active: ${currentToolId}`);
  }

  const finalSystemMessage = getSystemMessage(contextAddon);
  
  // Log the complete system prompt being sent to AI
  if (attachment && attachment.text) {
    console.log("📨 System Prompt with File Context:");
    console.log("─".repeat(80));
    console.log(finalSystemMessage);
    console.log("─".repeat(80));
  }

  return finalSystemMessage;
}


/**
 * Handles sending the user's message.
 */
async function handleSend() {
  if (!chatInput) return;
  const text = chatInput.value.trim();
  if (typeof closeSidebar === "function") closeSidebar();

  // Hide inline suggestions
  const inlineSuggestions = document.getElementById("inline-suggestions");
  if (inlineSuggestions) {
    inlineSuggestions.classList.remove("visible");
  }

  const isGuest = !currentUser;
  const currentAttachment =
    typeof getCurrentAttachment === "function" ? getCurrentAttachment() : null;

  if (!text && !currentAttachment) return;

  if (welcomeScreen) welcomeScreen.style.display = "none";

  const spotlightBg = document.querySelector(".hero-spotlight-bg");
  if (spotlightBg) {
    spotlightBg.style.transition = "opacity 0.5s ease";
    spotlightBg.style.opacity = "0";
  }

  // Hide guest banner when response starts generating
  const guestBanner = document.getElementById("guest-banner");
  if (guestBanner) {
    guestBanner.style.display = "none";
  }

  // Show the topbar new chat button when chat starts
  const topbarNewChatBtn = document.getElementById("topbar-new-chat-btn");
  if (topbarNewChatBtn) {
    topbarNewChatBtn.style.display = "flex";
  }

  chatInput.value = "";
  chatInput.style.height = "auto";

  const newlyAttachedFile = currentAttachment;
  if (typeof clearAttachment === "function") clearAttachment();

  let currentChat = recentChats.find((chat) => chat.id === activeChatId);

  if (isNewChat) {
    let chatTitle = text || `Chat about ${newlyAttachedFile.name}`;

    const newChat = {
      id: Date.now(),
      title:
        chatTitle.length > 40 ? chatTitle.substring(0, 40) + "..." : chatTitle,
      history: [],
      pinned: false,
    };

    if (typeof recentChats === "undefined") {
      console.error("Global state (recentChats) not initialized.");
      return;
    }

    recentChats.push(newChat);
    activeChatId = newChat.id;
    isNewChat = false;
    mainChatHistory = newChat.history;
    currentChat = newChat;

    const newUrl = window.location.pathname + `?chatId=${activeChatId}`;
    history.pushState({ chatId: activeChatId }, newChat.title, newUrl);

    if (typeof renderRecentChats === "function") renderRecentChats();
  }

  let historyForApi = mainChatHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const MAX_MESSAGES = 2;
  if (historyForApi.length > MAX_MESSAGES) {
    historyForApi = historyForApi.slice(historyForApi.length - MAX_MESSAGES);
  }

  mainChatHistory.push({
    role: "user",
    content: text,
    attachment: newlyAttachedFile,
  });

  if (currentChat) {
    currentChat.history = mainChatHistory;
  }

  addMessage(text, "user", false, newlyAttachedFile);

  if (currentChat && !isGuest) {
    await saveChat({
      id: activeChatId,
      title: currentChat.title,
      history: mainChatHistory,
      pinned: currentChat.pinned,
    });
  }

  const thinkingBubble = showThinking();

  isResponding = true;

  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) {
    stopBtn.style.display = "flex";
    stopBtn.classList.add("generating");
    const toolbarRight = stopBtn.closest(".toolbar-right");
    if (toolbarRight) toolbarRight.classList.add("generating");
  }

  if (currentController) currentController.abort();
  currentController = new AbortController();
  const signal = currentController.signal;

  let contextAttachment = newlyAttachedFile;
  if (
    !contextAttachment &&
    mainChatHistory.length > 0 &&
    mainChatHistory[0].attachment &&
    mainChatHistory[0].attachment.text
  ) {
    contextAttachment = mainChatHistory[0].attachment;
  }

  const finalSystemMessage = await buildContextualSystemMessage(
    contextAttachment
  );

  try {
    const response = await getApiResponse(
      text,
      finalSystemMessage,
      historyForApi,
      signal,
      isWebSearchActive,
      isCanvasModeActive,
      currentToolId,
      newlyAttachedFile // Pass the current attachment
    );

    if (!response || typeof response !== "string" || response.trim() === "") {
      if (typeof showApiError === "function")
        showApiError(
          "The API returned an empty or invalid response.",
          thinkingBubble
        );
      if (sendBtn) sendBtn.style.display = "flex";
      if (stopBtn) {
        stopBtn.style.display = "none";
        stopBtn.classList.remove("generating");
        const toolbarRight = stopBtn.closest(".toolbar-right");
        if (toolbarRight) toolbarRight.classList.remove("generating");
      }
      isResponding = false;
      return;
    }

    mainChatHistory.push({
      role: "assistant",
      content: response,
      attachment: null,
    });
    if (currentChat) {
      currentChat.history = mainChatHistory;
    }

    if (thinkingBubble) {
      if (thinkingBubble._thinkingInterval) {
        clearInterval(thinkingBubble._thinkingInterval);
      }
      thinkingBubble.remove();
    }
    if (isResponding) {
      await streamResponse(response);
    }

    if (currentChat && !isGuest) {
      await saveChat({
        id: activeChatId,
        title: currentChat.title,
        history: mainChatHistory,
        pinned: currentChat.pinned,
      });
    }
  } catch (error) {
    if (typeof showApiError === "function")
      showApiError(
        error.message || "An unknown API error occurred.",
        thinkingBubble
      );
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) {
      stopBtn.style.display = "none";
      stopBtn.classList.remove("generating");
      const toolbarRight = stopBtn.closest(".toolbar-right");
      if (toolbarRight) toolbarRight.classList.remove("generating");
    }
    isResponding = false;
  } finally {
    currentController = null;
  }
}

// ============================================
// STREAM HANDLER FUNCTIONS
// ============================================
// NOTE: The following functions have been moved to stream-handler.js:
// - stopResponse()
// - showThinking()
// - streamResponse()
// - streamTextToBubble()

// ============================================
// MESSAGE RENDERER FUNCTIONS
// ============================================
// NOTE: The following functions have been moved to message-renderer.js:
// - enhanceCodeBlocks()
// - formatLanguageName()
// - renderChartBlocks()
// - getChartColor()
// - embedYouTubeVideos()
// - createVideoPlayer()
// - addMessage()

// ============================================
// CHAT ACTIONS FUNCTIONS
// ============================================
// NOTE: The following functions have been moved to chat-actions.js:
// - copyToClipboard()
// - shareResponse()
// - toggleEdit()
// - regenerateMessage()
// - regenerateResponseAfterEdit()


function copyToClipboard(text, btnElement) {
  const plainText = text.replace(/<[^>]*>?/gm, "");
  if (
    typeof navigator.clipboard !== "undefined" &&
    navigator.clipboard.writeText
  ) {
    navigator.clipboard.writeText(plainText).then(() => {
      const originalIcon = btnElement.innerHTML;
      btnElement.innerHTML = '<i class="fa-solid fa-check"></i>';
      setTimeout(() => {
        btnElement.innerHTML = originalIcon;
      }, 2000);
    });
  } else {
    if (typeof showToast === "function") showToast("Clipboard access denied.");
  }
}

function shareResponse(text) {
  if (
    typeof navigator.clipboard !== "undefined" &&
    navigator.clipboard.writeText
  ) {
    navigator.clipboard.writeText("https://lynq.ai/share/chat-id-123");
    if (typeof showToast === "function")
      showToast("Shareable link copied to clipboard!");
  } else {
    if (typeof showToast === "function")
      showToast("Share functionality unavailable.");
  }
}

async function toggleEdit(msgWrapper, originalText, originalAttachment) {
  const bubble = msgWrapper.querySelector(".bubble");
  const actions = msgWrapper.querySelector(".message-actions");
  const attachmentContainer = msgWrapper.querySelector(
    ".message-attachment-container"
  );

  if (msgWrapper.querySelector(".edit-container")) return;

  bubble.style.display = "none";
  if (actions) actions.style.display = "none";
  if (attachmentContainer) attachmentContainer.style.display = "none";

  const editContainer = document.createElement("div");
  editContainer.className = "edit-container";

  if (originalAttachment) {
    const pill = document.createElement("div");
    pill.className = "attachment-pill";
    pill.innerHTML = `<i class="fa-solid fa-file-pdf"></i> <span>${originalAttachment.name}</span>`;
    editContainer.appendChild(pill);
  }

  const textarea = document.createElement("textarea");
  textarea.className = "edit-textarea";
  textarea.value = originalText;
  textarea.rows = 1;

  const btnRow = document.createElement("div");
  btnRow.className = "edit-buttons";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-edit-action btn-cancel";
  cancelBtn.innerText = "Cancel";
  cancelBtn.onclick = () => {
    editContainer.remove();
    bubble.style.display = "block";
    if (actions) actions.style.display = "flex";
    if (attachmentContainer) attachmentContainer.style.display = "flex";
  };

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-edit-action btn-save";
  saveBtn.innerText = "Save & Submit";
  saveBtn.onclick = () => {
    const newText = textarea.value.trim();
    if (newText !== "" || originalAttachment) {
      const msgIndex = mainChatHistory.findIndex(
        (m) => m.role === "user" && m.content === originalText
      );
      if (msgIndex > -1) {
        mainChatHistory = mainChatHistory.slice(0, msgIndex);
      } else {
        mainChatHistory = [];
      }

      let currentMsgEl = msgWrapper.parentElement;
      while (currentMsgEl.nextElementSibling) {
        currentMsgEl.nextElementSibling.remove();
      }

      mainChatHistory.push({
        role: "user",
        content: newText,
        attachment: originalAttachment,
      });

      const currentChat = recentChats.find((c) => c.id === activeChatId);
      if (currentChat) {
        currentChat.history = mainChatHistory;
      }

      bubble.innerText = newText;
      regenerateResponseAfterEdit(newText, originalAttachment);
    }
    editContainer.remove();
    bubble.style.display = "block";
    if (actions) actions.style.display = "flex";
    if (attachmentContainer) attachmentContainer.style.display = "flex";
  };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  editContainer.appendChild(textarea);
  editContainer.appendChild(btnRow);
  msgWrapper.appendChild(editContainer);

  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
  textarea.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });
  textarea.focus();
}

async function regenerateResponseAfterEdit(newPrompt, attachment) {
  const isGuest = !currentUser;

  isResponding = true;
  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) {
    stopBtn.style.display = "flex";
    stopBtn.classList.add("generating");
    const toolbarRight = stopBtn.closest(".toolbar-right");
    if (toolbarRight) toolbarRight.classList.add("generating");
  }

  const thinking = showThinking();

  if (currentController) currentController.abort();
  currentController = new AbortController();
  const signal = currentController.signal;

  const historyForApi = mainChatHistory
    .slice(0, -1)
    .map((msg) => ({ role: msg.role, content: msg.content }));
  const finalSystemMessage = await buildContextualSystemMessage(attachment);

  try {
    const response = await getApiResponse(
      newPrompt,
      finalSystemMessage,
      historyForApi,
      signal,
      false,
      typeof isCanvasModeActive !== "undefined" ? isCanvasModeActive : false
    );

    if (!response || typeof response !== "string" || response.trim() === "") {
      if (typeof showApiError === "function")
        showApiError(
          "The API returned an empty or invalid response.",
          thinking
        );
      if (sendBtn) sendBtn.style.display = "flex";
      if (stopBtn) {
        stopBtn.style.display = "none";
        stopBtn.classList.remove("generating");
        const toolbarRight = stopBtn.closest(".toolbar-right");
        if (toolbarRight) toolbarRight.classList.remove("generating");
      }
      isResponding = false;
      return;
    }

    mainChatHistory.push({
      role: "assistant",
      content: response,
      attachment: null,
    });
    const currentChat = recentChats.find((c) => c.id === activeChatId);
    if (currentChat) {
      currentChat.history = mainChatHistory;
    }

    thinking.remove();
    await streamResponse(response);

    if (currentChat && !isGuest) {
      await saveChat({
        id: activeChatId,
        title: currentChat.title,
        history: mainChatHistory,
        pinned: currentChat.pinned,
      });
    }
  } catch (error) {
    if (typeof showApiError === "function")
      showApiError(error.message || "An unknown API error occurred.", thinking);
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) {
      stopBtn.style.display = "none";
      stopBtn.classList.remove("generating");
      const toolbarRight = stopBtn.closest(".toolbar-right");
      if (toolbarRight) toolbarRight.classList.remove("generating");
    }
    isResponding = false;
  } finally {
    currentController = null;
  }
}

function addMessage(text, sender, skipHistory = false, attachment = null) {
  if (!messagesWrapper) return null;

  const isThinking = sender === "ai" && !text;

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;
  if (isThinking) msgDiv.classList.add("thinking");

  const avatar = document.createElement("div");
  avatar.className = `avatar ${sender}`;
  avatar.innerHTML =
    sender === "user"
      ? '<i class="fa-regular fa-user"></i>'
      : '<i class="fa-solid fa-bolt"></i>';

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "msg-content-wrapper";

  if (attachment) {
    const attachmentContainer = document.createElement("div");
    attachmentContainer.className = "message-attachment-container";
    
    if (attachment.type === "image" && attachment.data_url) {
        // Image Attachment - Compact thumbnail style
        const img = document.createElement("img");
        img.src = attachment.data_url;
        img.className = "message-attachment-image";
        img.style.width = "80px";
        img.style.height = "80px";
        img.style.borderRadius = "8px";
        img.style.cursor = "pointer";
        img.style.objectFit = "cover";
        img.style.border = "1px solid var(--border-secondary)";
        img.onclick = () => window.open(attachment.data_url, '_blank');
        
        attachmentContainer.appendChild(img);
    } else {
        // Default / PDF Attachment
        const pill = document.createElement("div");
        pill.className = "attachment-pill";
        pill.innerHTML = `<i class="fa-solid fa-file-pdf"></i> <span>${attachment.name}</span>`;
        attachmentContainer.appendChild(pill);
    }
    contentWrapper.appendChild(attachmentContainer);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (isThinking) {
    bubble.innerHTML =
      '<div class="thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
  } else if (sender === "user") {
    bubble.innerText = text;
  } else {
    if (text) {
      bubble.innerHTML = marked.parse(text);
    }
  }

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "message-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "action-icon";
  copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
  copyBtn.title = "Copy";

  if (sender === "user") {
    copyBtn.onclick = () => copyToClipboard(text, copyBtn);
    const editBtn = document.createElement("button");
    editBtn.className = "action-icon";
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    editBtn.title = "Edit";
    editBtn.onclick = () => toggleEdit(contentWrapper, text, attachment);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(copyBtn);
  } else {
    const regenBtn = document.createElement("button");
    regenBtn.className = "action-icon";
    regenBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
    regenBtn.title = "Regenerate";
    regenBtn.onclick = () => regenerateMessage(msgDiv);

    const shareBtn = document.createElement("button");
    shareBtn.className = "action-icon";
    shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i>';
    shareBtn.title = "Share";

    actionsDiv.appendChild(copyBtn);
    actionsDiv.appendChild(regenBtn);
    actionsDiv.appendChild(shareBtn);
  }

  contentWrapper.appendChild(bubble);
  contentWrapper.appendChild(actionsDiv);
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(contentWrapper);
  messagesWrapper.appendChild(msgDiv);

  if (sender === "ai" && text) {
    bubble.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block);
    });
    enhanceCodeBlocks(bubble);
  }

  const chatContainer = document.getElementById("chat-container");
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

  return bubble;
}

function regenerateMessage(msgDiv) {
  const userMsg = msgDiv.previousElementSibling;
  if (!userMsg) return;

  while (userMsg.nextElementSibling) {
    userMsg.nextElementSibling.remove();
  }

  const userMsgContentEl = userMsg.querySelector(".bubble");
  if (!userMsgContentEl) return;
  const userPromptText = userMsgContentEl.innerText.trim();

  let attachment = null;
  const userMsgIndex = mainChatHistory.findIndex(
    (m) => m.role === "user" && m.content === userPromptText
  );
  if (userMsgIndex > -1) {
    attachment = mainChatHistory[userMsgIndex].attachment;
  }

  if (userMsgIndex > -1) {
    mainChatHistory = mainChatHistory.slice(0, userMsgIndex);
  } else {
    mainChatHistory = [];
    return;
  }

  mainChatHistory.push({
    role: "user",
    content: userPromptText,
    attachment: attachment,
  });

  const currentChat = recentChats.find((c) => c.id === activeChatId);
  if (currentChat) {
    currentChat.history = mainChatHistory;
  }

  regenerateResponseAfterEdit(userPromptText, attachment);
}

function embedYouTubeVideos(bubbleElement) {
  const ytRegex =
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
  const links = bubbleElement.querySelectorAll("a");

  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;
    const match = href.match(ytRegex);
    if (match && match[1]) {
      createVideoPlayer(link, match[1]);
    }
  });
}

function createVideoPlayer(linkElement, videoId) {
  const container = document.createElement("div");
  container.className = "video-embed-container";

  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&autoplay=0`;
  iframe.className = "yt-embed";
  iframe.setAttribute("allowFullScreen", "");
  iframe.setAttribute(
    "allow",
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  );

  container.appendChild(iframe);
  if (linkElement.parentNode) {
    linkElement.replaceWith(container);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  chatInput = document.getElementById("chat-input");
  messagesWrapper = document.getElementById("messages-wrapper");
  welcomeScreen = document.getElementById("welcome-screen");
  sendBtn = document.getElementById("send-btn");
  stopBtn = document.getElementById("stop-btn");

  toolsToggleBtn = document.getElementById("tools-toggle-btn");
  toolsDropdown = document.getElementById("tools-dropdown");

  if (typeof initCanvasElements === "function") initCanvasElements();
  if (typeof initCanvasListeners === "function") initCanvasListeners();
  if (typeof initPdfElements === "function") initPdfElements();
  if (typeof initPdfListeners === "function") initPdfListeners();

  const webSearchBtn = document.getElementById("web-search-toggle-btn");
  if (webSearchBtn) {
    webSearchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleWebSearch();
    });
  }

  if (chatInput) {
    if (typeof initVoiceInput === "function") {
      setTimeout(initVoiceInput, 100);
    }

    chatInput.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
      if (this.value === "") this.style.height = "auto";
    });

    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // --- NEW: Input Focus/Blur handlers for inline suggestions (pills stay visible) ---
    chatInput.addEventListener("focus", () => {
      const inlineSuggestions = document.getElementById("inline-suggestions");

      // Only show effects if welcome screen is visible
      if (welcomeScreen && welcomeScreen.style.display !== "none") {
        // Show inline suggestions with new random prompts
        if (inlineSuggestions) {
          updateInlineSuggestions(); // Randomize suggestions each time
          inlineSuggestions.classList.add("visible");
        }
      }
    });

    chatInput.addEventListener("blur", () => {
      const inlineSuggestions = document.getElementById("inline-suggestions");

      // Only hide inline suggestions if input is empty
      setTimeout(() => {
        if (
          chatInput.value.trim() === "" &&
          welcomeScreen &&
          welcomeScreen.style.display !== "none"
        ) {
          // Hide inline suggestions
          if (inlineSuggestions) {
            inlineSuggestions.classList.remove("visible");
          }
        }
      }, 150); // Small delay to allow click events on inline suggestions
    });

    if (toolsToggleBtn) {
      toolsToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleToolsDropdown();
      });
    }

    if (welcomeScreen && activeChatId) {
      welcomeScreen.style.display = "none";
    }

    handleToolModeFromURL();
  }

  window.addEventListener("click", (event) => {
    if (toolsDropdown && toolsDropdown.classList.contains("active")) {
      if (
        !toolsDropdown.contains(event.target) &&
        (!toolsToggleBtn || !toolsToggleBtn.contains(event.target))
      ) {
        toggleToolsDropdown(false);
      }
    }
  });
});
