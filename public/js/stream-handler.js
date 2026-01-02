/*
  stream-handler.js
  Stream response handling extracted from chat.js
  Handles streaming text to chat bubbles and managing response state
*/

// ============================================
// STOP RESPONSE
// ============================================

/**
 * Stops the current API response stream.
 */
function stopResponse() {
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
  isResponding = false;
  
  const sendBtn = document.getElementById("send-btn");
  const stopBtn = document.getElementById("stop-btn");
  
  if (sendBtn) sendBtn.style.display = "flex";
  if (stopBtn) {
    stopBtn.style.display = "none";
    stopBtn.classList.remove("generating");
    const toolbarRight = stopBtn.closest(".toolbar-right");
    if (toolbarRight) toolbarRight.classList.remove("generating");
  }
}

// ============================================
// SHOW THINKING INDICATOR
// ============================================

const THINKING_PHRASES = [
  "Thinking...", 
  "Analyzing...", 
  "Reasoning...", 
  "Processing...", 
  "Reviewing Context...",
  "Generating Response..."
];

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
  
  // Create shimmering text element instead of dots
  const thinkingText = document.createElement("span");
  thinkingText.className = "thinking-text";
  thinkingText.innerText = THINKING_PHRASES[0];
  
  bubble.appendChild(thinkingText);

  // Cycle through phrases
  let phraseIndex = 0;
  const intervalId = setInterval(() => {
    phraseIndex = (phraseIndex + 1) % THINKING_PHRASES.length;
    thinkingText.innerText = THINKING_PHRASES[phraseIndex];
  }, 3000); // Change phrase every 3 seconds

  // Attach interval ID to the bubble element for easy cleanup
  msgDiv._thinkingInterval = intervalId;

  contentWrapper.appendChild(bubble);
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(contentWrapper);
  if (messagesWrapper) messagesWrapper.appendChild(msgDiv);

  const chatContainer = document.getElementById("chat-container");
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

  return msgDiv;
}

// ============================================
// STREAM TEXT TO BUBBLE
// ============================================

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
    
    // PROCESS CITATIONS DURING STREAMING for immediate badge display
    // Only process if sources are already loaded
    if (typeof processInlineCitations === "function" && window.lastResponseSources && window.lastResponseSources.length > 0) {
      displayHtml = processInlineCitations(displayHtml);
    } else {
      // If sources not loaded yet, hide the raw citation markers temporarily
      displayHtml = displayHtml.replace(/\[\[cite:\d+\]\]/g, '<span class="citation-loading"></span>');
    }
    
    bubble.innerHTML = displayHtml;

    const currentCodeBlocks = bubble.querySelectorAll("pre code");

    if (currentCodeBlocks.length > lastCodeBlockCount) {
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

  // Final render with all processing
  let finalHtml = marked.parse(currentText.trim());
  if (typeof processInlineCitations === "function") {
    finalHtml = processInlineCitations(finalHtml);
  }
  bubble.innerHTML = finalHtml;
  
  bubble
    .querySelectorAll("pre code")
    .forEach((block) => hljs.highlightElement(block));
  enhanceCodeBlocks(bubble);
  
  // FIX 12: Add onerror handlers to carousel images to hide broken ones
  bubble.querySelectorAll('.image-carousel img, .image-card img').forEach(img => {
    img.onerror = function() {
      // Hide the entire image card if image fails to load
      const card = this.closest('.image-card');
      if (card) card.style.display = 'none';
      else this.style.display = 'none';
    };
  });
  
  // Render any chartdata blocks as interactive charts
  renderChartBlocks(bubble);
  
  // Attach hover listeners to the citation badges
  if (typeof attachCitationHoverListeners === "function") {
    attachCitationHoverListeners(bubble);
  }
}

// ============================================
// STREAM RESPONSE
// ============================================

/**
 * Streams the response text to the chat bubble and the code to the canvas.
 */
