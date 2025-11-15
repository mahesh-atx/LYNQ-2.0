/*
  home.js
  This file contains logic ONLY for the Home/Chat page (index.html).
*/
console.log("Home script loaded.");

// --- DOM ELEMENTS (Page Specific) ---
let chatInput;
let messagesWrapper;
let welcomeScreen;
let sendBtn;
let stopBtn;
// MODIFIED: Canvas elements
let canvasToggleBtn;
let canvasPane;
let canvasCloseBtn;
let canvasCodeBlock;
let canvasPlaceholder;
let canvasTabCode;
let canvasTabPreview;
let canvasDownloadBtn;
let canvasContent; // The code view
let canvasPreviewWrapper; // The preview view
let canvasPreviewIframe;
let canvasPreviewPlaceholder;

// --- STATE (Page Specific) ---
let isCanvasModeActive = false; // State for canvas mode toggle

document.addEventListener("DOMContentLoaded", () => {
  // --- Get Page-Specific Elements ---
  chatInput = document.getElementById("chat-input");
  messagesWrapper = document.getElementById("messages-wrapper");
  welcomeScreen = document.getElementById("welcome-screen");
  sendBtn = document.getElementById("send-btn");
  stopBtn = document.getElementById("stop-btn");

  // MODIFIED: Get Canvas Elements
  canvasToggleBtn = document.getElementById("canvas-toggle-btn");
  canvasPane = document.getElementById("canvas-pane");
  canvasCloseBtn = document.getElementById("canvas-close-btn");
  canvasCodeBlock = document.getElementById("canvas-code-block");
  canvasPlaceholder = document.getElementById("canvas-placeholder");
  
  // NEW: Get new canvas elements
  canvasTabCode = document.getElementById("canvas-tab-code");
  canvasTabPreview = document.getElementById("canvas-tab-preview");
  canvasDownloadBtn = document.getElementById("canvas-download-btn");
  canvasContent = document.getElementById("canvas-content");
  canvasPreviewWrapper = document.getElementById("canvas-preview-wrapper");
  canvasPreviewIframe = document.getElementById("canvas-preview-iframe");
  canvasPreviewPlaceholder = document.getElementById("canvas-preview-placeholder");


  // --- Initialize Page-Specific Logic ---
  if (chatInput) {
    initVoiceInput();

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
  }

  // Add listeners for canvas controls
  if (canvasToggleBtn) {
    canvasToggleBtn.addEventListener("click", () => toggleCanvasMode());
  }
  if (canvasCloseBtn) {
    canvasCloseBtn.addEventListener("click", () => toggleCanvasMode(false));
  }
  
  // NEW: Add listeners for new canvas controls
  if (canvasTabCode) {
    canvasTabCode.addEventListener("click", () => switchCanvasTab("code"));
  }
  if (canvasTabPreview) {
    canvasTabPreview.addEventListener("click", () => switchCanvasTab("preview"));
  }
  if (canvasDownloadBtn) {
    canvasDownloadBtn.addEventListener("click", downloadCanvasCode);
  }

  // If we are on home page and not in a chat, show welcome
  // loadState in script.js now handles showing/hiding this
  if (welcomeScreen && !activeChatId) {
    welcomeScreen.style.display = "flex";
  }
});

/**
 * MODIFIED: Toggles the canvas mode AND the panel visibility.
 * @param {boolean} [forceState] - Optionally force a state (true for on, false for off).
 */
function toggleCanvasMode(forceState) {
  const newState = forceState ?? !isCanvasModeActive;

  if (newState === false) {
    // Turning OFF
    isCanvasModeActive = false;
    if (canvasToggleBtn) canvasToggleBtn.classList.remove("active");
    if (canvasPane) canvasPane.classList.remove("active"); // <-- This closes the pane
    if (typeof showToast === "function") showToast("Canvas Mode Disabled");
  } else {
    // Turning ON
    isCanvasModeActive = true;
    if (canvasToggleBtn) canvasToggleBtn.classList.add("active");
    if (canvasPane) canvasPane.classList.add("active"); // <-- This opens the pane
    if (typeof showToast === "function") showToast("Canvas Mode Enabled");
  }
  console.log("Canvas Mode Active:", isCanvasModeActive);
}

