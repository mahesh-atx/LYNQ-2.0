/*
  home.js
  This file contains logic ONLY for the Home/Chat page (index.html).
  It relies on global state and functions defined in script.js.
  
  --- UPDATED: loadChat() is now secured with auth token. ---
*/

// --- HOME/CHAT PAGE DOM ELEMENTS (Page Specific) ---
let chatInput;
let messagesWrapper;
let welcomeScreen;
let sendBtn;
let stopBtn;
let canvasToggleBtn;
let canvasPane;
let canvasCloseBtn;
let canvasCodeBlock;
let canvasPlaceholder;
let canvasTabCode;
let canvasTabPreview;
let canvasDownloadBtn;
let canvasContent;
let canvasPreviewWrapper;
let canvasPreviewIframe;
let canvasPreviewPlaceholder;
let toolsToggleBtn;
let toolsDropdown;
let attachFileBtn;
let fileUploadInput;
let attachmentPreviewContainer;
let isWebSearchActive = false;
// --- HOME/CHAT PAGE STATE ---
let isCanvasModeActive = false; // State for canvas mode toggle
let currentAttachment = null; // Holds { name: "...", text: "...", type: "pdf" }
const TOKEN_LIMIT = 2000; // Define context limit once

/**
 * Initializes voice recognition functionality.
 */
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
        if (typeof showToast === "function")
          showToast("Listening... Speak now.");
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
      if (typeof showToast === "function")
        showToast("Processing voice input...");
      micBtn.style.color = "";
      micBtn.style.borderColor = "";
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      if (typeof showToast === "function")
        showToast("Voice error: " + event.error);
      micBtn.style.color = "";
      micBtn.style.borderColor = "";
    };
  }
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
 * Toggles the Canvas mode state (and visibility if forced false).
 */
function toggleCanvasMode(forceState) {
  const newState = forceState ?? !isCanvasModeActive;

  if (newState === false) {
    isCanvasModeActive = false;
    if (canvasToggleBtn) canvasToggleBtn.classList.remove("active");
    if (canvasPane) canvasPane.classList.remove("active");
    if (typeof showToast === "function") showToast("Canvas Mode Disabled");
  } else {
    isCanvasModeActive = true;
    if (canvasToggleBtn) canvasToggleBtn.classList.add("active");
    if (typeof showToast === "function") showToast("Canvas Mode Enabled");
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

  // Update UI
  if (isWebSearchActive) {
    btn.classList.add("active");
    if (typeof showToast === "function") showToast("Web Search Enabled");
  } else {
    btn.classList.remove("active");
    if (typeof showToast === "function") showToast("Web Search Disabled");
  }
}

/**
 * Switches between 'code' and 'preview' tabs in the canvas.
 */
function switchCanvasTab(tabName) {
  if (tabName === "code") {
    canvasTabCode.classList.add("active");
    canvasTabPreview.classList.remove("active");

    canvasContent.style.display = "block";
    canvasPreviewWrapper.style.display = "none";
  } else if (tabName === "preview") {
    canvasTabCode.classList.remove("active");
    canvasTabPreview.classList.add("active");

    canvasContent.style.display = "none";
    canvasPreviewWrapper.style.display = "flex";

    generatePreview();
  }
}

/**
 * Renders the code from the code block into the preview iframe.
 */
function generatePreview() {
  if (!canvasCodeBlock || !canvasPreviewIframe || !canvasPreviewPlaceholder)
    return;

  const code = canvasCodeBlock.textContent;

  if (!code || code.trim() === "") {
    canvasPreviewIframe.style.display = "none";
    canvasPreviewPlaceholder.style.display = "flex";
  } else {
    canvasPreviewIframe.style.display = "block";
    canvasPreviewPlaceholder.style.display = "none";

    const trimmedCode = code.trim();
    let finalHtmlContent;

    const baseHtmlStart = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body, html { margin: 0; padding: 0; height: 100%; width: 100%; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body>
`;
    const baseHtmlEnd = `
</body>
</html>
        `;

    if (
      trimmedCode.toLowerCase().startsWith("<!doctype html") ||
      trimmedCode.toLowerCase().startsWith("<html")
    ) {
      finalHtmlContent = code;
    } else if (trimmedCode.startsWith("<")) {
      finalHtmlContent = `${baseHtmlStart}
    ${code}
${baseHtmlEnd}`;
    } else if (
      trimmedCode.includes("function") ||
      trimmedCode.includes("const")
    ) {
      finalHtmlContent = `${baseHtmlStart}
    <div style="padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
        <h3 style="margin-top:0;">JavaScript/Angular/React Code Display</h3>
        <p>This appears to be standalone logic that requires a surrounding HTML structure or framework to run. Displaying it below:</p>
        <pre style="background:#fff; padding: 10px; border: 1px solid #ccc; border-radius: 4px; overflow-x: auto;"><code>${code
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .trim()}</code></pre>
    </div>
${baseHtmlEnd}`;
    } else {
      finalHtmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CSS Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { margin: 0; padding: 10px; font-family: 'Inter', sans-serif; background: white; }
        
        /* --- AI Generated CSS --- */
        ${code}
        /* --- End AI Generated CSS --- */
    </style>
</head>
<body>
    <div style="padding: 20px; background-color: #f0f0f0; border-radius: 8px;">
        <h1>CSS Preview Demo</h1>
        <p>This is placeholder content to preview the styles you generated.</p>
        <div class="card" style="margin-top: 15px; border: 1px solid #ddd; padding: 1em; border-radius: 8px; max-width: 300px;">
            <p style="margin-top:0;">Sample Card Element</p>
            <button class="btn" style="padding: 8px 12px; border:none; background-color: #007bff; color: white; border-radius: 4px; cursor: pointer;">Click Me</button>
        </div>
    </div>
</body>
</html>
        `;
    }

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
  a.download = "lynq-ai-canvas.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (typeof showToast === "function") showToast("Code download started.");
}

/**
 * Handles the file upload event, specifically for PDFs.
 */
async function handlePdfUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    if (typeof showToast === "function")
      showToast("Only PDF files are supported.");
    fileUploadInput.value = "";
    return;
  }

  const pill = createAttachmentPill(
    `<i class="fa-solid fa-spinner fa-spin"></i> Processing "${file.name}"...`,
    true
  );
  attachmentPreviewContainer.innerHTML = "";
  attachmentPreviewContainer.appendChild(pill);

  try {
    const fileReader = new FileReader();
    fileReader.onload = async function () {
      const typedarray = new Uint8Array(this.result);
      // pdfjsLib is globally available from the script tag in index.html
      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      let extractedText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        extractedText +=
          textContent.items.map((item) => item.str).join(" ") + "\n";
      }

      currentAttachment = {
        name: file.name,
        text: extractedText,
        type: "pdf",
      };

      pill.remove();
      createAttachmentPill(file.name);

      if (typeof showToast === "function")
        showToast(`Attached "${file.name}" (${pdf.numPages} pages)`);
      chatInput.focus();
    };
    fileReader.readAsArrayBuffer(file);
  } catch (error) {
    console.error("Error parsing PDF:", error);
    if (typeof showToast === "function") showToast("Failed to process PDF.");
    pill.remove();
    currentAttachment = null;
  } finally {
    fileUploadInput.value = "";
  }
}