async function streamResponse(fullText) {
  const bubble = addMessage("", "ai", true);
  let textToStream = fullText;
  let codeToCanvas = "";
  let codeNeedsStreaming = false;

  if (typeof isCanvasModeActive !== "undefined" && isCanvasModeActive) {
    let { code, text } = parseCodeFromResponse(fullText);

    // FORCE CONTENT TO CANVAS IN DOC MODE
    // If no code block detected, but we are in 'doc' mode, treat entire response as the document
    if (window.currentCanvasMode === 'doc' && !code && fullText.length > 20) {
        console.log("📝 forcing full text to canvas (doc mode)");
        code = fullText;
        text = "I've drafted the document in the Canvas.";
    }

    if (code) {
      if (typeof canvasPane !== "undefined" && canvasPane)
        canvasPane.classList.add("active");
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

  if (codeNeedsStreaming) {
    const newCode = codeToCanvas;
    let lang = "plaintext";

    // FORCE MARKDOWN LANGUAGE IN DOC MODE
    if (window.currentCanvasMode === 'doc') {
        lang = "markdown";
    } else if (newCode.includes("<") || newCode.includes(">")) {
      lang = "html";
    } else if (newCode.includes("function") || newCode.includes("const")) {
      lang = "javascript";
    }

    if (typeof monacoEditorContainer !== "undefined" && monacoEditorContainer) {
      monacoEditorContainer.style.display = "block";
    }
    if (typeof canvasPlaceholder !== "undefined" && canvasPlaceholder) {
      canvasPlaceholder.style.display = "none";
    }
    if (typeof monacoEditor !== "undefined" && monacoEditor) {
      monacoEditor.setValue("// Loading code...\n");
    }
    if (typeof switchCanvasTab === "function") switchCanvasTab("code");

    const codeStreamPromise =
      typeof streamCodeToCanvas === "function"
        ? streamCodeToCanvas(codeToCanvas, lang)
        : Promise.resolve();

    await streamTextToBubble(textToStream, bubble);
    await codeStreamPromise;
  } else {
    await streamTextToBubble(fullText, bubble);
  }

  const sendBtn = document.getElementById("send-btn");
  const stopBtn = document.getElementById("stop-btn");
  
  // ATTACH SOURCES TO THIS MESSAGE ELEMENT (prevents race conditions)
  const parentWrapper = bubble.parentElement;
  if (window.lastResponseSources && window.lastResponseSources.length > 0) {
    // Store sources on the message element itself
    parentWrapper.dataset.sources = JSON.stringify(window.lastResponseSources);
    console.log(`📋 Attached ${window.lastResponseSources.length} sources to message element`);
  }
  
  // ADD STACKED SOURCES INDICATOR (only if not already present)
  const actionsDiv = parentWrapper.querySelector(".message-actions");
  if (actionsDiv && window.lastResponseSources && window.lastResponseSources.length > 0) {
    // Check if sources indicator already exists (prevents duplicates)
    if (!actionsDiv.querySelector('.sources-stack-container') && typeof createSourcesStackIndicator === "function") {
      const sourcesIndicator = createSourcesStackIndicator(window.lastResponseSources);
      actionsDiv.appendChild(sourcesIndicator);
      console.log(`🔗 Added stacked sources indicator with ${window.lastResponseSources.length} sources`);
    }
  }
  
  // Append Sources Panel if sources are available from web search
  if (typeof appendSourcesPanel === "function") {
    appendSourcesPanel(parentWrapper);
  }

  if (sendBtn) sendBtn.style.display = "flex";
  if (stopBtn) {
    stopBtn.style.display = "none";
    stopBtn.classList.remove("generating");
    const toolbarRight = stopBtn.closest(".toolbar-right");
    if (toolbarRight) toolbarRight.classList.remove("generating");
  }
  isResponding = false;

  const copyBtn = actionsDiv.querySelector(".fa-copy").parentElement;
  copyBtn.onclick = () => {
    const textToCopy = codeToCanvas || fullText;
    copyToClipboard(textToCopy, copyBtn);
  };

  const shareBtn = actionsDiv.querySelector(".fa-share-nodes").parentElement;
  shareBtn.onclick = () => shareResponse(fullText);
}