// --- CANVAS TABBING LOGIC ---

/**
 * Switches between 'code' and 'preview' tabs in the canvas.
 * @param {'code' | 'preview'} tabName - The tab to switch to.
 */
function switchCanvasTab(tabName) {
  if (tabName === "code") {
    canvasTabCode.classList.add("active");
    canvasTabPreview.classList.remove("active");
    
    canvasContent.style.display = "block"; // Or "flex" if it's a flex container
    canvasPreviewWrapper.style.display = "none";

  } else if (tabName === "preview") {
    canvasTabCode.classList.remove("active");
    canvasTabPreview.classList.add("active");
    
    canvasContent.style.display = "none";
    canvasPreviewWrapper.style.display = "flex"; // Use flex to center placeholder
    
    // Generate the preview when tab is clicked
    generatePreview();
  }
}

/**
 * MODIFIED: Renders the code from the code block into the preview iframe, 
 * wrapping it in a full HTML document structure for proper rendering.
 */
function generatePreview() {
  if (!canvasCodeBlock || !canvasPreviewIframe || !canvasPreviewPlaceholder) return;
  
  const code = canvasCodeBlock.textContent;
  
  if (!code || code.trim() === "") {
    // Show placeholder if no code
    canvasPreviewIframe.style.display = "none";
    canvasPreviewPlaceholder.style.display = "flex";
  } else {
    // Hide placeholder and show iframe
    canvasPreviewIframe.style.display = "block";
    canvasPreviewPlaceholder.style.display = "none";
    
    // --- NEW PREVIEW WRAPPER LOGIC ---
    let finalHtmlContent;
    
    // Check if the code looks like a full HTML document (starts with <!DOCTYPE html> or <html>)
    if (code.trim().toLowerCase().startsWith('<!doctype html') || code.trim().toLowerCase().startsWith('<html')) {
        // If it's already a full document, use it as is
        finalHtmlContent = code;
    } else {
        // Otherwise, wrap the content in a minimal, responsive, and secure HTML structure
        // Include Tailwind for utility classes
        finalHtmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <!-- Load Tailwind CSS for any utility classes used by the AI -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Ensures the preview content fits well */
        body { margin: 0; padding: 10px; font-family: sans-serif; }
    </style>
</head>
<body>
    ${code}
</body>
</html>
        `;
    }
    // --- END NEW PREVIEW WRAPPER LOGIC ---

    // Write the code into the iframe
    canvasPreviewIframe.srcdoc = finalHtmlContent;
  }
}

/**
 * Downloads the content of the canvas code block as a file.
 */
function downloadCanvasCode() {
  if (!canvasCodeBlock) return;
  
  const code = canvasCodeBlock.textContent;
  if (!code || code.trim() === "") {
    if (typeof showToast === "function") showToast("No code to download.");
    return;
  }
  
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = "lynq-ai-canvas.txt"; // Default file name
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  if (typeof showToast === "function") showToast("Code download started.");
}

// --- END CANVAS LOGIC ---


function initVoiceInput() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log("Web Speech API not supported.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const micBtn = document
    .querySelector(".input-toolbar .fa-microphone-lines")
    ?.closest("button");

  if (micBtn) {
    micBtn.onclick = () => {
      try {
        recognition.start();
        if (typeof showToast === "function") showToast("Listening... Speak now."); // showToast is global
        micBtn.style.color = "#d32f2f";
        micBtn.style.borderColor = "#d32f2f";
      } catch (e) {
        console.error("Voice start error:", e);
      }
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (chatInput) {
        chatInput.value += (chatInput.value ? " " : "") + transcript;
        chatInput.style.height = "auto";
        chatInput.style.height = chatInput.scrollHeight + "px";
      }
    };

    recognition.onspeechend = () => {
      recognition.stop();
      if (typeof showToast === "function") showToast("Processing voice input...");
      micBtn.style.color = "";
      micBtn.style.borderColor = "";
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      if (typeof showToast === "function")
        showToast("Voice error: " + event.error); // showToast is global
      micBtn.style.color = "";
      micBtn.style.borderColor = "";
    };
  }
}

function sendSuggestion(text) {
  if (chatInput) {
    chatInput.value = text;
    handleSend();
  }
}

function resetChat() {
  if (welcomeScreen) welcomeScreen.style.display = "flex";
  if (messagesWrapper) messagesWrapper.innerHTML = "";

  // The next five lines depend on global variables defined in script.js
  if (typeof mainChatHistory !== 'undefined') mainChatHistory = []; // Clear the working history (global var)
  if (typeof isNewChat !== 'undefined') isNewChat = true; // global var
  if (typeof activeChatId !== 'undefined') activeChatId = null; // global var

  // MODIFIED: Reset canvas and tabs
  if (canvasPlaceholder) canvasPlaceholder.style.display = "flex";
  if (canvasCodeBlock) canvasCodeBlock.textContent = "";
  if (canvasPreviewIframe) canvasPreviewIframe.srcdoc = ""; // Clear iframe
  if (canvasPreviewPlaceholder) canvasPreviewPlaceholder.style.display = "flex";
  switchCanvasTab("code"); // Reset to code tab
  toggleCanvasMode(false); // Turn off canvas and close pane

  // The next two lines depend on global functions defined in script.js
  if (typeof renderRecentChats === 'function') renderRecentChats(); // Re-draw sidebar (global func)
  if (typeof saveState === 'function') saveState(); // global func
}

async function loadChat(chatId) {
  // This function assumes `recentChats` is defined globally in script.js
  if (typeof recentChats === 'undefined') return;
  const chat = recentChats.find((chat) => chat.id == chatId); // global var
  if (!chat) return;

  if (welcomeScreen) welcomeScreen.style.display = "none";
  if (messagesWrapper) messagesWrapper.innerHTML = ""; // Clear messages

  // The next three lines depend on global variables defined in script.js
  if (typeof mainChatHistory !== 'undefined') mainChatHistory = chat.history; // Point to this chat's history (global var)
  if (typeof activeChatId !== 'undefined') activeChatId = chat.id; // global var
  if (typeof isNewChat !== 'undefined') isNewChat = false; // global var

  // Re-draw all messages from history
  if (typeof mainChatHistory !== 'undefined') {
    mainChatHistory.forEach((msg) => {
      addMessage(msg.content, msg.role, true); // true to skip re-adding
    });
  }

  const chatContainer = document.getElementById("chat-container");
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

  // MODIFIED: Reset canvas and tabs
  if (canvasPlaceholder) canvasPlaceholder.style.display = "flex";
  if (canvasCodeBlock) canvasCodeBlock.textContent = "";
  if (canvasPreviewIframe) canvasPreviewIframe.srcdoc = ""; // Clear iframe
  if (canvasPreviewPlaceholder) canvasPreviewPlaceholder.style.display = "flex";
  switchCanvasTab("code"); // Reset to code tab
  toggleCanvasMode(false); // Turn off canvas and close pane

  // The next two lines depend on global functions defined in script.js
  if (typeof renderRecentChats === 'function') renderRecentChats(); // Update active state in sidebar
  if (typeof saveState === 'function') saveState(); // global func
}

async function handleSend() {
  if (!chatInput) return;
  const text = chatInput.value.trim();
  if (!text) return;

  if (welcomeScreen) welcomeScreen.style.display = "none";
  chatInput.value = "";
  chatInput.style.height = "auto";

  // --- NEW CHAT LOGIC (Relies on globals from script.js) ---
  if (typeof isNewChat !== 'undefined' && isNewChat) {
    const newChat = {
      id: Date.now(),
      title: text.length > 40 ? text.substring(0, 40) + "..." : text,
      history: [],
      pinned: false,
    };

    if (typeof recentChats !== 'undefined') recentChats.push(newChat);
    if (typeof activeChatId !== 'undefined') activeChatId = newChat.id;
    if (typeof isNewChat !== 'undefined') isNewChat = false;
    if (typeof mainChatHistory !== 'undefined') mainChatHistory = newChat.history;
    if (typeof renderRecentChats === 'function') renderRecentChats();
  }

  const historyForApi = (typeof mainChatHistory !== 'undefined') ? [...mainChatHistory] : [];
  if (typeof mainChatHistory !== 'undefined') mainChatHistory.push({ role: "user", content: text });

  // Update the master list
  const currentChat = (typeof recentChats !== 'undefined' && typeof activeChatId !== 'undefined') ? recentChats.find((chat) => chat.id === activeChatId) : null;
  if (currentChat) {
    currentChat.history = mainChatHistory;
  }
  // --- END NEW CHAT LOGIC ---

  addMessage(text, "user", false); // false: add to history (already done)

  const thinkingBubble = showThinking();

  if (typeof isResponding !== 'undefined') isResponding = true;
  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "flex";

  if (typeof currentController !== 'undefined') {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    const signal = currentController.signal;
  }
  
  const systemMessage = (typeof getSystemMessage === 'function') ? getSystemMessage("You are a helpful, creative, and intelligent AI assistant.") : "You are a helpful, creative, and intelligent AI assistant.";
  const signal = (typeof currentController !== 'undefined' && currentController) ? currentController.signal : null;
  
  try {
    // Note: This relies on a global `getApiResponse` function from script.js
    const response = await getApiResponse(
      text,
      systemMessage,
      historyForApi,
      signal
    );

    if (typeof mainChatHistory !== 'undefined') mainChatHistory.push({ role: "assistant", content: response });
    if (currentChat) {
      currentChat.history = mainChatHistory;
    }

    if (thinkingBubble) thinkingBubble.remove();
    if (typeof isResponding !== 'undefined' && isResponding) streamResponse(response);
  } catch (error) {
    // Note: This relies on a global `showApiError` function from script.js
    if (typeof showApiError === "function")
      showApiError(error.message, thinkingBubble);
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) stopBtn.style.display = "none";
    if (typeof isResponding !== 'undefined') isResponding = false;
  } finally {
    if (typeof currentController !== 'undefined') currentController = null;
  }
}

function stopResponse() {
  if (typeof currentController !== 'undefined') {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }
  }
  if (typeof isResponding !== 'undefined') isResponding = false;
  if (sendBtn) sendBtn.style.display = "flex";
  if (stopBtn) stopBtn.style.display = "none";
}

function showThinking() {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ai thinking`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ai`;
  avatar.innerHTML = '<i class="fa-solid fa-bolt"></i>';

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "msg-content-wrapper";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML =
    '<div class="thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';

  contentWrapper.appendChild(bubble);
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(contentWrapper);
  if (messagesWrapper) messagesWrapper.appendChild(msgDiv);

  const chatContainer = document.getElementById("chat-container");
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

  return msgDiv;
}

/**
 * Streams the response text to the chat bubble and the code to the canvas.
 * @param {string} fullText - The full raw response from the AI.
 */
async function streamResponse(fullText) {
  const bubble = addMessage("", "ai", true);
  let textToStream = fullText;
  let codeToCanvas = "";
  let codeNeedsStreaming = false;

  // 1. Separate code and conversational text if canvas is active
  if (isCanvasModeActive) {
    const { code, text } = parseCodeFromResponse(fullText);
    
    if (code) {
      codeToCanvas = code;
      codeNeedsStreaming = true; // Flag for code streaming
      
      if (!text.trim()) {
        textToStream = "I've sent the generated code to the canvas. Take a look at the code or preview tab!";
      } else {
        textToStream = text;
      }
    }
  }
  
  // 2. Prepare the code block update if code was found
  if (codeNeedsStreaming) {
    const existingCode = canvasCodeBlock.textContent;
    const newCode = existingCode
      ? `${existingCode}\n\n// --- (New Code) ---\n\n${codeToCanvas}`
      : codeToCanvas;

    // Get language hint (as done in updateCanvas)
    let lang = "plaintext";
    if (newCode.includes("<") || newCode.includes(">") || newCode.includes("</")) {
      lang = "html";
    } else if (newCode.includes("function") || newCode.includes("const") || newCode.includes("let")) {
      lang = "javascript";
    }
    canvasCodeBlock.className = `language-${lang}`;
    
    // Clear canvas code block for streaming
    canvasCodeBlock.textContent = existingCode ? existingCode + "\n\n// --- (New Code) ---\n\n" : "";

    // Set canvas to code tab
    switchCanvasTab('code');

    // Start code streaming in the background/interleaved
    const codeStreamPromise = streamCodeToCanvas(codeToCanvas, lang);
    
    // Stream text in the foreground
    await streamTextToBubble(textToStream, bubble);

    // Wait for code streaming to complete (ensures final state is set)
    await codeStreamPromise;

  } else {
    // If no code, just stream text normally
    await streamTextToBubble(textToStream, bubble);
  }

  // 3. Finalize UI after all streaming is done
  const sendBtn = document.getElementById("send-btn");
  const stopBtn = document.getElementById("stop-btn");
  if (sendBtn) sendBtn.style.display = "flex";
  if (stopBtn) stopBtn.style.display = "none";
  if (typeof isResponding !== 'undefined') isResponding = false;
  if (typeof saveState === 'function') saveState(); // global func

  // 4. Set final message actions
  const parentWrapper = bubble.parentElement;
  const actionsDiv = parentWrapper.querySelector(".message-actions");

  const copyBtn = actionsDiv.querySelector(".fa-copy").parentElement;
  copyBtn.onclick = () => {
    // Use the stored raw code or the full response text for copy
    const textToCopy = codeToCanvas || fullText;
    copyToClipboard(textToCopy, copyBtn);
  };

  const shareBtn = actionsDiv.querySelector(".fa-share-nodes").parentElement;
  shareBtn.onclick = () => shareResponse(fullText);
}

/**
 * Helper function to stream text to the chat bubble.
 * @param {string} textToStream - The conversational text.
 * @param {HTMLElement} bubble - The target bubble element.
 */
async function streamTextToBubble(textToStream, bubble) {
  const words = textToStream.split(" ");
  let currentText = "";

  for (let i = 0; i < words.length; i++) {
    if (typeof isResponding !== 'undefined' && !isResponding) {
      // Stream stopped early
      currentText += words[i] + " "; // Add the last word that triggered the stop
      break; 
    }

    currentText += words[i] + " ";
    
    let displayHtml = marked.parse(currentText);
    if (i < words.length - 1) {
        displayHtml = marked.parse(currentText + "...");
    }

    bubble.innerHTML = displayHtml;

    const chatContainer = document.getElementById("chat-container");
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

    await new Promise((r) =>
      setTimeout(r, Math.floor(Math.random() * 30) + 30)
    );
  }
  
  // Final render of the clean text
  bubble.innerHTML = marked.parse(currentText.trim()); 
  bubble
    .querySelectorAll("pre code")
    .forEach((block) => hljs.highlightElement(block));
}

/**
 * NEW: Streams code to the canvas code block.
 * @param {string} codeString - The code to stream.
 * @param {string} lang - The language for highlighting.
 */
async function streamCodeToCanvas(codeString, lang) {
  const chunks = codeString.match(/(\s+|\S+)/g) || [];
  const editorPane = canvasCodeBlock.parentElement;

  for (const chunk of chunks) {
    if (typeof isResponding !== 'undefined' && !isResponding) {
      break; // Stop if the user cancels the response
    }
    canvasCodeBlock.textContent += chunk;
    
    // Auto-scroll the code editor pane
    if (editorPane.scrollTop + editorPane.clientHeight >= editorPane.scrollHeight - 50) {
        editorPane.scrollTop = editorPane.scrollHeight;
    }

    await new Promise(r => setTimeout(r, 1)); // Faster streaming for code
  }
  
  // Set final content and perform final highlight
  canvasCodeBlock.textContent = editorPane.textContent; // Use content from the pane which includes the header
  if (typeof hljs !== 'undefined') {
    hljs.highlightElement(canvasCodeBlock);
  }
}


/**
 * MODIFIED: Extracts code blocks from raw text.
 * @param {string} rawText - The raw text from the AI.
 * @returns {{code: string, text: string}} - An object with extracted code and remaining text.
 */
function parseCodeFromResponse(rawText) {
  // Regex to find code blocks: ```[language]\n[code]```
  const codeRegex = /```(\w+)?\n([\s\S]+?)```/g;
  let codeBlocks = [];

  // Replace code blocks with a placeholder (or just an empty string) and collect them
  const textContent = rawText.replace(codeRegex, (match, lang, code) => {
    // We collect the clean code
    codeBlocks.push(code.trim());
    return ""; // Replace the entire code block in the text with nothing
  });

  return {
    code: codeBlocks.join("\n\n// --- (New Code Block) ---\n\n"), // Join multiple code blocks
    text: textContent.trim(), // Remaining conversational text
  };
}

/**
 * REMOVED: updateCanvas is replaced by streamCodeToCanvas for real-time effects.
 * This placeholder ensures no downstream function breaks if it calls updateCanvas directly.
 */
function updateCanvas(codeString) {
  // This is now handled internally by streamResponse for real-time effect.
  // If called directly outside streamResponse, it performs the final update immediately.
  if (canvasPlaceholder) {
    canvasPlaceholder.style.display = "none";
  }
  if (canvasCodeBlock) {
    const existingCode = canvasCodeBlock.textContent;
    const newCode = existingCode
      ? `${existingCode}\n\n// --- (New Code) ---\n\n${codeString}`
      : codeString;
      
    canvasCodeBlock.textContent = newCode;
    
    let lang = "plaintext";
    if (newCode.includes("<") || newCode.includes(">") || newCode.includes("</")) {
      lang = "html";
    } else if (newCode.includes("function") || newCode.includes("const") || newCode.includes("let")) {
      lang = "javascript";
    }
    canvasCodeBlock.className = `language-${lang}`;

    if (typeof hljs !== 'undefined') {
        hljs.highlightElement(canvasCodeBlock);
    }
    switchCanvasTab('code');
  }
}

function copyToClipboard(text, btnElement) {
  // This function might be duplicated here, but relying on the global one from script.js is safer.
  // For safety, I will rely on the global function defined in script.js to avoid redundancy/conflict.
  if (typeof window.copyToClipboard === 'function') {
      window.copyToClipboard(text, btnElement);
  } else {
      // Fallback implementation (similar to the one in script.js)
      const plainText = text.replace(/<[^>]*>?/gm, "");
      if (typeof navigator.clipboard !== 'undefined' && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plainText).then(() => {
          const originalIcon = btnElement.innerHTML;
          btnElement.innerHTML = '<i class="fa-solid fa-check"></i>';
          setTimeout(() => {
            btnElement.innerHTML = originalIcon;
          }, 2000);
        });
      } else {
          // Fallback for environments without navigator.clipboard
          if (typeof showToast === "function") showToast("Clipboard access denied. Copy manually.");
      }
  }
}