/**
 * Creates and displays the attachment "pill" above the text input.
 */
function createAttachmentPill(fileName, isProcessing = false) {
  const pill = document.createElement("div");
  pill.className = "attachment-pill";

  let icon = '<i class="fa-solid fa-file-pdf"></i>';
  let nameHTML = `<span>${fileName}</span>`;

  if (isProcessing) {
    nameHTML = fileName;
  } else {
    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Remove file";
    closeBtn.onclick = () => {
      currentAttachment = null;
      pill.remove();
      if (typeof showToast === "function") showToast("Attachment removed.");
    };
    pill.appendChild(closeBtn);
  }

  pill.insertAdjacentHTML("afterbegin", `${icon} ${nameHTML}`);

  if (!isProcessing) {
    attachmentPreviewContainer.innerHTML = "";
    attachmentPreviewContainer.appendChild(pill);
  }

  return pill;
}

function sendSuggestion(text) {
  if (chatInput) {
    chatInput.value = text;
    handleSend();
  }
}

/**
 * CLEANS UP: Centralized function to reset the canvas UI state.
 */
function resetCanvasUI() {
  if (canvasPlaceholder) canvasPlaceholder.style.display = "flex";
  if (canvasCodeBlock) canvasCodeBlock.textContent = "";
  if (canvasPreviewIframe) canvasPreviewIframe.srcdoc = "";
  if (canvasPreviewPlaceholder) canvasPreviewPlaceholder.style.display = "flex";
  switchCanvasTab("code");
  toggleCanvasMode(false);
}

/**
 * Resets the current chat view and state to a new chat.
 */
