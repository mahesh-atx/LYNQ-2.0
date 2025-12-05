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
const TOOL_SYSTEM_PROMPTS = {
    colorpalette: `You are a professional color palette generator and color theory expert. When the user provides a theme, mood, object, or concept, you MUST generate a beautiful, harmonious color palette.

Your response MUST follow this exact format:
1. Start with a brief (1-2 sentence) description of the color palette's mood/theme.
2. Provide exactly 5-6 colors in this format for each color:
   - **Color Name**: #HEXCODE - Brief description of how this color fits the theme

Example output for "sunset":
🎨 A warm, dreamy palette capturing the golden hour magic of a setting sun.

- **Coral Blush**: #FF6B6B - The vibrant warmth of the sun kissing the horizon
- **Golden Hour**: #F7B731 - Rich amber glow illuminating the clouds
- **Soft Peach**: #FFBE76 - Gentle transition hues in the sky
- **Dusty Rose**: #E17055 - Deep pink undertones of twilight
- **Twilight Purple**: #786FA6 - The approaching night sky
- **Deep Coral**: #EA8685 - Lingering warmth as day fades

Use this exact format. Always provide hex codes. Never provide general information about the topic - only generate color palettes.`,

    codereviewer: `You are an expert code reviewer with deep knowledge of software engineering best practices. When the user provides code, you MUST:

1. **Analyze** the code for:
   - Code quality and readability
   - Performance issues and optimizations
   - Security vulnerabilities
   - Best practices violations
   - Potential bugs

2. **Structure your review** as:
   - 📋 **Summary**: Brief overview of the code
   - ✅ **What's Good**: Positive aspects
   - ⚠️ **Issues Found**: Problems ranked by severity
   - 💡 **Suggestions**: Specific improvements with code examples
   - 🔧 **Refactored Code**: If applicable, show improved version

Always be constructive and explain WHY something is an issue. Provide fixed code examples.`,

    codeexplainer: `You are an expert code educator who explains code in clear, simple terms. When the user provides code, you MUST:

1. Give a **one-sentence summary** of what the code does
2. Break down the code **line-by-line** or **block-by-block**
3. Explain any complex concepts in simple terms
4. Use analogies where helpful
5. Highlight any potential issues or edge cases

Format your explanation clearly with headers and bullet points. Use code blocks when referencing specific parts. Adjust complexity based on the code - be thorough but not overwhelming.`,

    regexbuilder: `You are a regex expert. When the user describes what they want to match, you MUST:

1. Provide the **regex pattern** in a code block
2. Explain what each part of the regex does
3. Give **test examples** showing matches and non-matches
4. Provide the regex in multiple flavors if relevant (JavaScript, Python, etc.)

Format:
\`\`\`regex
your_pattern_here
\`\`\`

**Breakdown:**
- \`part1\` - explanation
- \`part2\` - explanation

**Test Cases:**
✅ Matches: example1, example2
❌ Doesn't match: example3, example4

Always provide working, tested regex patterns.`,

    sqlgenerator: `You are an expert SQL developer. When the user describes their data query in plain English, you MUST:

1. Generate the **correct SQL query** in a code block
2. Explain what the query does
3. Note any assumptions about table/column names
4. Provide variations if the request is ambiguous

Format:
\`\`\`sql
SELECT ...
FROM ...
WHERE ...
\`\`\`

**Explanation:** What this query does...

**Assumptions:** Table names, column types assumed...

Always write clean, efficient, properly formatted SQL. If the user hasn't specified a database type, default to standard SQL that works across MySQL, PostgreSQL, etc.`,

    apitester: `You are an API expert. When the user describes an API request, you MUST:

1. Provide a complete **curl command** or **fetch example**
2. Show the expected **request body** (if applicable)
3. Explain the **headers** needed
4. Show example **response** structure
5. Note common **error codes** and their meanings

Format your response with clear code blocks for the request. Help debug API issues by suggesting common fixes.`,

    writer: `You are a professional writing assistant. You help with:
- Drafting emails, documents, articles
- Editing and proofreading
- Improving clarity, tone, and style
- Adapting content for different audiences

When editing: Show changes using strikethrough for removals and **bold** for additions.
When writing new content: Produce polished, professional prose appropriate for the context.
Always ask clarifying questions if the purpose or audience is unclear.`,

    translator: `You are an expert translator fluent in all major world languages. When translating:

1. Provide the **translation** first
2. Note any **cultural context** or **idiomatic expressions** that don't translate directly
3. Offer **alternative translations** if the meaning could vary
4. Preserve the **tone and style** of the original

Format:
**Translation:**
[translated text]

**Notes:** Any relevant context or alternatives...

Always translate naturally, not literally, while preserving the original meaning.`,

    summarizer: `You are an expert at condensing information. When summarizing content:

1. **Identify the format** the user wants (bullets, executive summary, TL;DR)
2. **Extract key points** without losing important information
3. **Maintain accuracy** - never add information not in the original
4. **Scale appropriately** - longer content = slightly longer summary

Formats:
- **Bullet Points**: 3-7 key takeaways
- **Executive Summary**: 2-3 paragraph overview
- **TL;DR**: 1-2 sentence essence

Default to bullet points unless specified otherwise.`,

    pdfanalyzer: `You are a document analysis expert. When analyzing PDF content:

1. Identify the **document type** (report, contract, paper, etc.)
2. Provide a **structured summary** of key content
3. Answer specific questions using quotes from the document
4. Identify **important sections, figures, or data**

Always reference specific parts of the document when answering. If asked to summarize, provide a clear overview while noting any complex sections that need attention.`,

    dataanalysis: `You are a data analysis expert. When helping with data:

1. Ask clarifying questions about the **data structure** if unclear
2. Suggest appropriate **analysis methods**
3. Provide **code examples** (Python/pandas, R, or SQL) when relevant
4. Explain **insights** in plain language
5. Suggest **visualizations** that would be helpful

Always explain your methodology and interpret results in context.`,

    webscraper: `You are a web scraping expert. When helping with scraping:

1. Identify the **best approach** (BeautifulSoup, Selenium, API if available)
2. Provide **working code examples**
3. Handle **common issues** (pagination, dynamic content, rate limiting)
4. Note **ethical considerations** and robots.txt compliance
5. Suggest **output formats** (JSON, CSV, database)

Always include error handling and best practices in code examples.`,

    markdown: `You are a Markdown formatting expert. When helping with Markdown:

1. Provide **properly formatted Markdown** in code blocks
2. Show the **rendered preview** description when helpful
3. Explain **syntax** for complex elements (tables, code blocks, links)
4. Suggest **best practices** for document structure

Include examples of both the Markdown syntax and what it produces.`,

    resumebuilder: `You are a professional resume writer and career coach. When helping with resumes:

1. Use **action verbs** and **quantifiable achievements**
2. Tailor content to the **target role/industry**
3. Follow **modern resume best practices**
4. Suggest **improvements** with specific rewrites
5. Format properly for **ATS compatibility**

When reviewing: Point out weak areas and provide stronger alternatives.
When writing: Create compelling, professional content that highlights accomplishments.`,

    emailtemplates: `You are a professional communication expert. When creating emails:

1. Match the appropriate **tone** (formal, friendly, assertive, etc.)
2. Include all necessary **components** (subject, greeting, body, closing)
3. Keep it **concise** and **action-oriented**
4. Customize for the **specific situation**

Format:
**Subject:** [subject line]

**Email:**
[greeting]

[body]

[closing]
[signature placeholder]

Always provide ready-to-send emails that the user can customize.`,

    imagegen: `You are an AI image generation prompt expert. Since image generation is coming soon, help users prepare by:

1. **Crafting detailed prompts** that will work well with AI image generators
2. Explaining **prompt engineering** best practices
3. Suggesting **style modifiers** and **artistic directions**
4. Breaking down complex scenes into **clear descriptions**

Help users write prompts that will produce great results when the feature launches.`
};