function shareResponse(text) {
  // This function might be duplicated here, but relying on the global one from script.js is safer.
  if (typeof window.shareResponse === 'function') {
      window.shareResponse(text);
  } else {
      // Fallback implementation
      if (typeof navigator.clipboard !== 'undefined' && navigator.clipboard.writeText) {
        navigator.clipboard.writeText("https://lynq.ai/share/chat-id-123");
        if (typeof showToast === "function") showToast("Shareable link copied to clipboard!"); // global func
      } else {
        if (typeof showToast === "function") showToast("Share functionality unavailable.");
      }
  }
}

async function toggleEdit(msgWrapper, originalText) {
  const bubble = msgWrapper.querySelector(".bubble");
  const actions = msgWrapper.querySelector(".message-actions");
  if (msgWrapper.querySelector(".edit-container")) return;

  bubble.style.display = "none";
  if (actions) actions.style.display = "none";

  const editContainer = document.createElement("div");
  editContainer.className = "edit-container";
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
  };

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-edit-action btn-save";
  saveBtn.innerText = "Save & Submit";
  saveBtn.onclick = () => {
    const newText = textarea.value.trim();
    if (newText !== "") {
      // Find this message in history and slice
      const msgIndex = (typeof mainChatHistory !== 'undefined') ? mainChatHistory.findIndex(
        (m) => m.role === "user" && m.content === originalText
      ) : -1;

      if (typeof mainChatHistory !== 'undefined') {
        if (msgIndex > -1) {
          mainChatHistory = mainChatHistory.slice(0, msgIndex);
        } else {
          mainChatHistory = []; // Failsafe
        }
      }

      // Remove all following messages from DOM
      let currentMsgEl = msgWrapper.parentElement;
      while (currentMsgEl.nextElementSibling) {
        currentMsgEl.nextElementSibling.remove();
      }

      // Update bubble content directly
      bubble.innerText = newText; // Use innerText for user message

      // Update the history and resubmit
      if (typeof mainChatHistory !== 'undefined') mainChatHistory.push({ role: "user", content: newText });

      const currentChat = (typeof recentChats !== 'undefined' && typeof activeChatId !== 'undefined') ? recentChats.find((c) => c.id === activeChatId) : null;
      if (currentChat) {
        currentChat.history = mainChatHistory;
      }

      // Pass the new text to regenerate
      regenerateResponseAfterEdit(newText);
    }
    editContainer.remove();
    bubble.style.display = "block";
    if (actions) actions.style.display = "flex";
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

async function regenerateResponseAfterEdit(newPrompt) {
  if (typeof isResponding !== 'undefined') isResponding = true;
  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "flex";

  const thinking = showThinking();

  if (typeof currentController !== 'undefined') {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    const signal = currentController.signal;
  }

  const historyForApi = (typeof mainChatHistory !== 'undefined') ? [...mainChatHistory.slice(0, -1)] : []; // History *before* the new prompt

  const systemMessage = (typeof getSystemMessage === 'function') ? getSystemMessage("You are a helpful assistant. The user has edited their prompt.") : "You are a helpful assistant. The user has edited their prompt.";
  const signal = (typeof currentController !== 'undefined' && currentController) ? currentController.signal : null;

  try {
    const response = await getApiResponse(
      newPrompt,
      systemMessage,
      historyForApi,
      signal
    );

    if (typeof mainChatHistory !== 'undefined') mainChatHistory.push({ role: "assistant", content: response });
    const currentChat = (typeof recentChats !== 'undefined' && typeof activeChatId !== 'undefined') ? recentChats.find((c) => c.id === activeChatId) : null;
    if (currentChat) {
      currentChat.history = mainChatHistory;
    }

    thinking.remove();
    streamResponse(response);
  } catch (error) {
    if (typeof showApiError === "function") showApiError(error.message, thinking);
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) stopBtn.style.display = "none";
    if (typeof isResponding !== 'undefined') isResponding = false;
  } finally {
    if (typeof currentController !== 'undefined') currentController = null;
  }
}