function resetChat() {
  // 1. Show Welcome Screen & Clear Messages
  if (welcomeScreen) {
    welcomeScreen.style.display = "flex";
    // Add a subtle fade-in animation for the welcome screen
    welcomeScreen.style.animation = "fadeIn 0.4s ease forwards";
  }
  if (messagesWrapper) messagesWrapper.innerHTML = "";

  // 2. Reset Global State (defined in script.js)
  mainChatHistory = [];
  isNewChat = true;
  activeChatId = null;

  // 3. Reset Attachments & Canvas
  currentAttachment = null;
  if (attachmentPreviewContainer) attachmentPreviewContainer.innerHTML = "";
  resetCanvasUI();

  // 4. Refresh Sidebar UI (Active state removal)
  if (typeof renderRecentChats === "function") renderRecentChats();

  // 5. Update URL (Clean URL)
  if (window.history && window.history.pushState) {
    const newUrl = window.location.pathname;
    history.pushState({}, document.title, newUrl);
  }

  // --- NEW: Close sidebar with a smooth delay on mobile ---
  if (window.innerWidth <= 768 && typeof closeSidebar === "function") {
    // Wait 150ms so the user sees the button press, then slide out
    setTimeout(() => {
      closeSidebar();
    }, 200);
  }
}

/**
 * Loads an existing chat's history into the view.
 */