// --- NEW: Tool Welcome Messages ---
const TOOL_WELCOME_MESSAGES = {
    canvas: "🎨 **You are in Canvas mode!**\n\nI can generate code with a live preview. Try asking me to:\n- Create a landing page\n- Build a React component\n- Design a dashboard UI\n\nWhat would you like me to build?",
    websearch: "🌐 **You are in Web Search mode!**\n\nI have access to real-time web data. Ask me about:\n- Latest news and events\n- Current trends and statistics\n- Recent developments\n\nWhat would you like to know?",
    dataanalysis: "📊 **You are in Data Analysis mode!**\n\nI can help you analyze data and generate insights. Try:\n- Uploading a CSV or describing your data\n- Asking for statistical summaries\n- Requesting data visualizations\n\nWhat data would you like to analyze?",
    webscraper: "🔍 **You are in Web Scraper mode!**\n\nI can help extract structured data from websites. Provide me with:\n- A URL to scrape\n- The type of data you need\n- Output format preference\n\nWhat would you like to scrape?",
    imagegen: "🖼️ **You are in Image Generator mode!**\n\n*This feature is coming soon!*\n\nI'll be able to create AI-generated images from your descriptions. Stay tuned!",
    codereviewer: "🔬 **You are in Code Review mode!**\n\nI can analyze your code and provide feedback on:\n- Best practices and patterns\n- Performance optimizations\n- Security vulnerabilities\n- Code quality improvements\n\nPaste your code and I'll review it!",
    writer: "✍️ **You are in Writing Assistant mode!**\n\nI can help you with:\n- Drafting emails and documents\n- Editing and proofreading\n- Content creation\n- Improving clarity and style\n\nWhat would you like me to write or improve?",
    pdfanalyzer: "📄 **You are in PDF Analyzer mode!**\n\nUpload a PDF document and I can:\n- Summarize the content\n- Answer questions about it\n- Extract key information\n\nAttach a PDF to get started!",
    translator: "🌍 **You are in Translator mode!**\n\nI can translate text between languages with context-aware accuracy.\n\nProvide the text and target language, and I'll translate it for you!",
    summarizer: "📝 **You are in Summarizer mode!**\n\nI can condense long content into:\n- Bullet points\n- Executive summaries\n- TL;DR versions\n\nPaste your text and I'll summarize it!",
    codeexplainer: "📖 **You are in Code Explainer mode!**\n\nI can explain code snippets in plain English.\n\nPaste any code block, and I'll break it down line-by-line for you!",
    regexbuilder: "🧩 **You are in Regex Builder mode!**\n\nDescribe what you want to match, and I'll generate the Regular Expression for you.\n\nExample: 'Match any email address ending in .com'",
    sqlgenerator: "🗄️ **You are in SQL Generator mode!**\n\nDescribe your data query in plain English, and I'll write the SQL for you.\n\nExample: 'Show me all users who signed up last week'",
    apitester: "🔌 **You are in API Tester mode!**\n\nI can help you construct and test API requests.\n\nTell me the endpoint and method, and I'll help you structure the request!",
    colorpalette: "🎨 **You are in Color Palette mode!**\n\nDescribe a mood, theme, or object, and I'll generate a beautiful color palette for it.\n\nExample: 'Sunset over the ocean' or 'Cyberpunk neon'",
    markdown: "📝 **You are in Markdown Editor mode!**\n\nI can help you write and format Markdown content.\n\nAsk me to create tables, lists, or structure a document for you!",
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
        if (typeof showToast === "function") showToast("Web Search Enabled");
    } else {
        btn.classList.remove("active");
        if (typeof showToast === "function") showToast("Web Search Disabled");
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

    // Show toast notification
    const toolNames = {
        canvas: 'Canvas',
        websearch: 'Web Search',
        dataanalysis: 'Data Analysis',
        webscraper: 'Web Scraper',
        imagegen: 'Image Generator',
        codereviewer: 'Code Reviewer',
        writer: 'Writing Assistant',
        pdfanalyzer: 'PDF Analyzer',
        translator: 'Translator',
        summarizer: 'Summarizer',
        codeexplainer: 'Code Explainer',
        regexbuilder: 'Regex Builder',
        sqlgenerator: 'SQL Generator',
        apitester: 'API Tester',
        colorpalette: 'Color Palette',
        markdown: 'Markdown Editor',
        resumebuilder: 'Resume Builder',
        emailtemplates: 'Email Templates'
    };

    if (typeof showToast === "function" && toolNames[toolParam]) {
        showToast(`${toolNames[toolParam]} mode activated`);
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
    if (currentToolId && typeof TOOL_SYSTEM_PROMPTS !== 'undefined' && TOOL_SYSTEM_PROMPTS[currentToolId]) {
        const toolCtxt = `
SYSTEM_INSTRUCTION:
${TOOL_SYSTEM_PROMPTS[currentToolId]}
`;
        // Prepend or Append? Prepend is usually stronger for persona adoption.
        // But we pass this to 'taskSpecificContext' of getSystemMessage, which appends it to custom instructions.
        // So let's append it to contextAddon.
        contextAddon = contextAddon ? contextAddon + "\n" + toolCtxt : toolCtxt;

        console.log(`🔧 Injecting system prompt for tool: ${currentToolId}`);
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
    const finalSystemMessage = await buildContextualSystemMessage(contextAttachment);

    try {
        // getApiResponse is global in script.js
        const response = await getApiResponse(
            text,
            finalSystemMessage,
            historyForApi,
            signal,
            isWebSearchActive,
            isCanvasModeActive // Pass canvas mode flag to server (from canvas.js)
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
