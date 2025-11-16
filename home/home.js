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
// Canvas elements
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
// Tools Dropdown
let toolsToggleBtn;
let toolsDropdown;
let pdfChatToggleBtn; // This is now hidden, but logic could remain
// PDF / Attachment Elements
let attachFileBtn;
let fileUploadInput;
let attachmentPreviewContainer;

// --- STATE (Page Specific) ---
let isCanvasModeActive = false; // State for canvas mode toggle
let currentAttachment = null; // Holds { name: "...", text: "...", type: "pdf" }

document.addEventListener("DOMContentLoaded", () => {
  // --- Get Page-Specific Elements ---
  chatInput = document.getElementById("chat-input");
  messagesWrapper = document.getElementById("messages-wrapper");
  welcomeScreen = document.getElementById("welcome-screen");
  sendBtn = document.getElementById("send-btn");
  stopBtn = document.getElementById("stop-btn");

  // Get Canvas Elements
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

  // Get Tools Dropdown Elements
  toolsToggleBtn = document.getElementById("tools-toggle-btn");
  toolsDropdown = document.getElementById("tools-dropdown");
  pdfChatToggleBtn = document.getElementById("pdf-chat-btn");

  // Get PDF / Attachment Elements
  attachFileBtn = document.getElementById("attach-file-btn");
  fileUploadInput = document.getElementById("file-upload");
  attachmentPreviewContainer = document.getElementById(
    "attachment-preview-container"
  );

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

  // --- TOOLS DROPDOWN LISTENERS ---
  if (toolsToggleBtn) {
    toolsToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleToolsDropdown();
    });
  }

  // Add a global click listener to close the dropdown
  document.addEventListener("click", (e) => {
    if (toolsDropdown && toolsDropdown.classList.contains("active")) {
      if (
        !toolsDropdown.contains(e.target) &&
        !toolsToggleBtn.contains(e.target)
      ) {
        toggleToolsDropdown(false);
      }
    }
  });

  // --- CANVAS LISTENERS ---
  if (canvasToggleBtn) {
    canvasToggleBtn.addEventListener("click", () => {
      toggleCanvasMode();
      toggleToolsDropdown(false); // Close dropdown on selection
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

  // --- PDF / ATTACHMENT LISTENERS ---
  if (attachFileBtn) {
    attachFileBtn.addEventListener("click", () => {
      fileUploadInput.click();
    });
  }
  if (fileUploadInput) {
    fileUploadInput.addEventListener("change", handlePdfUpload);
  }

  // If we are on home page and not in a chat, show welcome
  // loadState in script.js now handles showing/hiding this
  if (welcomeScreen && !activeChatId) {
    welcomeScreen.style.display = "flex";
  }
});

// --- TOOLS DROPDOWN LOGIC ---
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
 * MODIFIED: Toggles the canvas mode STATE, but does not open the pane.
 * Only forcing 'false' (e.g., from the close button) will hide the pane.
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
    // Turning ON (Mode only, not the pane)
    isCanvasModeActive = true;
    if (canvasToggleBtn) canvasToggleBtn.classList.add("active");
    // MODIFIED: We no longer open the pane here.
    // if (canvasPane) canvasPane.classList.add("active"); // <-- This line was removed
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
  if (!canvasCodeBlock || !canvasPreviewIframe || !canvasPreviewPlaceholder)
    return;

  const code = canvasCodeBlock.textContent;

  if (!code || code.trim() === "") {
    // Show placeholder if no code
    canvasPreviewIframe.style.display = "none";
    canvasPreviewPlaceholder.style.display = "flex";
  } else {
    // Hide placeholder and show iframe
    canvasPreviewIframe.style.display = "block";
    canvasPreviewPlaceholder.style.display = "none";

    // --- MODIFIED PREVIEW WRAPPER LOGIC ---
    let finalHtmlContent;
    const trimmedCode = code.trim();

    // Case 1: The code is a full HTML document
    if (
      trimmedCode.toLowerCase().startsWith("<!doctype html") ||
      trimmedCode.toLowerCase().startsWith("<html")
    ) {
      // If it's already a full document, use it as is
      finalHtmlContent = code;
    }
    // Case 2: The code is an HTML fragment (starts with any tag)
    else if (trimmedCode.startsWith("<")) {
      // It's an HTML fragment. Wrap it in the body.
      // This will correctly render <style> or <script> tags if the AI includes them.
      finalHtmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
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
    // Case 3: It's not HTML, so assume it's CSS and apply it to a sample page.
    else {
      // It's likely just CSS. Inject it into the <head>.
      // We'll add some placeholder content to show the CSS is active.
      finalHtmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CSS Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* --- AI Generated CSS --- */
        ${code}
        /* --- End AI Generated CSS --- */
        
        /* Ensures the preview content fits well */
        body { margin: 0; padding: 10px; font-family: sans-serif; }
    </style>
</head>
<body>
    <h1>CSS Preview</h1>
    <p>This is placeholder content to preview the CSS you generated.</p>
    <br/>
    <div class="card" style="border:1px solid #ccc; padding: 1em; border-radius: 8px; max-width: 300px;">
        <p>This is a sample card element.</p>
        <button class="btn" style="padding: 8px 12px; border:none; background-color: #007bff; color: white; border-radius: 4px; cursor: pointer;">Click Me</button>
    </div>
</body>
</html>
        `;
    }
    // --- END MODIFIED PREVIEW WRAPPER LOGIC ---

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

// --- PDF ATTACHMENT LOGIC ---

/**
 * Handles the file upload event, specifically for PDFs.
 */
async function handlePdfUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    if (typeof showToast === "function")
      showToast("Only PDF files are supported.");
    fileUploadInput.value = ""; // Clear the input
    return;
  }

  // Show a temporary "processing" pill
  const pill = createAttachmentPill(
    `<i class="fa-solid fa-spinner fa-spin"></i> Processing "${file.name}"...`,
    true
  );
  attachmentPreviewContainer.innerHTML = ""; // Clear any existing pills
  attachmentPreviewContainer.appendChild(pill);

  try {
    const fileReader = new FileReader();
    fileReader.onload = async function () {
      const typedarray = new Uint8Array(this.result);
      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      let extractedText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        extractedText +=
          textContent.items.map((item) => item.str).join(" ") + "\n";
      }

      // Store the extracted text
      currentAttachment = {
        name: file.name,
        text: extractedText,
        type: "pdf",
      };

      // Update the pill to the final state
      pill.remove(); // Remove the processing pill
      createAttachmentPill(file.name); // Add the final pill

      if (typeof showToast === "function") {
        showToast(`Attached "${file.name}" (${pdf.numPages} pages)`);
      }
      chatInput.focus();
    };
    fileReader.readAsArrayBuffer(file);
  } catch (error) {
    console.error("Error parsing PDF:", error);
    if (typeof showToast === "function") showToast("Failed to process PDF.");
    pill.remove(); // Remove processing pill on error
    currentAttachment = null;
  } finally {
    fileUploadInput.value = ""; // Clear input to allow re-uploading same file
  }
}

/**
 * Creates and displays the attachment "pill" above the text input.
 * @param {string} fileName - The name of the file to display.
 * @param {boolean} [isProcessing=false] - If true, doesn't add a close button.
 * @returns {HTMLElement} The pill element.
 */
function createAttachmentPill(fileName, isProcessing = false) {
  const pill = document.createElement("div");
  pill.className = "attachment-pill";

  let icon = '<i class="fa-solid fa-file-pdf"></i>';
  let nameHTML = `<span>${fileName}</span>`;

  if (isProcessing) {
    nameHTML = fileName; // 'fileName' already contains the processing HTML
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
    attachmentPreviewContainer.innerHTML = ""; // Clear existing
    attachmentPreviewContainer.appendChild(pill);
  }

  return pill;
}

// --- END PDF LOGIC ---

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
          showToast("Listening... Speak now."); // showToast is global
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
  if (typeof mainChatHistory !== "undefined") mainChatHistory = []; // Clear the working history (global var)
  if (typeof isNewChat !== "undefined") isNewChat = true; // global var
  if (typeof activeChatId !== "undefined") activeChatId = null; // global var

  // Reset attachments
  currentAttachment = null;
  if (attachmentPreviewContainer) attachmentPreviewContainer.innerHTML = "";

  // MODIFIED: Reset canvas and tabs
  if (canvasPlaceholder) canvasPlaceholder.style.display = "flex";
  if (canvasCodeBlock) canvasCodeBlock.textContent = "";
  if (canvasPreviewIframe) canvasPreviewIframe.srcdoc = ""; // Clear iframe
  if (canvasPreviewPlaceholder) canvasPreviewPlaceholder.style.display = "flex";
  switchCanvasTab("code"); // Reset to code tab
  toggleCanvasMode(false); // Turn off canvas and close pane

  // The next two lines depend on global functions defined in script.js
  if (typeof renderRecentChats === "function") renderRecentChats(); // Re-draw sidebar (global func)
  if (typeof saveState === "function") saveState(); // global func
}

async function loadChat(chatId) {
  // This function assumes `recentChats` is defined globally in script.js
  if (typeof recentChats === "undefined") return;
  const chat = recentChats.find((chat) => chat.id == chatId); // global var
  if (!chat) return;

  if (welcomeScreen) welcomeScreen.style.display = "none";
  if (messagesWrapper) messagesWrapper.innerHTML = ""; // Clear messages

  // The next three lines depend on global variables defined in script.js
  if (typeof mainChatHistory !== "undefined") mainChatHistory = chat.history; // Point to this chat's history (global var)
  if (typeof activeChatId !== "undefined") activeChatId = chat.id; // global var
  if (typeof isNewChat !== "undefined") isNewChat = false; // global var

  // Re-draw all messages from history
  if (typeof mainChatHistory !== "undefined") {
    mainChatHistory.forEach((msg) => {
      // MODIFIED: Pass attachment info to addMessage
      addMessage(msg.content, msg.role, true, msg.attachment);
    });
  }

  const chatContainer = document.getElementById("chat-container");
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

  // Reset attachments
  currentAttachment = null;
  if (attachmentPreviewContainer) attachmentPreviewContainer.innerHTML = "";

  // MODIFIED: Reset canvas and tabs
  if (canvasPlaceholder) canvasPlaceholder.style.display = "flex";
  if (canvasCodeBlock) canvasCodeBlock.textContent = "";
  if (canvasPreviewIframe) canvasPreviewIframe.srcdoc = ""; // Clear iframe
  if (canvasPreviewPlaceholder) canvasPreviewPlaceholder.style.display = "flex";
  switchCanvasTab("code"); // Reset to code tab
  toggleCanvasMode(false); // Turn off canvas and close pane

  // The next two lines depend on global functions defined in script.js
  if (typeof renderRecentChats === "function") renderRecentChats(); // Update active state in sidebar
  if (typeof saveState === "function") saveState(); // global func
}

async function handleSend() {
  if (!chatInput) return;
  const text = chatInput.value.trim();

  // MODIFIED: Allow sending with only an attachment
  if (!text && !currentAttachment) return;

  if (welcomeScreen) welcomeScreen.style.display = "none";
  chatInput.value = "";
  chatInput.style.height = "auto";

  // --- CAPTURE ATTACHMENT ---
  // Capture the current attachment *before* clearing it
  const newlyAttachedFile = currentAttachment; // Renamed for clarity
  // Clear the attachment from the input bar
  currentAttachment = null;
  if (attachmentPreviewContainer) attachmentPreviewContainer.innerHTML = "";
  // --- END CAPTURE ---

  // --- NEW CHAT LOGIC (Relies on globals from script.js) ---
  if (typeof isNewChat !== "undefined" && isNewChat) {
    let chatTitle = text;
    if (!chatTitle && attachment) {
      chatTitle = `Chat about ${attachment.name}`;
    }

    const newChat = {
      id: Date.now(),
      title:
        chatTitle.length > 40 ? chatTitle.substring(0, 40) + "..." : chatTitle,
      history: [],
      pinned: false,
    };

    if (typeof recentChats !== "undefined") recentChats.push(newChat);
    if (typeof activeChatId !== "undefined") activeChatId = newChat.id;
    if (typeof isNewChat !== "undefined") isNewChat = false;
    if (typeof mainChatHistory !== "undefined")
      mainChatHistory = newChat.history;
    if (typeof renderRecentChats === "function") renderRecentChats();
  }

  // --- FIX: Sanitize history for API ---
  // Create a clean version of history for the API, stripping unsupported keys.
  const historyForApi =
    typeof mainChatHistory !== "undefined"
      ? mainChatHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
      : [];
  // --- END FIX ---

  if (typeof mainChatHistory !== "undefined")
    // MODIFIED: Store attachment with the *local* message history
    mainChatHistory.push({
      role: "user",
      content: text,
      attachment: newlyAttachedFile, // Use the newly attached file
    });

  // Update the master list
  const currentChat =
    typeof recentChats !== "undefined" && typeof activeChatId !== "undefined"
      ? recentChats.find((chat) => chat.id === activeChatId)
      : null;
  if (currentChat) {
    currentChat.history = mainChatHistory;
  }
  // --- END NEW CHAT LOGIC ---

  addMessage(text, "user", false, newlyAttachedFile); // Pass newly attached file to DOM

  const thinkingBubble = showThinking();

  if (typeof isResponding !== "undefined") isResponding = true;
  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "flex";

  if (typeof currentController !== "undefined") {
    if (currentController) currentController.abort();
    currentController = new AbortController();
  }

  const signal =
    typeof currentController !== "undefined" && currentController
      ? currentController.signal
      : null;

  // --- MODIFIED: DYNAMIC SYSTEM PROMPT ---
  let finalSystemMessage;
  const TOKEN_LIMIT = 4000; // Set a safe token limit

  // 1. Determine which attachment to use (new one, or one from history)
  let contextAttachment = newlyAttachedFile; // Prioritize newly attached file
  if (
    !contextAttachment &&
    typeof mainChatHistory !== "undefined" &&
    mainChatHistory.length > 0
  ) {
    // If no new file, check if the *first* message in this chat had an attachment
    if (mainChatHistory[0].attachment && mainChatHistory[0].attachment.text) {
      contextAttachment = mainChatHistory[0].attachment;
      console.log("Re-using PDF context from chat history.");
    }
  }

  // 2. Build system prompt based on whether we have context
  if (contextAttachment && contextAttachment.text) {
    // *** BEGIN PDF PROMPT MODIFICATION ***
    let pdfContext = contextAttachment.text;

    if (pdfContext.length > TOKEN_LIMIT * 4) {
      pdfContext = pdfContext.substring(0, TOKEN_LIMIT * 4);
      console.warn(
        `PDF text truncated to ${
          TOKEN_LIMIT * 4
        } characters to fit context limit.`
      );
      if (typeof showToast === "function") {
        showToast(
          "Note: The PDF is very large and was truncated to fit the AI's context limit."
        );
      }
    }

    finalSystemMessage = `You are a helpful and friendly AI assistant. The user has provided text extracted from a PDF document.

🎯 Your Goal:
Help the user by intelligently using the PDF content.

1️⃣ **If the user asks a question ABOUT the PDF content (e.g., "Summarize this," "What are the key points?"):**
- Answer based **only** on the PDF text.
- Use outside knowledge if user asks about the contents in the pdf.

2️⃣ **If the user asks you to USE the PDF content (e.g., "Answer the questions in this PDF," "Solve the problems listed"):**
- This is a special case! The PDF contains the *questions*, but you must provide the *answers* from your own general knowledge.
- First, state this clearly. Example: "Certainly! Here are the answers to the questions from the PDF, based on my general knowledge:"
- Then, proceed to answer the questions.

3️⃣ **If the user asks a general question NOT found in the PDF:**
- If the question is *related* to the PDF's topic but not *in* it (e.g., PDF is about "Dogs," user asks "What about cats?"), answer it, but note: "That information isn't in the PDF, but here's what I know about cats..."
- If the question is *completely unrelated* to the PDF (e.g., "What's the weather?"), just answer it normally.

⚠ Rules:
- Use simple and clear wording.
- Use emojis when helpful, but do not overuse them.

📝 **Output Structure:**
Your response should follow this structure (when appropriate):

**Heading (bigger font)**
Short intro paragraph.

**Subheading 1**
Explanation in simple words.

**Subheading 2**
Examples, steps, or comparison.

**Conclusion**
One short summary + ask if user wants more details.

✨ End every answer with a question that invites the user to continue the conversation.

---PDF CONTENT---
${pdfContext}
---END CONTENT---
`;
    // *** END PDF PROMPT MODIFICATION ***
  } else if (isCanvasModeActive) {
    // 1. Define the base prompt (your current prompt)
    const basePrompt = `You are an advanced AI assistant.

🎯 **Goal/Role:**
Your main job is to help the user by giving correct, useful, and clear answers. 
Always communicate like a friendly and smart teacher.

🗣️ **Tone & Style:**
- Use simple and easy English, suitable for students and beginners.
- Write in short paragraphs with clear headings and subheadings.
- Use emojis when helpful, but do not overuse them.
- If user requests: adapt writing for exams, interviews, code help, storytelling, etc.

🧩 **Response Rules:**
1⃣ Understand the user’s intention before answering.  
2⃣ If needed, ask clarifying questions.  
3⃣ Provide examples, steps, and explanations when useful.  
4⃣ If generating code, make it clean and well-commented.  
5⃣ If content may be incorrect or unsafe, warn the user first.  
6⃣ If the user asks for a format (bullet points, essay, JSON, etc.), follow it strictly.

📚 **Knowledge Behavior:**
- If you are not sure about something, say: “I’m not fully sure, but here is my best understanding.”
- Do NOT invent facts. Avoid hallucination.
- If web search is available, use it for recent facts when necessary.

📝 **Output Structure:**
Your response should follow this structure (when appropriate):

**Heading (bigger font)**
Short intro paragraph.

**Subheading 1**
Explanation in simple words.

**Subheading 2**
Examples, steps, or comparison.

**Conclusion**
One short summary + ask if user wants more details.

✨ End every answer with a question that invites the user to continue the conversation.
`;

    // 2. Define the "Canvas Mode" instructions
    const canvasModeAddon = `
  
---
You are an AI Software Engineer working in **Canvas Code Editing Mode**.

🎯 Goal:
Write, update, and refactor code with clean, correct, and production-ready output. The canvas should contain **only code** unless the user requests documentation.

🚧 Code Editing Rules:
- If user says **create new file**, start fresh with code only.
- If user says **update, modify, add, fix, or remove**, change only the required parts and keep the rest of the code intact.
- If the target change is unclear, ask:
  "Which part should I update? Please specify a function, component, or line reference."
- Do not include explanations inside the canvas unless requested as comments.

📝 Updating Existing Code:
If the user requests to **update, modify, add, or remove** something from the current canvas code:
- Edit only the necessary parts without rewriting the entire file.
- Preserve structure, formatting, and logic unless change requires otherwise.
- If location of change is unclear, ask the user:
  "Which part should I update? Please specify a function, component, or line reference."
- Output only the updated canvas code, and nothing else.

📦 Code Standards:
- Follow best practices for the language and framework being used.
- Use proper formatting, imports, indentation, and naming conventions.
- No secrets, tokens, API keys, or passwords in code.

🧪 Reliability:
- Prefer safe, stable, and maintainable code.
- Suggest improvements or error handling when useful.

🌐 Supported Code Types:
Frontend (React, Next.js, Vue, HTML, CSS, JS/TS),
Backend (Node, Express, Nest, FastAPI, Django, Laravel, Go),
Databases (MongoDB, PostgreSQL, MySQL, Redis),
APIs (REST, GraphQL, WebSockets),
DevOps configs (Docker, CI/CD, Nginx),
Config/YAML/Env files,
Documentation (README, API docs).

❌ Forbidden in Canvas:
- No emojis
- No inline explanations (unless asked)
- No unrelated text
- No rewriting entire file unless requested

🔐 Safety:
Decline malware, exploits, or illegal code and offer a safe alternative.

✨ End every coding response with:
"Should I continue editing or implement the next part?"`;
    finalSystemMessage = basePrompt + canvasModeAddon;
  } else {
    // 1. Define the base prompt (your current prompt)
    finalSystemMessage = `You are an advanced AI assistant.

🎯 **Goal/Role:**
Your main job is to help the user by giving correct, useful, and clear answers. 
Always communicate like a friendly and smart teacher.

🗣️ **Tone & Style:**
- Use simple and easy English, suitable for students and beginners.
- Write in short paragraphs with clear headings and subheadings.
- Use emojis when helpful, but do not overuse them.
- If user requests: adapt writing for exams, interviews, code help, storytelling, etc.

🧩 **Response Rules:**
1⃣ Understand the user’s intention before answering.  
2⃣ If needed, ask clarifying questions.  
3⃣ Provide examples, steps, and explanations when useful.  
4⃣ If generating code, make it clean and well-commented.  
5⃣ If content may be incorrect or unsafe, warn the user first.  
6⃣ If the user asks for a format (bullet points, essay, JSON, etc.), follow it strictly.

📚 **Knowledge Behavior:**
- If you are not sure about something, say: “I’m not fully sure, but here is my best understanding.”
- Do NOT invent facts. Avoid hallucination.
- If web search is available, use it for recent facts when necessary.

📝 **Output Structure:**
Your response should follow this structure (when appropriate):

**Heading (bigger font)**
Short intro paragraph.

**Subheading 1**
Explanation in simple words.

**Subheading 2**
Examples, steps, or comparison.

**Conclusion**
One short summary + ask if user wants more details.

✨ End every answer with a question that invites the user to continue the conversation.
`; // (Your base prompt)
  }

  // 4. Get the system message (which might also include custom instructions from settings)
  const systemMessage =
    typeof getSystemMessage === "function"
      ? getSystemMessage(finalSystemMessage) // Pass our constructed prompt to the global getter
      : finalSystemMessage; // Fallback

  try {
    // Note: This relies on a global `getApiResponse` function from script.js
    const response = await getApiResponse(
      text,
      systemMessage,
      historyForApi, // Pass the sanitized history
      signal
    );

    // --- NEW: ROBUST RESPONSE CHECK ---
    if (!response || typeof response !== "string" || response.trim() === "") {
      console.error("API returned an empty or invalid response:", response);
      if (typeof showApiError === "function") {
        showApiError(
          "The API returned an empty or invalid response.",
          thinkingBubble
        );
      } else {
        thinkingBubble.remove();
        addMessage(
          "Error: The API returned an empty or invalid response.",
          "ai",
          true
        );
      }
      if (sendBtn) sendBtn.style.display = "flex";
      if (stopBtn) stopBtn.style.display = "none";
      if (typeof isResponding !== "undefined") isResponding = false;
      return; // Stop execution here
    }
    // --- END ROBUST RESPONSE CHECK ---

    if (typeof mainChatHistory !== "undefined")
      // AI messages don't have attachments
      mainChatHistory.push({
        role: "assistant",
        content: response,
        attachment: null,
      });
    if (currentChat) {
      currentChat.history = mainChatHistory;
    }

    if (thinkingBubble) thinkingBubble.remove();
    if (typeof isResponding !== "undefined" && isResponding)
      streamResponse(response);
  } catch (error) {
    // Note: This relies on a global `showApiError` function from script.js
    console.error("API Error in handleSend:", error); // Log the full error
    if (typeof showApiError === "function")
      showApiError(
        error.message || "An unknown API error occurred.",
        thinkingBubble
      ); // MODIFIED
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) stopBtn.style.display = "none";
    if (typeof isResponding !== "undefined") isResponding = false;
  } finally {
    if (typeof currentController !== "undefined") currentController = null;
  }
}

function stopResponse() {
  if (typeof currentController !== "undefined") {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }
  }
  if (typeof isResponding !== "undefined") isResponding = false;
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
  const bubble = addMessage("", "ai", true); // Pass true for thinking bubble
  let textToStream = fullText;
  let codeToCanvas = "";
  let codeNeedsStreaming = false;

  // 1. Separate code and conversational text if canvas is active
  if (isCanvasModeActive) {
    const { code, text } = parseCodeFromResponse(fullText);

    if (code) {
      // --- ADDED THIS ---
      // This is the magic! If we have code and canvas mode is on,
      // manually add the 'active' class to show the pane.
      if (canvasPane) canvasPane.classList.add("active");
      // --- END ADDED ---

      codeToCanvas = code;
      codeNeedsStreaming = true; // Flag for code streaming

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
    // --- MODIFICATION ---
    // Always replace the canvas content, don't append
    const newCode = codeToCanvas;
    // --- END MODIFICATION ---

    // Get language hint (as done in updateCanvas)
    let lang = "plaintext";
    if (
      newCode.includes("<") ||
      newCode.includes(">") ||
      newCode.includes("</")
    ) {
      lang = "html";
    } else if (
      newCode.includes("function") ||
      newCode.includes("const") ||
      newCode.includes("let")
    ) {
      lang = "javascript";
    }
    canvasCodeBlock.className = `language-${lang}`;

    // Clear canvas code block for streaming
    // --- MODIFICATION ---
    // Always start with a blank canvas for the new code
    canvasCodeBlock.textContent = "";
    // --- END MODIFICATION ---

    // Set canvas to code tab
    switchCanvasTab("code");

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
  if (typeof isResponding !== "undefined") isResponding = false;
  if (typeof saveState === "function") saveState(); // global func

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
    if (typeof isResponding !== "undefined" && !isResponding) {
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
    if (typeof isResponding !== "undefined" && !isResponding) {
      break; // Stop if the user cancels the response
    }
    canvasCodeBlock.textContent += chunk;

    // Auto-scroll the code editor pane
    if (
      editorPane.scrollTop + editorPane.clientHeight >=
      editorPane.scrollHeight - 50
    ) {
      editorPane.scrollTop = editorPane.scrollHeight;
    }

    await new Promise((r) => setTimeout(r, 1)); // Faster streaming for code
  }

  // Set final content and perform final highlight
  canvasCodeBlock.textContent = codeString;
  if (typeof hljs !== "undefined") {
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
  // MODIFIED: Made the newline/whitespace after language optional and flexible
  const codeRegex = /```(\w+)?\s*([\s\S]+?)```/g;
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
    if (
      newCode.includes("<") ||
      newCode.includes(">") ||
      newCode.includes("</")
    ) {
      lang = "html";
    } else if (
      newCode.includes("function") ||
      newCode.includes("const") ||
      newCode.includes("let")
    ) {
      lang = "javascript";
    }
    canvasCodeBlock.className = `language-${lang}`;

    if (typeof hljs !== "undefined") {
      hljs.highlightElement(canvasCodeBlock);
    }
    switchCanvasTab("code");
  }
}

function copyToClipboard(text, btnElement) {
  // This function might be duplicated here, but relying on the global one from script.js is safer.
  // For safety, I will rely on the global function defined in script.js to avoid redundancy/conflict.
  if (typeof window.copyToClipboard === "function") {
    window.copyToClipboard(text, btnElement);
  } else {
    // Fallback implementation (similar to the one in script.js)
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
      // Fallback for environments without navigator.clipboard
      if (typeof showToast === "function")
        showToast("Clipboard access denied. Copy manually.");
    }
  }
}

function shareResponse(text) {
  // This function might be duplicated here, but relying on the global one from script.js is safer.
  if (typeof window.shareResponse === "function") {
    window.shareResponse(text);
  } else {
    // Fallback implementation
    if (
      typeof navigator.clipboard !== "undefined" &&
      navigator.clipboard.writeText
    ) {
      navigator.clipboard.writeText("https://lynq.ai/share/chat-id-123");
      if (typeof showToast === "function")
        showToast("Shareable link copied to clipboard!"); // global func
    } else {
      if (typeof showToast === "function")
        showToast("Share functionality unavailable.");
    }
  }
}

async function toggleEdit(msgWrapper, originalText, originalAttachment) {
  const bubble = msgWrapper.querySelector(".bubble");
  const actions = msgWrapper.querySelector(".message-actions");
  // NEW: Get attachment container
  const attachmentContainer = msgWrapper.querySelector(
    ".message-attachment-container"
  );

  if (msgWrapper.querySelector(".edit-container")) return;

  bubble.style.display = "none";
  if (actions) actions.style.display = "none";
  // NEW: Hide attachment
  if (attachmentContainer) attachmentContainer.style.display = "none";

  const editContainer = document.createElement("div");
  editContainer.className = "edit-container";

  // NEW: Re-create attachment pill in edit mode
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
    if (attachmentContainer) attachmentContainer.style.display = "flex"; // Show attachment again
  };

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-edit-action btn-save";
  saveBtn.innerText = "Save & Submit";
  saveBtn.onclick = () => {
    const newText = textarea.value.trim();

    // MODIFIED: Allow saving if only attachment exists
    if (newText !== "" || originalAttachment) {
      // Find this message in history and slice
      const msgIndex =
        typeof mainChatHistory !== "undefined"
          ? mainChatHistory.findIndex(
              (m) => m.role === "user" && m.content === originalText
            )
          : -1;

      if (typeof mainChatHistory !== "undefined") {
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
      // Note: We don't need to update the attachment pill, it's already there

      // Update the history and resubmit
      if (typeof mainChatHistory !== "undefined")
        mainChatHistory.push({
          role: "user",
          content: newText,
          attachment: originalAttachment,
        });

      const currentChat =
        typeof recentChats !== "undefined" &&
        typeof activeChatId !== "undefined"
          ? recentChats.find((c) => c.id === activeChatId)
          : null;
      if (currentChat) {
        currentChat.history = mainChatHistory;
      }

      // Pass the new text and attachment to regenerate
      regenerateResponseAfterEdit(newText, originalAttachment);
    }
    editContainer.remove();
    bubble.style.display = "block";
    if (actions) actions.style.display = "flex";
    if (attachmentContainer) attachmentContainer.style.display = "flex"; // Show attachment again
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
  if (typeof isResponding !== "undefined") isResponding = true;
  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "flex";

  const thinking = showThinking();

  if (typeof currentController !== "undefined") {
    if (currentController) currentController.abort();
    currentController = new AbortController();
  }

  const signal =
    typeof currentController !== "undefined" && currentController
      ? currentController.signal
      : null;

  // --- FIX: Sanitize history for API ---
  const historyForApi =
    typeof mainChatHistory !== "undefined"
      ? mainChatHistory.slice(0, -1).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
      : []; // History *before* the new prompt
  // --- END FIX ---

  // --- MODIFIED: DYNAMIC SYSTEM PROMPT ---
  let finalSystemMessage;
  const TOKEN_LIMIT = 4000; // Set a safe token limit

  if (attachment && attachment.text) {
    // *** BEGIN PDF PROMPT MODIFICATION ***
    let pdfContext = attachment.text;

    if (pdfContext.length > TOKEN_LIMIT * 4) {
      pdfContext = pdfContext.substring(0, TOKEN_LIMIT * 4);
      console.warn(
        `PDF text truncated to ${
          TOKEN_LIMIT * 4
        } characters to fit context limit.`
      );
      if (typeof showToast === "function") {
        showToast(
          "Note: The PDF is very large and was truncated to fit the AI's context limit."
        );
      }
    }

    finalSystemMessage = `You are a helpful and friendly AI assistant. The user has provided text extracted from a PDF document.

🎯 Your Goal:
Help the user by intelligently using the PDF content.

1️⃣ **If the user asks a question ABOUT the PDF content (e.g., "Summarize this," "What are the key points?"):**
- Answer based **only** on the PDF text.
- Use outside knowledge if user asks about the contents in the pdf.

2️⃣ **If the user asks you to USE the PDF content (e.g., "Answer the questions in this PDF," "Solve the problems listed"):**
- This is a special case! The PDF contains the *questions*, but you must provide the *answers* from your own general knowledge.
- First, state this clearly. Example: "Certainly! Here are the answers to the questions from the PDF, based on my general knowledge:"
- Then, proceed to answer the questions.

3️⃣ **If the user asks a general question NOT found in the PDF:**
- If the question is *related* to the PDF's topic but not *in* it (e.g., PDF is about "Dogs," user asks "What about cats?"), answer it, but note: "That information isn't in the PDF, but here's what I know about cats..."
- If the question is *completely unrelated* to the PDF (e.g., "What's the weather?"), just answer it normally.

⚠ Rules:
- Use simple and clear wording.
- Use emojis when helpful, but do not overuse them.

📝 **Output Structure:**
Your response should follow this structure (when appropriate):

**Heading (bigger font)**
Short intro paragraph.

**Subheading 1**
Explanation in simple words.

**Subheading 2**
Examples, steps, or comparison.

**Conclusion**
One short summary + ask if user wants more details.

✨ End every answer with a question that invites the user to continue the conversation.

---PDF CONTENT---
${pdfContext}
---END CONTENT---
`;
    // *** END PDF PROMPT MODIFICATION ***
  } else if (isCanvasModeActive) {
    // 1. Define the base prompt (your current prompt)
    const basePrompt = `You are an advanced AI assistant.

🎯 **Goal/Role:**
Your main job is to help the user by giving correct, useful, and clear answers. 
Always communicate like a friendly and smart teacher.

🗣️ **Tone & Style:**
- Use simple and easy English, suitable for students and beginners.
- Write in short paragraphs with clear headings and subheadings.
- Use emojis when helpful, but do not overuse them.
- If user requests: adapt writing for exams, interviews, code help, storytelling, etc.

🧩 **Response Rules:**
1⃣ Understand the user’s intention before answering.  
2⃣ If needed, ask clarifying questions.  
3⃣ Provide examples, steps, and explanations when useful.  
4⃣ If generating code, make it clean and well-commented.  
5⃣ If content may be incorrect or unsafe, warn the user first.  
6⃣ If the user asks for a format (bullet points, essay, JSON, etc.), follow it strictly.

📚 **Knowledge Behavior:**
- If you are not sure about something, say: “I’m not fully sure, but here is my best understanding.”
- Do NOT invent facts. Avoid hallucination.
- If web search is available, use it for recent facts when necessary.

📝 **Output Structure:**
Your response should follow this structure (when appropriate):

**Heading (bigger font)**
Short intro paragraph.

**Subheading 1**
Explanation in simple words.

**Subheading 2**
Examples, steps, or comparison.

**Conclusion**
One short summary + ask if user wants more details.

✨ End every answer with a question that invites the user to continue the conversation.
`;

    // 2. Define the "Canvas Mode" instructions
    const canvasModeAddon = `
  
---
You are an AI Software Engineer working in **Canvas Code Editing Mode**.

🎯 Goal:
Write, update, and refactor code with clean, correct, and production-ready output. The canvas should contain **only code** unless the user requests documentation.

🚧 Code Editing Rules:
- If user says **create new file**, start fresh with code only.
- If user says **update, modify, add, fix, or remove**, change only the required parts and keep the rest of the code intact.
- If the target change is unclear, ask:
  "Which part should I update? Please specify a function, component, or line reference."
- Do not include explanations inside the canvas unless requested as comments.

📝 Updating Existing Code:
If the user requests to **update, modify, add, or remove** something from the current canvas code:
- Edit only the necessary parts without rewriting the entire file.
- Preserve structure, formatting, and logic unless change requires otherwise.
- If location of change is unclear, ask the user:
  "Which part should I update? Please specify a function, component, or line reference."
- Output only the updated canvas code, and nothing else.

📦 Code Standards:
- Follow best practices for the language and framework being used.
- Use proper formatting, imports, indentation, and naming conventions.
- No secrets, tokens, API keys, or passwords in code.

🧪 Reliability:
- Prefer safe, stable, and maintainable code.
- Suggest improvements or error handling when useful.

🌐 Supported Code Types:
Frontend (React, Next.js, Vue, HTML, CSS, JS/TS),
Backend (Node, Express, Nest, FastAPI, Django, Laravel, Go),
Databases (MongoDB, PostgreSQL, MySQL, Redis),
APIs (REST, GraphQL, WebSockets),
DevOps configs (Docker, CI/CD, Nginx),
Config/YAML/Env files,
Documentation (README, API docs).

❌ Forbidden in Canvas:
- No emojis
- No inline explanations (unless asked)
- No unrelated text
- No rewriting entire file unless requested

🔐 Safety:
Decline malware, exploits, or illegal code and offer a safe alternative.

✨ End every coding response with:
"Should I continue editing or implement the next part?"`;
    finalSystemMessage = basePrompt + canvasModeAddon;
  } else {
    // 1. Define the base prompt (your current prompt)
    finalSystemMessage = `You are an advanced AI assistant.

🎯 **Goal/Role:**
Your main job is to help the user by giving correct, useful, and clear answers. 
Always communicate like a friendly and smart teacher.

🗣️ **Tone & Style:**
- Use simple and easy English, suitable for students and beginners.
- Write in short paragraphs with clear headings and subheadings.
- Use emojis when helpful, but do not overuse them.
- If user requests: adapt writing for exams, interviews, code help, storytelling, etc.

🧩 **Response Rules:**
1⃣ Understand the user’s intention before answering.  
2⃣ If needed, ask clarifying questions.  
3⃣ Provide examples, steps, and explanations when useful.  
4⃣ If generating code, make it clean and well-commented.  
5⃣ If content may be incorrect or unsafe, warn the user first.  
6⃣ If the user asks for a format (bullet points, essay, JSON, etc.), follow it strictly.

📚 **Knowledge Behavior:**
- If you are not sure about something, say: “I’m not fully sure, but here is my best understanding.”
- Do NOT invent facts. Avoid hallucination.
- If web search is available, use it for recent facts when necessary.

📝 **Output Structure:**
Your response should follow this structure (when appropriate):

**Heading (bigger font)**
Short intro paragraph.

**Subheading 1**
Explanation in simple words.

**Subheading 2**
Examples, steps, or comparison.

**Conclusion**
One short summary + ask if user wants more details.

✨ End every answer with a question that invites the user to continue the conversation.
`; // (Your base prompt)
  }

  // 4. Get the system message (which might also include custom instructions from settings)
  const systemMessage =
    typeof getSystemMessage === "function"
      ? getSystemMessage(finalSystemMessage)
      : // Fallback in case getSystemMessage isn't loaded
        finalSystemMessage;

  try {
    const response = await getApiResponse(
      newPrompt,
      systemMessage,
      historyForApi, // Pass the sanitized history
      signal
    );

    // --- NEW: ROBUST RESPONSE CHECK ---
    if (!response || typeof response !== "string" || response.trim() === "") {
      console.error(
        "API returned an empty or invalid response in regenerateResponseAfterEdit:",
        response
      );
      if (typeof showApiError === "function") {
        showApiError(
          "The API returned an empty or invalid response.",
          thinking
        );
      } else {
        thinking.remove();
        addMessage(
          "Error: The API returned an empty or invalid response.",
          "ai",
          true
        );
      }
      if (sendBtn) sendBtn.style.display = "flex";
      if (stopBtn) stopBtn.style.display = "none";
      if (typeof isResponding !== "undefined") isResponding = false;
      return; // Stop execution here
    }
    // --- END ROBUST RESPONSE CHECK ---

    if (typeof mainChatHistory !== "undefined")
      mainChatHistory.push({
        role: "assistant",
        content: response,
        attachment: null,
      });
    const currentChat =
      typeof recentChats !== "undefined" && typeof activeChatId !== "undefined"
        ? recentChats.find((c) => c.id === activeChatId)
        : null;
    if (currentChat) {
      currentChat.history = mainChatHistory;
    }

    thinking.remove();
    streamResponse(response);
  } catch (error) {
    console.error("API Error in regenerateResponseAfterEdit:", error); // Log the full error
    if (typeof showApiError === "function")
      showApiError(error.message || "An unknown API error occurred.", thinking); // MODIFIED
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) stopBtn.style.display = "none";
    if (typeof isResponding !== "undefined") isResponding = false;
  } finally {
    if (typeof currentController !== "undefined") currentController = null;
  }
}

async function regenerateMessage(msgElement) {
  // Find the bubble's content to match in history
  const bubble = msgElement.querySelector(".bubble");
  if (!bubble) return;

  // NOTE: This complex history lookup relies heavily on globals from script.js
  if (
    typeof mainChatHistory === "undefined" ||
    typeof recentChats === "undefined" ||
    typeof activeChatId === "undefined"
  ) {
    if (typeof showToast === "function")
      showToast("Cannot regenerate: Chat state is unavailable.");
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
    if (typeof showToast === "function")
      showToast("Could not find user prompt.");
    return;
  }

  // Slice history up to *before* that user prompt
  // --- FIX: Sanitize history for API ---
  const historyForApi = mainChatHistory
    .slice(0, msgIndex - 1)
    .map((msg) => ({ role: msg.role, content: msg.content }));
  // --- END FIX ---

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
  addMessage(userPrompt.content, "user", true, userPrompt.attachment); // true to skip history
  mainChatHistory.push(userPrompt);

  if (typeof isResponding !== "undefined") isResponding = true;
  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "flex";

  const thinking = showThinking();

  if (typeof currentController !== "undefined") {
    if (currentController) currentController.abort();
    currentController = new AbortController();
  }

  const signal =
    typeof currentController !== "undefined" && currentController
      ? currentController.signal
      : null;

  // --- MODIFIED: DYNAMIC SYSTEM PROMPT ---
  let finalSystemMessage;
  const TOKEN_LIMIT = 4000; // Set a safe token limit

  // 1. Determine which attachment to use
  let contextAttachment = userPrompt.attachment; // Check the prompt we're regenerating for
  if (
    !contextAttachment &&
    typeof mainChatHistory !== "undefined" &&
    mainChatHistory.length > 0
  ) {
    // If it had no attachment, check the *first* message in the chat history
    if (mainChatHistory[0].attachment && mainChatHistory[0].attachment.text) {
      contextAttachment = mainChatHistory[0].attachment;
      console.log("Regenerating response with PDF context from chat history.");
    }
  }

  // 2. Build system prompt based on whether we have context
  if (contextAttachment && contextAttachment.text) {
    // *** BEGIN PDF PROMPT MODIFICATION ***
    let pdfContext = contextAttachment.text;

    if (pdfContext.length > TOKEN_LIMIT * 4) {
      pdfContext = pdfContext.substring(0, TOKEN_LIMIT * 4);
      console.warn(
        `PDF text truncated to ${
          TOKEN_LIMIT * 4
        } characters to fit context limit.`
      );
      if (typeof showToast === "function") {
        showToast(
          "Note: The PDF is very large and was truncated to fit the AI's context limit."
        );
      }
    }

    finalSystemMessage = `You are a helpful and friendly AI assistant. The user has provided text extracted from a PDF document.

🎯 Your Goal:
Help the user by intelligently using the PDF content.

1️⃣ **If the user asks a question ABOUT the PDF content (e.g., "Summarize this," "What are the key points?"):**
- Answer based **only** on the PDF text.
- Use outside knowledge if user asks about the contents in the pdf.

2️⃣ **If the user asks you to USE the PDF content (e.g., "Answer the questions in this PDF," "Solve the problems listed"):**
- This is a special case! The PDF contains the *questions*, but you must provide the *answers* from your own general knowledge.
- First, state this clearly. Example: "Certainly! Here are the answers to the questions from the PDF, based on my general knowledge:"
- Then, proceed to answer the questions.

3️⃣ **If the user asks a general question NOT found in the PDF:**
- If the question is *related* to the PDF's topic but not *in* it (e.g., PDF is about "Dogs," user asks "What about cats?"), answer it, but note: "That information isn't in the PDF, but here's what I know about cats..."
- If the question is *completely unrelated* to the PDF (e.g., "What's the weather?"), just answer it normally.

⚠ Rules:
- Use simple and clear wording.
- Use emojis when helpful, but do not overuse them.

📝 **Output Structure:**
Your response should follow this structure (when appropriate):

**Heading (bigger font)**
Short intro paragraph.

**Subheading 1**
Explanation in simple words.

**Subheading 2**
Examples, steps, or comparison.

**Conclusion**
One short summary + ask if user wants more details.

✨ End every answer with a question that invites the user to continue the conversation.

---PDF CONTENT---
${pdfContext}
---END CONTENT---
`;
    // *** END PDF PROMPT MODIFICATION ***
  } else if (isCanvasModeActive) {
    // 1. Define the base prompt (your current prompt)
    const basePrompt = `You are an advanced AI assistant.

🎯 **Goal/Role:**
Your main job is to help the user by giving correct, useful, and clear answers. 
Always communicate like a friendly and smart teacher.

🗣️ **Tone & Style:**
- Use simple and easy English, suitable for students and beginners.
- Write in short paragraphs with clear headings and subheadings.
- Use emojis when helpful, but do not overuse them.
- If user requests: adapt writing for exams, interviews, code help, storytelling, etc.

🧩 **Response Rules:**
1⃣ Understand the user’s intention before answering.  
2⃣ If needed, ask clarifying questions.  
3⃣ Provide examples, steps, and explanations when useful.  
4⃣ If generating code, make it clean and well-commented.  
5⃣ If content may be incorrect or unsafe, warn the user first.  
6⃣ If the user asks for a format (bullet points, essay, JSON, etc.), follow it strictly.

📚 **Knowledge Behavior:**
- If you are not sure about something, say: “I’m not fully sure, but here is my best understanding.”
- Do NOT invent facts. Avoid hallucination.
- If web search is available, use it for recent facts when necessary.

📝 **Output Structure:**
Your response should follow this structure (when appropriate):

**Heading (bigger font)**
Short intro paragraph.

**Subheading 1**
Explanation in simple words.

**Subheading 2**
Examples, steps, or comparison.

**Conclusion**
One short summary + ask if user wants more details.

✨ End every answer with a question that invites the user to continue the conversation.
`;

    // 2. Define the "Canvas Mode" instructions
    const canvasModeAddon = `
  
---
You are an AI Software Engineer working in **Canvas Code Editing Mode**.

🎯 Goal:
Write, update, and refactor code with clean, correct, and production-ready output. The canvas should contain **only code** unless the user requests documentation.

🚧 Code Editing Rules:
- If user says **create new file**, start fresh with code only.
- If user says **update, modify, add, fix, or remove**, change only the required parts and keep the rest of the code intact.
- If the target change is unclear, ask:
  "Which part should I update? Please specify a function, component, or line reference."
- Do not include explanations inside the canvas unless requested as comments.

📝 Updating Existing Code:
If the user requests to **update, modify, add, or remove** something from the current canvas code:
- Edit only the necessary parts without rewriting the entire file.
- Preserve structure, formatting, and logic unless change requires otherwise.
- If location of change is unclear, ask the user:
  "Which part should I update? Please specify a function, component, or line reference."
- Output only the updated canvas code, and nothing else.

📦 Code Standards:
- Follow best practices for the language and framework being used.
- Use proper formatting, imports, indentation, and naming conventions.
- No secrets, tokens, API keys, or passwords in code.

🧪 Reliability:
- Prefer safe, stable, and maintainable code.
- Suggest improvements or error handling when useful.

🌐 Supported Code Types:
Frontend (React, Next.js, Vue, HTML, CSS, JS/TS),
Backend (Node, Express, Nest, FastAPI, Django, Laravel, Go),
Databases (MongoDB, PostgreSQL, MySQL, Redis),
APIs (REST, GraphQL, WebSockets),
DevOps configs (Docker, CI/CD, Nginx),
Config/YAML/Env files,
Documentation (README, API docs).

❌ Forbidden in Canvas:
- No emojis
- No inline explanations (unless asked)
- No unrelated text
- No rewriting entire file unless requested

🔐 Safety:
Decline malware, exploits, or illegal code and offer a safe alternative.

✨ End every coding response with:
"Should I continue editing or implement the next part?"`;
    finalSystemMessage = basePrompt + canvasModeAddon;
  } else {
    // 1. Define the base prompt (your current prompt)
    finalSystemMessage = `You are an advanced AI assistant.

🎯 **Goal/Role:**
Your main job is to help the user by giving correct, useful, and clear answers. 
Always communicate like a friendly and smart teacher.

🗣️ **Tone & Style:**
- Use simple and easy English, suitable for students and beginners.
- Write in short paragraphs with clear headings and subheadings.
- Use emojis when helpful, but do not overuse them.
- If user requests: adapt writing for exams, interviews, code help, storytelling, etc.

🧩 **Response Rules:**
1⃣ Understand the user’s intention before answering.  
2⃣ If needed, ask clarifying questions.  
3⃣ Provide examples, steps, and explanations when useful.  
4⃣ If generating code, make it clean and well-commented.  
5⃣ If content may be incorrect or unsafe, warn the user first.  
6⃣ If the user asks for a format (bullet points, essay, JSON, etc.), follow it strictly.

📚 **Knowledge Behavior:**
- If you are not sure about something, say: “I’m not fully sure, but here is my best understanding.”
- Do NOT invent facts. Avoid hallucination.
- If web search is available, use it for recent facts when necessary.

📝 **Output Structure:**
Your response should follow this structure (when appropriate):

**Heading (bigger font)**
Short intro paragraph.

**Subheading 1**
Explanation in simple words.

**Subheading 2**
Examples, steps, or comparison.

**Conclusion**
One short summary + ask if user wants more details.

✨ End every answer with a question that invites the user to continue the conversation.
`; // (Your base prompt)
  }

  // 4. Get the system message (which might also include custom instructions from settings)
  const systemMessage =
    typeof getSystemMessage === "function"
      ? getSystemMessage(finalSystemMessage)
      : // Fallback in case getSystemMessage isn't loaded
        finalSystemMessage;

  try {
    const response = await getApiResponse(
      userPrompt.content,
      systemMessage,
      historyForApi, // Pass the sanitized history
      signal
    );

    // --- NEW: ROBUST RESPONSE CHECK ---
    if (!response || typeof response !== "string" || response.trim() === "") {
      console.error(
        "API returned an empty or invalid response in regenerateMessage:",
        response
      );
      if (typeof showApiError === "function") {
        showApiError(
          "The API returned an empty or invalid response.",
          thinking
        );
      } else {
        thinking.remove();
        addMessage(
          "Error: The API returned an empty or invalid response.",
          "ai",
          true
        );
      }
      if (sendBtn) sendBtn.style.display = "flex";
      if (stopBtn) stopBtn.style.display = "none";
      if (typeof isResponding !== "undefined") isResponding = false;
      return; // Stop execution here
    }
    // --- END ROBUST RESPONSE CHECK ---

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
    streamResponse(response);
  } catch (error) {
    console.error("API Error in regenerateMessage:", error); // Log the full error
    if (typeof showApiError === "function")
      showApiError(error.message || "An unknown API error occurred.", thinking); // MODIFIED
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) stopBtn.style.display = "none";
    if (typeof isResponding !== "undefined") isResponding = false;
  } finally {
    if (typeof currentController !== "undefined") currentController = null;
  }
}

/**
 * MODIFIED: Now accepts an attachment object.
 * @param {string} text - The message content.
 * @param {'user' | 'ai'} sender - The role of the sender.
 * @param {boolean} [skipHistory=false] - If true, doesn't add to mainChatHistory (used for loading).
 * @param {object | null} [attachment=null] - The attachment object { name, text, type }.
 * @returns {HTMLElement | null} The message bubble element, or null if it couldn't be created.
 */
function addMessage(text, sender, skipHistory = false, attachment = null) {
  if (!messagesWrapper) return null;

  // Handle "thinking" bubble
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

  // --- NEW: Add Attachment Container if attachment exists ---
  if (attachment) {
    const attachmentContainer = document.createElement("div");
    attachmentContainer.className = "message-attachment-container";

    const pill = document.createElement("div");
    pill.className = "attachment-pill";
    pill.innerHTML = `<i class="fa-solid fa-file-pdf"></i> <span>${attachment.name}</span>`;

    attachmentContainer.appendChild(pill);
    contentWrapper.appendChild(attachmentContainer);
  }
  // --- END NEW ---

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (isThinking) {
    bubble.innerHTML =
      '<div class="thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
  } else if (sender === "user") {
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
    // Get original raw text and attachment for editing
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