async function loadChat(chatId) {
  // --- NEW: Auth Check ---
  // currentUser is global in script.js
  if (!currentUser) return;
  // getAuthToken and handleAuthError are global in script.js/auth.js
  const token = await getAuthToken();
  if (!token) {
    handleAuthError();
    return;
  }
  // --- END NEW ---

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

  // 1. Fetch the full chat history from the server
  try {
    const response = await fetch(`${CHAT_API_BASE}/${chatId}`, {
      // --- NEW: Add Auth Header ---
      headers: {
        Authorization: `Bearer ${token}`,
      },
      // --- END NEW ---
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

    // 2. Render messages
    mainChatHistory.forEach((msg) => {
      addMessage(msg.content, msg.role, true, msg.attachment);
    });

    const chatContainer = document.getElementById("chat-container");
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

    // 3. Reset attachments and canvas when loading a chat (clean slate)
    currentAttachment = null;
    if (attachmentPreviewContainer) attachmentPreviewContainer.innerHTML = "";

    resetCanvasUI(); // Use centralized function

    // 4. Update sidebar visual state (which happens in renderRecentChats)
    if (typeof renderRecentChats === "function") renderRecentChats();
  } catch (error) {
    console.error("Error loading chat:", error);
    if (typeof showToast === "function")
      showToast(`Failed to load chat history: ${error.message}`);
    resetChat(); // Reset to new chat state on failure
  }
}

/**
 * CLEANS UP: Centralized logic for building the system prompt with context.
 * This is used by both handleSend and regenerateResponseAfterEdit.
 */
async function buildContextualSystemMessage(attachment, isCanvasActive) {
  let contextAddon = "";

  if (attachment && attachment.text) {
    let pdfContext = attachment.text;

    if (pdfContext.length > TOKEN_LIMIT * 4) {
      pdfContext = pdfContext.substring(0, TOKEN_LIMIT * 4);
      if (typeof showToast === "function")
        showToast(
          "Note: The PDF is very large and was truncated to fit the AI's context limit."
        );
    }

    contextAddon = `
--- CONTEXT: ATTACHED PDF DOCUMENT ---
The user has provided the following text extracted from a PDF document. Base your answer primarily on this text if the question is related to its content.

PDF CONTENT:
${pdfContext}
--- END PDF CONTEXT ---
`;
} else if (isCanvasActive) {
    contextAddon = `You are an Expert Software Engineer, Full-Stack Developer, and UI/UX Specialist. Your goal is to generate "Canvas-ready" artifacts—complete, self-contained, and visually stunning code that renders immediately.

========================
   CORE BEHAVIOR RULES
========================
- **Single-File Priority:** For any UI/Web request, prioritize generating a single 'index.html' file.
- **Modern Aesthetics:** Default to 2025 design trends (Bento grids, Glassmorphism, Neubrutalism if fitting, large typography, Inter/system fonts).
- **No Conversation Fluff:** Do not explain "Here is the code." Just provide the summary and the code.
- **Complete Solutions:** Never use comments like "// ...rest of code". Write every line.

========================
      RESPONSE FORMAT
========================
1) **Artifact Title:** (e.g., "SaaS Dashboard - Dark Mode")
2) **The Code:** (Full, functional, copy-paste ready)
3) **Implementation Details:** (Brief bullet points on libraries used, trade-offs, or keyboard shortcuts)

========================
        MODES
========================

(1) FRONTEND / WEB CANVAS MODE ⭐ HIGH PRIORITY
Triggered by: "website", "UI", "landing page", "dashboard", "component", "html"

🚨 CRITICAL: OUTPUT A SINGLE, RUNNABLE HTML FILE.
- **Styling:** Tailwind CSS (CDN).
- **Icons:** FontAwesome or Phosphor Icons (CDN).
- **Fonts:** Google Fonts (Inter, Roboto, or Poppins).
- **Data Viz:** Use Chart.js (CDN) if a dashboard or graph is requested.
- **3D/Fun:** Use Three.js or GSAP (CDN) if animations are requested.

**INTERACTIVITY & LOGIC (CRITICAL):**
- **Never Static:** Buttons must click, forms must validate, modals must open/close.
- **Mocking:** If an API is needed, simulate it using \`setTimeout\` and mock JSON data inside the JS. Show "Loading..." states.
- **Toast Notifications:** If a user submits a form, show a visual success message (e.g., a toast notification) instead of \`console.log\`.

**RESPONSIVENESS (MOBILE FIRST):**
- Use Tailwind responsive prefixes (\`md:flex\`, \`lg:w-1/2\`).
- Ensure Hamburger Menus work on mobile (JavaScript toggle logic required).
- Prevent horizontal scrolling on mobile devices.

**ACCESSIBILITY (A11Y):**
- Use semantic HTML tags (\`<main>\`, \`<nav>\`, \`<section>\`, \`<button>\`).
- Add \`aria-label\` to icon-only buttons.
- Ensure proper color contrast ratios.

Structure:
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Canvas Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { font-family: 'Inter', sans-serif; }
        /* Glassmorphism Utilities */
        .glass { background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
        
        /* Mobile Overrides */
        @media (max-width: 768px) {
            .mobile-hide { display: none; }
        }
    </style>
</head>
<body class="bg-gray-50 text-gray-900 antialiased selection:bg-blue-500 selection:text-white">
    <script>
        // DOM LOGIC & MOCK DATA
        // Ensure strictly no external .js file references
        document.addEventListener('DOMContentLoaded', () => {
             // Initialization code
        });
    </script>
</body>
</html>
\`\`\`

**Visual Guidelines:**
- Use **https://placehold.co/600x400?text=Description** for placeholders.
- Use subtle gradients and shadows (\`shadow-lg\`, \`shadow-indigo-500/20\`) to add depth.

(2) REACT / PREVIEW MODE
Triggered by: "React", "hook", "app"
- **Single File Pattern:** Use Babel standalone to run JSX in the browser.
- **Imports:** \`<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>\`
- **Structure:**
  \`<script type="text/babel">
     const { useState, useEffect } = React;
     function App() { ... }
     const root = ReactDOM.createRoot(document.getElementById('root'));
     root.render(<App />);
   </script>\`

(3) BACKEND / LOGIC MODE
Triggered by: "Node", "Python", "SQL", "Algorithm"
- Provide clean, secure, and idiomatic code.
- Use async/await for asynchronous operations.
- Explain Time/Space complexity (Big O) if relevant to algorithms.

========================
      SAFETY & QUALITY
========================
- **Security:** Sanitize inputs in examples (XSS prevention).
- **Stability:** Avoid \`alert()\` loops or infinite recursion.
- **Privacy:** Do not generate PII.

--- END CANVAS CONTEXT ---`;
  }

  // getSystemMessage is global in script.js
  return getSystemMessage(contextAddon);
}

/**
 * Handles sending the user's message and initiating the API call.
 */
async function handleSend() {
  if (!chatInput) return;
  const text = chatInput.value.trim();
  // --- NEW: Close sidebar automatically ---
  if (typeof closeSidebar === "function") closeSidebar();
  // --- MODIFIED: Auth Check ---
  // We no longer block guests, just check if they are one
  const isGuest = !currentUser;
  if (!isGuest) {
    console.log("Sending as logged-in user:", currentUser.uid);
  } else {
    console.log("Sending as guest.");
  }
  // --- END MODIFIED ---

  if (!text && !currentAttachment) return;

  if (welcomeScreen) welcomeScreen.style.display = "none";
  chatInput.value = "";
  chatInput.style.height = "auto";

  const newlyAttachedFile = currentAttachment;
  currentAttachment = null;
  if (attachmentPreviewContainer) attachmentPreviewContainer.innerHTML = "";

  // --- NEW CHAT LOGIC ---
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

    // --- MODIFIED: Always add to the local session, guest or not ---
    recentChats.push(newChat);
    activeChatId = newChat.id;
    isNewChat = false;
    mainChatHistory = newChat.history;
    currentChat = newChat;

    // Update URL immediately for the new chat
    const newUrl = window.location.pathname + `?chatId=${activeChatId}`;
    history.pushState({ chatId: activeChatId }, newChat.title, newUrl);

    if (typeof renderRecentChats === "function") renderRecentChats();
    // --- END MODIFIED ---
  }

  // Sanitize history for API: keep only role and content
  // History is now defined with 'let' to allow trimming (slicing)
  let historyForApi = mainChatHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // === FIXED WINDOW LOGIC: Send only the last 4 messages (2 turns) ===
  const MAX_MESSAGES = 2;
  if (historyForApi.length > MAX_MESSAGES) {
    // Use slice to keep only the last N messages
    historyForApi = historyForApi.slice(historyForApi.length - MAX_MESSAGES);
    console.warn(`Trimmed history to the last ${MAX_MESSAGES} messages.`);
  }
  // ===================================================================

  // Store user message and attachment locally
  mainChatHistory.push({
    role: "user",
    content: text,
    attachment: newlyAttachedFile,
  });

  // Update the master list
  if (currentChat) {
    currentChat.history = mainChatHistory;
  }

  addMessage(text, "user", false, newlyAttachedFile);

  // --- Save to DB before calling AI ---
  // --- MODIFIED: Only save if NOT guest ---
  if (currentChat && !isGuest) {
    await saveChat({
      id: activeChatId,
      title: currentChat.title,
      history: mainChatHistory,
      pinned: currentChat.pinned,
    });
  }
  // --- End Save to DB ---

  const thinkingBubble = showThinking();

  isResponding = true;
  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "flex";

  if (currentController) currentController.abort();
  currentController = new AbortController();

  const signal = currentController.signal;

  // --- DYNAMIC SYSTEM PROMPT CONSTRUCTION (Contextual instructions added) ---
  let contextAttachment = newlyAttachedFile;

  // 1. Determine PDF context (new or from history)
  if (
    !contextAttachment &&
    mainChatHistory.length > 0 &&
    mainChatHistory[0].attachment &&
    mainChatHistory[0].attachment.text
  ) {
    contextAttachment = mainChatHistory[0].attachment;
  }

  // 2. Build the final system message using the centralized function
  const finalSystemMessage = await buildContextualSystemMessage(
    contextAttachment,
    isCanvasModeActive
  );

  try {
    // getApiResponse is global in script.js
    const response = await getApiResponse(
      text,
      finalSystemMessage,
      historyForApi,
      signal,
      isWebSearchActive
    );

    if (!response || typeof response !== "string" || response.trim() === "") {
      if (typeof showApiError === "function")
        showApiError(
          "The API returned an empty or invalid response.",
          thinkingBubble
        );
      if (sendBtn) sendBtn.style.display = "flex";
      if (stopBtn) stopBtn.style.display = "none";
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

    if (thinkingBubble) thinkingBubble.remove();
    if (isResponding) {
      await streamResponse(response);
    }

    // --- Save to DB after receiving AI response ---
    // --- MODIFIED: Only save if NOT guest ---
    if (currentChat && !isGuest) {
      await saveChat({
        id: activeChatId,
        title: currentChat.title,
        history: mainChatHistory,
        pinned: currentChat.pinned,
      });
    }
    // --- End Save to DB ---
  } catch (error) {
    if (typeof showApiError === "function")
      showApiError(
        error.message || "An unknown API error occurred.",
        thinkingBubble
      );
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) stopBtn.style.display = "none";
    isResponding = false;
  } finally {
    currentController = null;
  }
}

/**
 * Stops the current API response stream.
 */
function stopResponse() {
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
  isResponding = false;
  if (sendBtn) sendBtn.style.display = "flex";
  if (stopBtn) stopBtn.style.display = "none";
}

/**
 * Shows the "thinking" bubble in the chat.
 */
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
  // FIX: Revert to scrolling to the bottom to see the new message
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

  return msgDiv;
}