async function regenerateMessage(msgElement) {
  // Find the bubble's content to match in history
  const bubble = msgElement.querySelector(".bubble");
  if (!bubble) return;
  
  // NOTE: This complex history lookup relies heavily on globals from script.js
  if (typeof mainChatHistory === 'undefined' || typeof recentChats === 'undefined' || typeof activeChatId === 'undefined') {
     if (typeof showToast === "function") showToast("Cannot regenerate: Chat state is unavailable.");
     return;
  }

  // Find the index of this AI message in history
  let msgIndex = -1;
  for (let i = mainChatHistory.length - 1; i >= 0; i--) {
    if (mainChatHistory[i].role === "assistant") {
      msgIndex = i;
      break;
    }
  }

  if (msgIndex === -1 || msgIndex === 0) {
    if (typeof showToast === "function")
      showToast("Could not find previous message in history.");
    return;
  }

  // Get the user prompt that came before it
  const userPrompt = mainChatHistory[msgIndex - 1];
  if (!userPrompt || userPrompt.role !== "user") {
    if (typeof showToast === "function") showToast("Could not find user prompt.");
    return;
  }

  // Slice history up to *before* that user prompt
  const historyForApi = mainChatHistory.slice(0, msgIndex - 1);

  // Slice working history to remove the user prompt and this AI response
  mainChatHistory = mainChatHistory.slice(0, msgIndex - 1);

  // Remove this message and all subsequent messages from DOM
  let currentMsgEl = msgElement.previousElementSibling; // Start at user prompt
  // Check if user prompt exists, otherwise remove starting from current
  if (!currentMsgEl || !currentMsgEl.classList.contains("message")) {
    currentMsgEl = msgElement; // Start removal from AI message
    // find user prompt element to remove
    let el = msgElement;
    while (el.previousElementSibling) {
      if (el.previousElementSibling.classList.contains("user")) {
        currentMsgEl = el.previousElementSibling;
        break;
      }
      el = el.previousElementSibling;
    }
  }

  while (currentMsgEl.nextElementSibling) {
    currentMsgEl.nextElementSibling.remove();
  }
  // Also remove the user prompt element itself
  if (currentMsgEl) currentMsgEl.remove();

  // Re-add user prompt to DOM and history
  addMessage(userPrompt.content, "user", true); // true to skip history
  mainChatHistory.push(userPrompt);

  if (typeof isResponding !== 'undefined') isResponding = true;
  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "flex";

  const thinking = showThinking();

  if (typeof currentController !== 'undefined') {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    const signal = currentController.signal;
  }
  
  const systemMessage = (typeof getSystemMessage === 'function') ? getSystemMessage("You are a helpful assistant. Please regenerate a new response.") : "You are a helpful assistant. Please regenerate a new response.";
  const signal = (typeof currentController !== 'undefined' && currentController) ? currentController.signal : null;

  try {
    const response = await getApiResponse(
      userPrompt.content,
      systemMessage,
      historyForApi,
      signal
    );

    mainChatHistory.push({ role: "assistant", content: response });
    const currentChat = recentChats.find((c) => c.id === activeChatId);
    if (currentChat) {
      currentChat.history = mainChatHistory;
    }

    thinking.remove();
    streamResponse(response);
  } catch (error)
 {
    if (typeof showApiError === "function") showApiError(error.message, thinking);
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) stopBtn.style.display = "none";
    if (typeof isResponding !== 'undefined') isResponding = false;
  } finally {
    if (typeof currentController !== 'undefined') currentController = null;
  }
}

function addMessage(text, sender, skipHistory = false) {
  if (!messagesWrapper) return null;

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${sender}`;
  avatar.innerHTML =
    sender === "user"
      ? '<i class="fa-regular fa-user"></i>'
      : '<i class="fa-solid fa-bolt"></i>';

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "msg-content-wrapper";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (sender === "user") {
    bubble.innerText = text; // Use innerText to prevent XSS from user input
  } else {
    if (text) {
      bubble.innerHTML = marked.parse(text); // Use marked for AI response
    }
  }

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "message-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "action-icon";
  copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
  copyBtn.title = "Copy";
  // We set the copy onclick during streamResponse for AI
  // For user, we can set it now
  if (sender === "user") {
    copyBtn.onclick = () => copyToClipboard(text, copyBtn);
  }

  if (sender === "user") {
    const editBtn = document.createElement("button");
    editBtn.className = "action-icon";
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    editBtn.title = "Edit";
    // Get original raw text for editing
    const rawText = text;
    editBtn.onclick = () => toggleEdit(contentWrapper, rawText);

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
    // onclick set in streamResponse

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
  }

  const chatContainer = document.getElementById("chat-container");
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

  return bubble;
}