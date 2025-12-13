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

// --- Tool-Specific System Prompts ---
// These prompts guide the AI to behave as a specialized expert for each tool.
// Canvas and WebSearch are excluded as they have their own prompt handling.
// --- Tool-Specific System Prompts ---
// Optimization: Prompts moved to backend (config/tool_prompts.json) to reduce bundle size.
// The backend now injects the correct prompt based on the toolId sent in the request.
const TOOL_SYSTEM_PROMPTS = {}; // Kept empty object to avoid reference errors if any legacy code remains


// --- NEW: Tool Welcome Messages ---
const TOOL_WELCOME_MESSAGES = {
    canvas: "🎨 **You are in Canvas mode!**\n\nI can generate code with a live preview. Try asking me to:\n- Create a landing page\n- Build a React component\n- Design a dashboard UI\n\nWhat would you like me to build?",
    websearch: "🌐 **You are in Web Search mode!**\n\nI have access to real-time web data. Ask me about:\n- Latest news and events\n- Current trends and statistics\n- Recent developments\n\nWhat would you like to know?",
    dataanalysis: "📊 **You are in Data Analysis mode!**\n\nI can help you analyze data and generate insights. Try:\n- Uploading a CSV or describing your data\n- Asking for statistical summaries\n- Requesting data visualizations\n\nWhat data would you like to analyze?",
    webscraper: "🔍 **You are in Web Scraper mode!**\n\nI can help extract structured data from websites. Provide me with:\n- A URL to scrape\n- The type of data you need\n- Output format preference\n\nWhat would you like to scrape?",

    writer: "✍️ **You are in Writing Assistant mode!**\n\nI can help you with:\n- Drafting emails and documents\n- Editing and proofreading\n- Content creation\n- Improving clarity and style\n\nWhat would you like me to write or improve?",

    regexbuilder: "🧩 **You are in Regex Builder mode!**\n\nDescribe what you want to match, and I'll generate the Regular Expression for you.\n\nExample: 'Match any email address ending in .com'",
    sqlgenerator: "🗄️ **You are in SQL Generator mode!**\n\nDescribe your data query in plain English, and I'll write the SQL for you.\n\nExample: 'Show me all users who signed up last week'",
    apitester: "🔌 **You are in API Tester mode!**\n\nI can help you construct and test API requests.\n\nTell me the endpoint and method, and I'll help you structure the request!",

    resumebuilder: "📄 **You are in Resume Builder mode!**\n\nI can help you craft a professional resume.\n\nTell me about your experience, or paste your current resume for improvements!",
    emailtemplates: "✉️ **You are in Email Templates mode!**\n\nI can generate professional emails for any situation.\n\nTell me who you're writing to and the purpose of the email!"
};

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

    // Update UI
    if (isWebSearchActive) {
        btn.classList.add("active");
        // Show tool indicator
        if (typeof showSelectedToolIndicator === "function") {
            showSelectedToolIndicator('websearch', 'fa-solid fa-earth-americas', 'Web Search');
        }
        // Toast removed for cleaner UX
    } else {
        btn.classList.remove("active");
        // Hide tool indicator
        const indicator = document.getElementById("selected-tool-indicator");
        if (indicator && indicator.style.display !== "none") {
            const labelEl = document.getElementById("selected-tool-label");
            if (labelEl && labelEl.textContent === "Web Search") {
                indicator.style.display = "none";
            }
        }
        // Toast removed for cleaner UX
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
    // clearAttachment and resetCanvasUI are from pdf.js and canvas.js
    if (typeof clearAttachment === "function") clearAttachment();
    if (typeof resetCanvasUI === "function") resetCanvasUI();

    // --- NEW: Reset active tool ---
    currentToolId = null;

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
 * Handles tool mode activation from URL parameters (when navigating from Tools page)
 */
function handleToolModeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const toolParam = urlParams.get('tool');
    const promptParam = urlParams.get('prompt');

    if (!toolParam) return;

    console.log("🔧 Tool mode detected:", toolParam);

    // Tool display names and icons
    const toolInfo = {
        canvas: { name: 'Canvas', icon: 'fa-solid fa-file-invoice' },
        websearch: { name: 'Web Search', icon: 'fa-solid fa-earth-americas' },
        dataanalysis: { name: 'Data Analysis', icon: 'fa-solid fa-chart-line' },
        webscraper: { name: 'Web Scraper', icon: 'fa-solid fa-spider' },

        writer: { name: 'Writer', icon: 'fa-solid fa-pen-nib' },

        regexbuilder: { name: 'Regex', icon: 'fa-solid fa-asterisk' },
        sqlgenerator: { name: 'SQL', icon: 'fa-solid fa-database' },
        apitester: { name: 'API Tester', icon: 'fa-solid fa-plug' },

        resumebuilder: { name: 'Resume', icon: 'fa-solid fa-file-lines' },
        emailtemplates: { name: 'Email', icon: 'fa-solid fa-envelope' }
    };

    // Enable the appropriate mode
    switch (toolParam) {
        case 'canvas':
            if (typeof toggleCanvasMode === "function") toggleCanvasMode(true);
            break;
        case 'websearch':
            isWebSearchActive = true;
            const webSearchBtn = document.getElementById("web-search-toggle-btn");
            if (webSearchBtn) webSearchBtn.classList.add("active");
            break;
        // Other tools don't have special toggle states yet, but we still show their welcome
    }

    // --- NEW: Set the active tool ---
    currentToolId = toolParam;

    // --- NEW: Hide Tools button and show tool indicator ---
    const toolsBtn = document.getElementById("tools-btn");
    const toolsWrapper = document.querySelector(".tools-dropdown-wrapper");
    if (toolsWrapper) {
        toolsWrapper.style.display = "none";
    }

    // Show the selected tool indicator (hide X button for library tools)
    if (toolInfo[toolParam] && typeof showSelectedToolIndicator === "function") {
        showSelectedToolIndicator(toolParam, toolInfo[toolParam].icon, toolInfo[toolParam].name, true);
    }

    // Show the welcome message as an AI response
    const welcomeMessage = TOOL_WELCOME_MESSAGES[toolParam];
    if (welcomeMessage && welcomeScreen) {
        welcomeScreen.style.display = "none";
        addMessage(welcomeMessage, "ai", true);
    }

    // If there's a pre-filled prompt, put it in the input
    if (promptParam && chatInput) {
        chatInput.value = decodeURIComponent(promptParam);
        chatInput.style.height = "auto";
        chatInput.style.height = chatInput.scrollHeight + "px";
        chatInput.focus();
    }

    // Clean up URL to remove parameters (optional - keeps URL cleaner)
    if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.pathname;
        history.replaceState({}, document.title, cleanUrl);
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
        if (typeof clearAttachment === "function") clearAttachment();
        if (typeof resetCanvasUI === "function") resetCanvasUI();

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
 * Note: Canvas mode prompt is now handled server-side via canvasprompt.txt
 */
async function buildContextualSystemMessage(attachment) {
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
    }

    // --- NEW: Inject Tool System Prompt ---
    // --- NEW: Inject Tool System Prompt ---
    // Optimization: Tool prompts are now handled by the backend.
    // We just pass the toolId to the API, and server.js injects the prompt.
    if (currentToolId) {
        console.log(`🔧 Tool active: ${currentToolId} (Prompt will be injected by server)`);
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

    // getCurrentAttachment is from pdf.js
    const currentAttachment = typeof getCurrentAttachment === "function" ? getCurrentAttachment() : null;

    if (!text && !currentAttachment) return;

    if (welcomeScreen) welcomeScreen.style.display = "none";
    chatInput.value = "";
    chatInput.style.height = "auto";

    const newlyAttachedFile = currentAttachment;
    // clearAttachment is from pdf.js
    if (typeof clearAttachment === "function") clearAttachment();

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
    if (stopBtn) {
        stopBtn.style.display = "flex";
        stopBtn.classList.add("generating");
        // Add generating class to parent for mobile CSS swap
        const toolbarRight = stopBtn.closest('.toolbar-right');
        if (toolbarRight) toolbarRight.classList.add("generating");
    }

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
    const finalSystemMessage = await buildContextualSystemMessage(contextAttachment);

    try {
        // getApiResponse is global in script.js
        const response = await getApiResponse(
            text,
            finalSystemMessage,
            historyForApi,
            signal,
            isWebSearchActive,
            isCanvasModeActive, // Pass canvas mode flag to server
            currentToolId // NEW: Pass current tool ID for server-side prompt injection
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
                const toolbarRight = stopBtn.closest('.toolbar-right');
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
        if (stopBtn) {
            stopBtn.style.display = "none";
            stopBtn.classList.remove("generating");
            const toolbarRight = stopBtn.closest('.toolbar-right');
            if (toolbarRight) toolbarRight.classList.remove("generating");
        }
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
    if (stopBtn) {
        stopBtn.style.display = "none";
        stopBtn.classList.remove("generating");
        const toolbarRight = stopBtn.closest('.toolbar-right');
        if (toolbarRight) toolbarRight.classList.remove("generating");
    }
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
    // isCanvasModeActive is from canvas.js
    if (typeof isCanvasModeActive !== "undefined" && isCanvasModeActive) {
        // parseCodeFromResponse is from canvas.js
        const { code, text } = parseCodeFromResponse(fullText);

        if (code) {
            // canvasPane is from canvas.js
            if (typeof canvasPane !== "undefined" && canvasPane) canvasPane.classList.add("active");
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

        // Show Monaco editor immediately (before streaming)
        // monacoEditorContainer, canvasPlaceholder are from canvas.js
        if (typeof monacoEditorContainer !== "undefined" && monacoEditorContainer) {
            monacoEditorContainer.style.display = "block";
        }
        if (typeof canvasPlaceholder !== "undefined" && canvasPlaceholder) {
            canvasPlaceholder.style.display = "none";
        }
        if (typeof monacoEditor !== "undefined" && monacoEditor) {
            monacoEditor.setValue("// Loading code...\n");
        }
        // switchCanvasTab is from canvas.js
        if (typeof switchCanvasTab === "function") switchCanvasTab("code");

        // streamCodeToCanvas is from canvas.js
        const codeStreamPromise = typeof streamCodeToCanvas === "function"
            ? streamCodeToCanvas(codeToCanvas, lang)
            : Promise.resolve();

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
    if (stopBtn) {
        stopBtn.style.display = "none";
        stopBtn.classList.remove("generating");
        const toolbarRight = stopBtn.closest('.toolbar-right');
        if (toolbarRight) toolbarRight.classList.remove("generating");
    }
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
    let lastCodeBlockCount = 0;

    for (let i = 0; i < words.length; i++) {
        if (!isResponding) {
            currentText += words[i] + " ";
            break;
        }

        currentText += words[i] + " ";

        let displayHtml = marked.parse(currentText);

        bubble.innerHTML = displayHtml;

        // Check if a new code block was completed (look for closing ```)
        // We detect completed code blocks by counting <pre> tags
        const currentCodeBlocks = bubble.querySelectorAll("pre code");

        if (currentCodeBlocks.length > lastCodeBlockCount) {
            // New code block detected! Highlight and enhance it immediately
            currentCodeBlocks.forEach((block, index) => {
                if (index >= lastCodeBlockCount) {
                    hljs.highlightElement(block);
                }
            });
            enhanceCodeBlocks(bubble);
            lastCodeBlockCount = currentCodeBlocks.length;
        }

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

    // Final pass to catch any remaining code blocks
    bubble.innerHTML = marked.parse(currentText.trim());
    bubble
        .querySelectorAll("pre code")
        .forEach((block) => hljs.highlightElement(block));

    // Enhance any remaining code blocks
    enhanceCodeBlocks(bubble);
}

/**
 * Enhances code blocks with a header containing language name and copy button.
 * Wraps each <pre><code> block in a styled container.
 */
function enhanceCodeBlocks(container) {
    const codeBlocks = container.querySelectorAll("pre");

    codeBlocks.forEach((pre) => {
        // Skip if already enhanced
        if (pre.parentElement.classList.contains("code-block-wrapper")) return;

        const code = pre.querySelector("code");
        if (!code) return;

        // Detect language from class (highlight.js adds language-xxx)
        let language = "plaintext";
        const classNames = code.className.split(" ");
        for (const cls of classNames) {
            if (cls.startsWith("language-")) {
                language = cls.replace("language-", "");
                break;
            } else if (cls.startsWith("hljs-")) {
                continue; // Skip hljs theme classes
            } else if (cls && cls !== "hljs") {
                language = cls;
                break;
            }
        }

        // Capitalize and clean language name
        const displayLang = formatLanguageName(language);

        // Create wrapper
        const wrapper = document.createElement("div");
        wrapper.className = "code-block-wrapper";

        // Create header
        const header = document.createElement("div");
        header.className = "code-block-header";

        // Language label
        const langLabel = document.createElement("span");
        langLabel.className = "code-language";
        langLabel.textContent = displayLang;

        // Copy button
        const copyBtn = document.createElement("button");
        copyBtn.className = "code-copy-btn";
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        copyBtn.onclick = () => {
            const textToCopy = code.textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                copyBtn.classList.add("copied");
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
                    copyBtn.classList.remove("copied");
                }, 2000);
            }).catch(() => {
                if (typeof showToast === "function") showToast("Failed to copy code");
            });
        };

        header.appendChild(langLabel);
        header.appendChild(copyBtn);

        // Wrap the pre element
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
    });
}

/**
 * Formats language name for display (e.g., 'javascript' -> 'JavaScript')
 */
function formatLanguageName(lang) {
    const languageMap = {
        'javascript': 'JavaScript',
        'js': 'JavaScript',
        'typescript': 'TypeScript',
        'ts': 'TypeScript',
        'python': 'Python',
        'py': 'Python',
        'java': 'Java',
        'cpp': 'C++',
        'c': 'C',
        'csharp': 'C#',
        'cs': 'C#',
        'html': 'HTML',
        'css': 'CSS',
        'scss': 'SCSS',
        'sass': 'Sass',
        'json': 'JSON',
        'xml': 'XML',
        'yaml': 'YAML',
        'yml': 'YAML',
        'markdown': 'Markdown',
        'md': 'Markdown',
        'bash': 'Bash',
        'sh': 'Shell',
        'shell': 'Shell',
        'powershell': 'PowerShell',
        'sql': 'SQL',
        'php': 'PHP',
        'ruby': 'Ruby',
        'rb': 'Ruby',
        'go': 'Go',
        'rust': 'Rust',
        'swift': 'Swift',
        'kotlin': 'Kotlin',
        'dart': 'Dart',
        'r': 'R',
        'plaintext': 'Code',
        'text': 'Text',
        'jsx': 'JSX',
        'tsx': 'TSX',
        'vue': 'Vue',
        'svelte': 'Svelte',
        'graphql': 'GraphQL',
        'dockerfile': 'Dockerfile',
        'nginx': 'Nginx',
        'apache': 'Apache',
    };

    return languageMap[lang.toLowerCase()] || lang.charAt(0).toUpperCase() + lang.slice(1);
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
    if (stopBtn) {
        stopBtn.style.display = "flex";
        stopBtn.classList.add("generating");
        // Add generating class to parent for mobile CSS swap
        const toolbarRight = stopBtn.closest('.toolbar-right');
        if (toolbarRight) toolbarRight.classList.add("generating");
    }

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
    const finalSystemMessage = await buildContextualSystemMessage(attachment);

    try {
        // getApiResponse is global in script.js
        const response = await getApiResponse(
            newPrompt,
            finalSystemMessage,
            historyForApi,
            signal,
            false, // webSearchActive
            typeof isCanvasModeActive !== "undefined" ? isCanvasModeActive : false // Pass canvas mode flag to server
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
                const toolbarRight = stopBtn.closest('.toolbar-right');
                if (toolbarRight) toolbarRight.classList.remove("generating");
            }
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
        if (stopBtn) {
            stopBtn.style.display = "none";
            stopBtn.classList.remove("generating");
            const toolbarRight = stopBtn.closest('.toolbar-right');
            if (toolbarRight) toolbarRight.classList.remove("generating");
        }
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
        // Enhance code blocks with headers (language + copy button)
        enhanceCodeBlocks(bubble);
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

document.addEventListener("DOMContentLoaded", () => {
    // --- Get Home/Chat Page elements ---
    chatInput = document.getElementById("chat-input");
    messagesWrapper = document.getElementById("messages-wrapper");
    welcomeScreen = document.getElementById("welcome-screen");
    sendBtn = document.getElementById("send-btn");
    stopBtn = document.getElementById("stop-btn");

    toolsToggleBtn = document.getElementById("tools-toggle-btn");
    toolsDropdown = document.getElementById("tools-dropdown");

    // Initialize Canvas elements and listeners (from canvas.js)
    if (typeof initCanvasElements === "function") initCanvasElements();
    if (typeof initCanvasListeners === "function") initCanvasListeners();

    // Initialize PDF elements and listeners (from pdf.js)
    if (typeof initPdfElements === "function") initPdfElements();
    if (typeof initPdfListeners === "function") initPdfListeners();

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
        // Initialize voice input (from voice.js)
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

        if (toolsToggleBtn) {
            toolsToggleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleToolsDropdown();
            });
        }

        // --- FIX: Hide welcome screen if a chat is loaded via URL on page load ---
        // The activeChatId is set in script.js's loadState() which runs before this.
        if (welcomeScreen && activeChatId) {
            welcomeScreen.style.display = "none";
        }

        // --- NEW: Handle Tool Mode from URL Parameters ---
        handleToolModeFromURL();
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