/**
 * Streams the response text to the chat bubble and the code to the canvas.
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
      if (canvasPane) canvasPane.classList.add("active");
      codeToCanvas = code;
      codeNeedsStreaming = true;

      if (!text.trim()) {
        textToStream =
          "I've sent the generated code to the canvas. Take a look at the code or preview tab!";
      } else {
        textToStream = text;
      }
    }
  }

  // 2. Prepare the code block update if code was found
  if (codeNeedsStreaming) {
    const newCode = codeToCanvas;
    let lang = "plaintext";
    if (newCode.includes("<") || newCode.includes(">")) {
      lang = "html";
    } else if (newCode.includes("function") || newCode.includes("const")) {
      lang = "javascript";
    }
    canvasCodeBlock.className = `language-${lang}`;

    canvasCodeBlock.textContent = "";
    switchCanvasTab("code");
    if (canvasPlaceholder) canvasPlaceholder.style.display = "none";

    const codeStreamPromise = streamCodeToCanvas(codeToCanvas, lang);

    await streamTextToBubble(textToStream, bubble);

    await codeStreamPromise;
  } else {
    await streamTextToBubble(fullText, bubble);
  }

  // 3. Finalize UI after all streaming is done
  const sendBtn = document.getElementById("send-btn");
  const stopBtn = document.getElementById("stop-btn");

  // --- NEW: PROCESS VIDEO EMBEDS ---
  embedYouTubeVideos(bubble);

  if (sendBtn) sendBtn.style.display = "flex";
  if (stopBtn) stopBtn.style.display = "none";
  isResponding = false;

  // 4. Set final message actions
  const parentWrapper = bubble.parentElement;
  const actionsDiv = parentWrapper.querySelector(".message-actions");

  const copyBtn = actionsDiv.querySelector(".fa-copy").parentElement;
  copyBtn.onclick = () => {
    const textToCopy = codeToCanvas || fullText;
    copyToClipboard(textToCopy, copyBtn);
  };

  const shareBtn = actionsDiv.querySelector(".fa-share-nodes").parentElement;
  shareBtn.onclick = () => shareResponse(fullText);
}

/**
 * Helper function to stream text to the chat bubble.
 */
async function streamTextToBubble(textToStream, bubble) {
  const words = textToStream.split(" ");
  let currentText = "";

  for (let i = 0; i < words.length; i++) {
    if (!isResponding) {
      currentText += words[i] + " ";
      break;
    }

    currentText += words[i] + " ";

    let displayHtml = marked.parse(currentText);

    bubble.innerHTML = displayHtml;

    const chatContainer = document.getElementById("chat-container");
    if (chatContainer) {
      // Check if the user is currently near the bottom (within 50 pixels tolerance)
      // This allows manual scrolling away from the bottom without being pulled back.
      const isUserAtBottom =
        chatContainer.scrollHeight -
        chatContainer.scrollTop -
        chatContainer.clientHeight <
        50;

      if (isUserAtBottom) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }

    await new Promise((r) =>
      setTimeout(r, Math.floor(Math.random() * 30) + 30)
    );
  }

  bubble.innerHTML = marked.parse(currentText.trim());
  bubble
    .querySelectorAll("pre code")
    .forEach((block) => hljs.highlightElement(block));
}

/**
 * Streams code to the canvas code block.
 */
async function streamCodeToCanvas(codeString, lang) {
  const chunks = codeString.match(/(\s+|\S+)/g) || [];
  const editorPane = canvasCodeBlock.parentElement;

  for (const chunk of chunks) {
    if (!isResponding) {
      break;
    }
    canvasCodeBlock.textContent += chunk;

    if (
      editorPane.scrollTop + editorPane.clientHeight >=
      editorPane.scrollHeight - 50
    ) {
      editorPane.scrollTop = editorPane.scrollHeight;
    }

    await new Promise((r) => setTimeout(r, 1));
  }

  canvasCodeBlock.textContent = codeString;
  if (typeof hljs !== "undefined") {
    hljs.highlightElement(canvasCodeBlock);
  }
}

/**
 * Extracts code blocks from raw text.
 */
function parseCodeFromResponse(rawText) {
  const codeRegex = /```(\w+)?\s*([\s\S]+?)```/g;
  let codeBlocks = [];

  const CODE_PLACEHOLDER = "___CODE_BLOCK_PLACEHOLDER___";

  const textContentWithPlaceholders = rawText.replace(
    codeRegex,
    (match, lang, code) => {
      codeBlocks.push(code.trim());
      return CODE_PLACEHOLDER;
    }
  );

  let textContent = textContentWithPlaceholders.trim();
  textContent = textContent.replace(new RegExp(CODE_PLACEHOLDER, "g"), "");

  return {
    code: codeBlocks.join("\n\n// --- (New Code Block) ---\n\n"),
    text: textContent.trim(),
  };
}

/**
 * Fallback to clipboard function.
 */
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
    if (typeof showToast === "function")
      showToast("Clipboard access denied. Copy manually.");
  }
}

/**
 * Fallback for sharing functionality.
 */
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

/**
 * Toggles the edit mode for a user message.
 */
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
        // Find the index of the message we are editing, using the original text for reference
        (m) => m.role === "user" && m.content === originalText
      );

      // If found, slice history to keep only messages before the edited one
      if (msgIndex > -1) {
        mainChatHistory = mainChatHistory.slice(0, msgIndex);
      } else {
        // Fallback: If not found, reset history (shouldn't happen)
        mainChatHistory = [];
      }

      // Remove all subsequent messages (AI replies to the edited message)
      let currentMsgEl = msgWrapper.parentElement;
      while (currentMsgEl.nextElementSibling) {
        currentMsgEl.nextElementSibling.remove();
      }

      // Add the updated user message back to history
      mainChatHistory.push({
        role: "user",
        content: newText,
        attachment: originalAttachment,
      });

      // Update the master list
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

/**
 * Regenerates the AI response after a user message has been edited.
 */
async function regenerateResponseAfterEdit(newPrompt, attachment) {
  // --- NEW: Check for guest ---
  const isGuest = !currentUser;

  isResponding = true;
  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "flex";

  const thinking = showThinking();

  if (currentController) currentController.abort();
  currentController = new AbortController();

  const signal = currentController.signal;

  // History for API excludes the last user message, which is the current prompt
  const historyForApi = mainChatHistory.slice(0, -1).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // --- DYNAMIC SYSTEM PROMPT CONSTRUCTION ---
  const finalSystemMessage = await buildContextualSystemMessage(
    attachment,
    isCanvasModeActive
  );

  try {
    // getApiResponse is global in script.js
    const response = await getApiResponse(
      newPrompt,
      finalSystemMessage,
      historyForApi,
      signal
    );

    if (!response || typeof response !== "string" || response.trim() === "") {
      if (typeof showApiError === "function")
        showApiError(
          "The API returned an empty or invalid response.",
          thinking
        );
      if (sendBtn) sendBtn.style.display = "flex";
      if (stopBtn) stopBtn.style.display = "none";
      isResponding = false;
      return;
    }

    // Add new AI response to history
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
    await streamResponse(response); // Await the stream to ensure save happens last

    // --- Save to DB after receiving AI response ---
    // --- MODIFIED: Only save if NOT guest ---
    if (currentChat && !isGuest) {
      await saveChat({
        id: activeChatId,
        title: currentChat.title,
        history: mainChatHistory,
        pinned: currentChat.pinned,
      });
    }
    // --- End Save to DB ---
  } catch (error) {
    if (typeof showApiError === "function")
      showApiError(error.message || "An unknown API error occurred.", thinking);
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) stopBtn.style.display = "none";
    isResponding = false;
  } finally {
    currentController = null;
  }
}

/**
 * Creates and appends a message element to the chat window.
 */
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

    const pill = document.createElement("div");
    pill.className = "attachment-pill";
    pill.innerHTML = `<i class="fa-solid fa-file-pdf"></i> <span>${attachment.name}</span>`;

    attachmentContainer.appendChild(pill);
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
      // marked is globally available from index.html script tag
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
    const rawText = text;
    const rawAttachment = attachment;
    editBtn.onclick = () => toggleEdit(contentWrapper, rawText, rawAttachment);

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
    // hljs is globally available from index.html script tag
    bubble.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block);
    });
  }

  const chatContainer = document.getElementById("chat-container");
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

  return bubble;
}

/**
 * Initiates the regeneration process for an AI message.
 */
function regenerateMessage(msgDiv) {
  const userMsg = msgDiv.previousElementSibling;
  if (!userMsg) return;

  // 1. Remove the current AI response and any subsequent messages
  while (userMsg.nextElementSibling) {
    userMsg.nextElementSibling.remove();
  }

  const userMsgContentEl = userMsg.querySelector(".bubble");
  if (!userMsgContentEl) return;
  const userPromptText = userMsgContentEl.innerText.trim();

  // 2. Find the index and attachment of the last user message
  let attachment = null;
  const userMsgIndex = mainChatHistory.findIndex(
    (m) => m.role === "user" && m.content === userPromptText
  );
  if (userMsgIndex > -1) {
    attachment = mainChatHistory[userMsgIndex].attachment;
  }

  // 3. Trim the history array to the user message
  if (userMsgIndex > -1) {
    mainChatHistory = mainChatHistory.slice(0, userMsgIndex);
  } else {
    // If we can't find the message in history (error state), stop.
    mainChatHistory = [];
    return;
  }

  // 4. Re-add the user prompt (since it was just removed in step 3)
  mainChatHistory.push({
    role: "user",
    content: userPromptText,
    attachment: attachment,
  });

  const currentChat = recentChats.find((c) => c.id === activeChatId);
  if (currentChat) {
    currentChat.history = mainChatHistory;
  }

  // 5. Trigger regeneration
  regenerateResponseAfterEdit(userPromptText, attachment);
}

document.addEventListener("DOMContentLoaded", () => {
  // --- Get Home/Chat Page elements ---
  chatInput = document.getElementById("chat-input");
  messagesWrapper = document.getElementById("messages-wrapper");
  welcomeScreen = document.getElementById("welcome-screen");
  sendBtn = document.getElementById("send-btn");
  stopBtn = document.getElementById("stop-btn");

  canvasToggleBtn = document.getElementById("canvas-toggle-btn");
  canvasPane = document.getElementById("canvas-pane");
  canvasCloseBtn = document.getElementById("canvas-close-btn");
  canvasCodeBlock = document.getElementById("canvas-code-block");
  canvasPlaceholder = document.getElementById("canvas-placeholder");
  canvasTabCode = document.getElementById("canvas-tab-code");
  canvasTabPreview = document.getElementById("canvas-tab-preview");
  canvasDownloadBtn = document.getElementById("canvas-download-btn");
  canvasContent = document.getElementById("canvas-content");
  canvasPreviewWrapper = document.getElementById("canvas-preview-wrapper");
  canvasPreviewIframe = document.getElementById("canvas-preview-iframe");
  canvasPreviewPlaceholder = document.getElementById(
    "canvas-preview-placeholder"
  );

  toolsToggleBtn = document.getElementById("tools-toggle-btn");
  toolsDropdown = document.getElementById("tools-dropdown");

  attachFileBtn = document.getElementById("attach-file-btn");
  fileUploadInput = document.getElementById("file-upload");
  attachmentPreviewContainer = document.getElementById(
    "attachment-preview-container"
  );

  // --- NEW: Web Search Button Listener ---
  const webSearchBtn = document.getElementById("web-search-toggle-btn");
  if (webSearchBtn) {
    webSearchBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Keep dropdown open so user sees the toggle happen
      toggleWebSearch();
    });
  }
  // --- Initialize Home/Chat Page Listeners ---
  if (chatInput) {
    setTimeout(initVoiceInput, 100);

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

    if (toolsToggleBtn) {
      toolsToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleToolsDropdown();
      });
    }

    if (canvasToggleBtn) {
      canvasToggleBtn.addEventListener("click", () => {
        toggleCanvasMode();
        toggleToolsDropdown(false);
      });
    }
    if (canvasCloseBtn) {
      canvasCloseBtn.addEventListener("click", () => toggleCanvasMode(false));
    }
    if (canvasTabCode) {
      canvasTabCode.addEventListener("click", () => switchCanvasTab("code"));
    }
    if (canvasTabPreview) {
      canvasTabPreview.addEventListener("click", () =>
        switchCanvasTab("preview")
      );
    }
    if (canvasDownloadBtn) {
      canvasDownloadBtn.addEventListener("click", downloadCanvasCode);
    }

    if (attachFileBtn) {
      attachFileBtn.addEventListener("click", () => {
        fileUploadInput.click();
      });
    }
    if (fileUploadInput) {
      fileUploadInput.addEventListener("change", handlePdfUpload);
    }

    // --- FIX: Hide welcome screen if a chat is loaded via URL on page load ---
    // The activeChatId is set in script.js's loadState() which runs before this.
    if (welcomeScreen && activeChatId) {
      welcomeScreen.style.display = "none";
    }
  }

  // Listen for clicks outside the tools dropdown
  window.addEventListener("click", (event) => {
    if (toolsDropdown && toolsDropdown.classList.contains("active")) {
      if (
        !toolsDropdown.contains(event.target) &&
        !toolsToggleBtn.contains(event.target)
      ) {
        toggleToolsDropdown(false);
      }
    }
  });
});

/**
 * Scans a message bubble for YouTube links and appends an iframe player.
 */
/**
 * FINAL YouTube Embedder
 * Scans for both clickable links AND raw text URLs.
 * Converts the FIRST found video into a player.
 */
/**
 * FINAL YouTube Embedder
 * 1. Regex fixed (Removed 'g' flag to correctly capture ID).
 * 2. REPLACES the text link with the video player.
 */
function embedYouTubeVideos(bubbleElement) {
  console.log("🎬 Scanning for YouTube videos...");

  // IMPORTANT: Removed the 'g' flag at the end.
  // This ensures match[1] correctly grabs the 11-character ID.
  const ytRegex =
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

  const links = bubbleElement.querySelectorAll("a");

  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    // Test the link against the regex
    const match = href.match(ytRegex);

    // match[1] will now be the Video ID (e.g., "dQw4w9WgXcQ")
    if (match && match[1]) {
      const videoId = match[1];
      console.log("✅ Video ID found:", videoId);
      createVideoPlayer(link, videoId);
    }
  });
}

/**
 * Helper: Creates the Iframe and Swaps it with the Link
 */
function createVideoPlayer(linkElement, videoId) {
  // Create the container
  const container = document.createElement("div");
  container.className = "video-embed-container";

  // Create the Iframe
  const iframe = document.createElement("iframe");
  // rel=0 ensures no random videos show up after it ends
  iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&autoplay=0`;
  iframe.className = "yt-embed";
  iframe.setAttribute("allowFullScreen", "");
  iframe.setAttribute(
    "allow",
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  );

  container.appendChild(iframe);

  // --- REPLACE LOGIC ---
  // This swaps the blue <a> link with the video player <div>
  if (linkElement.parentNode) {
    linkElement.replaceWith(container);
  }
}
