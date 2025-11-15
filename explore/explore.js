/*
  explore.js
  This file contains logic ONLY for the Explore page (explore.html).
*/
console.log("Explore script loaded.");

// --- Page-Specific DOM ContentLoaded ---
document.addEventListener("DOMContentLoaded", () => {
  // Store original HTML for tool input containers to reset them
  ["code", "roadmap", "seo", "regex"].forEach((toolName) => {
    const view = document.getElementById(`tool-${toolName}-view`);
    const inputContainer = document.getElementById(
      `${toolName}-input-container`
    );
    if (view && inputContainer) {
      // Store the innerHTML on the view element itself
      view.originalInputHTML = inputContainer.innerHTML;
    }
  });

  // Initialize Mermaid
  if (typeof mermaid !== "undefined") {
    try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "loose", // securityLevel loose needed for clicks
        });
    } catch (e) {
        console.warn("Mermaid init error:", e);
    }
  }
});

// --- TOOL SWITCHING ---

// This replaces the old global switchView function
function switchToolView(viewId) {
  console.log("switchToolView called:", viewId);
  // Hide all view-sections on this page
  document.querySelectorAll("#main-content .view-section").forEach((view) => {
    view.classList.remove("active");
  });

  // Show the target view
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add("active");
    
    // Set the active tool pane for error messages
    document
        .querySelectorAll(".tool-result-pane")
        .forEach((el) => el.classList.remove("active-tool-pane"));
    
    const toolName = viewId.replace('tool-', '');
    const pane =
      document.getElementById(`view-${toolName === "code" ? "text-response" : toolName + "-text"}`) ||
      document.getElementById("view-text-response");
    if (pane) pane.classList.add("active-tool-pane");
  }
}

function resetTool(toolName) {
  const view = document.getElementById(`tool-${toolName}-view`);
  if (!view) return;
  view.classList.remove("generation-active");
  const placeholder = document.getElementById(`${toolName}-placeholder`);
  if (placeholder) placeholder.style.display = "flex";
  const result = document.getElementById(`${toolName}-result`);
  if (result) result.style.display = "none";

  const inputContainer = document.getElementById(`${toolName}-input-container`);
  const contentArea = document.getElementById(`${toolName}-content-area`);
  if (
    inputContainer &&
    contentArea &&
    inputContainer.classList.contains("moved")
  ) {
    inputContainer.classList.remove("moved");
    // Restore original HTML
    if(view.originalInputHTML) {
        inputContainer.innerHTML = view.originalInputHTML;
    }
    contentArea.prepend(inputContainer);
  }

  const responsePane = document.getElementById(
    `view-${toolName === "code" ? "text-response" : toolName + "-text"}`
  );
  if (responsePane) responsePane.innerHTML = "";

  if (toolName === "roadmap") {
    const vizPane = document.getElementById("roadmap-visualizer-pane");
    if (vizPane)
      vizPane.innerHTML = `<div class="tool-visualizer-placeholder" id="roadmap-viz-placeholder"><i class="fa-solid fa-network-wired"></i><p>Roadmap visualizer will appear here</p></div>`;
  }
  if (toolName === "seo") {
    const vizPane = document.getElementById("seo-visualizer-pane");
    if (vizPane)
      vizPane.innerHTML = `<div class="tool-visualizer-placeholder" id="seo-viz-placeholder"><i class="fa-solid fa-cloud"></i><p>Keyword cloud will appear here</p></div>`;
  }

  const switchBtn = document.getElementById(`${toolName}-canvas-switch-btn`);
  if (switchBtn) switchBtn.style.display = "none";
  const toggle = document.getElementById(`${toolName}-canvas-mode-toggle`);
  if (toggle) toggle.checked = false;

  // Clear global state variables (from script.js)
  if (toolName === "code") {
    codeHistory = [];
    codeSnapshots = [];
    currentSnapshotIndex = -1;
    generatedRawCode = "";
    const codeBlock = document.getElementById("code-output-block");
    if (codeBlock) codeBlock.textContent = "";
    const iframe = document.getElementById("preview-frame");
    if (iframe) iframe.src = "about:blank";
    const historyNav = document.getElementById("code-history-nav");
    if (historyNav) historyNav.style.display = "none";
  } else if (toolName === "roadmap") {
    roadmapHistory = [];
  } else if (toolName === "seo") {
    seoHistory = [];
  } else if (toolName === "regex") {
    regexHistory = [];
  }
  saveState(); // Save cleared state (global func)
}


// --- TOOL UI HELPERS ---

function switchCodeViewTab(tabName) {
  const tabCode = document.getElementById("tab-btn-code");
  const tabPreview = document.getElementById("tab-btn-preview");
  const viewCode = document.getElementById("view-code-content");
  const viewPreview = document.getElementById("view-preview-content");

  if (viewCode) viewCode.style.display = "none";
  if (viewPreview) viewPreview.style.display = "none";
  if (tabCode) tabCode.classList.remove("active");
  if (tabPreview) tabPreview.classList.remove("active");

  if (tabName === "code") {
    if (viewCode) viewCode.style.display = "flex";
    if (tabCode) tabCode.classList.add("active");
  } else {
    if (viewPreview) viewPreview.style.display = "flex";
    if (tabPreview) tabPreview.classList.add("active");
  }
}

function switchToCanvasView(toolName) {
  const resultContainer = document.getElementById(toolName + "-result");
  if (!resultContainer) return;
  resultContainer.classList.remove("regular-mode");
  
  const switchBtn = document.getElementById(toolName + "-canvas-switch-btn");
  if (switchBtn) switchBtn.style.display = "none";

  if (toolName === "code") {
    const toggle = document.getElementById("canvas-mode-toggle");
    if (toggle) toggle.checked = true;

    updateCodePreview(generatedRawCode); // global var

    const textResponsePane = document.getElementById("view-text-response");
    if(textResponsePane) {
        textResponsePane
          .querySelectorAll(".prompt-display.ai .bubble")
          .forEach((bubble) => {
            const pre = bubble.querySelector("pre");
            if (pre) pre.remove();
          });
    }
    switchCodeViewTab("code");
  }
}

async function streamCodeToEditor(fullCodeString, lang = "html", signal) {
  const codeBlock = document.getElementById("code-output-block");
  const iframe = document.getElementById("preview-frame");
  if (!codeBlock || !iframe) return;

  codeBlock.className = `language-${lang}`;
  codeBlock.textContent = ""; 

  const chunks = fullCodeString.match(/(\s+|\S+)/g) || [];

  for (const chunk of chunks) {
    if (signal && signal.aborted) {
      break; 
    }
    codeBlock.textContent += chunk;
    
    const editorPane = codeBlock.parentElement;
    if (editorPane.scrollTop + editorPane.clientHeight >= editorPane.scrollHeight - 50) {
        editorPane.scrollTop = editorPane.scrollHeight;
    }

    await new Promise(r => setTimeout(r, 5)); 
  }

  codeBlock.textContent = fullCodeString; 
  hljs.highlightElement(codeBlock);

  // Parse and render iFrame
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  let html = "";
  let css = "";
  let js = "";
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  let foundBlocks = false;

  while ((match = regex.exec(fullCodeString)) !== null) {
    foundBlocks = true;
    const blockLang = match[1].toLowerCase();
    const content = match[2];
    if (blockLang === "html") html += content + "\n";
    else if (blockLang === "css") css += content + "\n";
    else if (blockLang === "javascript" || blockLang === "js") js += content + "\n";
  }

  if (!foundBlocks) {
    if (lang === "html") html = fullCodeString;
    else if (lang === "css") css = fullCodeString;
    else if (lang === "javascript") js = fullCodeString;
  }

  const finalSource = `
    <!DOCTYPE html><html><head><style>${css}</style></head>
    <body>${html}<script>${js}<\/script></body></html>`;
  
  doc.open();
  doc.write(finalSource);
  doc.close();
}

function updateCodePreview(fullCodeString, lang = "html") {
    // This function is for non-streaming updates (like history nav)
    const codeBlock = document.getElementById("code-output-block");
    const iframe = document.getElementById("preview-frame");
    if (!codeBlock || !iframe) return;

    codeBlock.className = `language-${lang}`;
    codeBlock.textContent = fullCodeString;
    hljs.highlightElement(codeBlock);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    let html = "";
    let css = "";
    let js = "";
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    let foundBlocks = false;

    while ((match = regex.exec(fullCodeString)) !== null) {
        foundBlocks = true;
        const blockLang = match[1].toLowerCase();
        const content = match[2];
        if (blockLang === "html") html += content + "\n";
        else if (blockLang === "css") css += content + "\n";
        else if (blockLang === "javascript" || blockLang === "js") js += content + "\n";
    }

    if (!foundBlocks) {
        if (lang === "html") html = fullCodeString;
        else if (lang === "css") css = fullCodeString;
        else if (lang === "javascript") js = fullCodeString;
    }

    const finalSource = `
    <!DOCTYPE html><html><head><style>${css}</style></head>
    <body>${html}<script>${js}<\/script></body></html>`;
    
    doc.open();
    doc.write(finalSource);
    doc.close();
}


function addToolUserPrompt(pane, prompt) {
  if (!pane) return;
  const userPromptDisplay = document.createElement("div");
  userPromptDisplay.className = "prompt-display user";
  userPromptDisplay.innerHTML = `<div class="avatar user"><i class="fa-regular fa-user"></i></div>`;
  const userBubble = document.createElement("div");
  userBubble.className = "bubble";
  userBubble.textContent = prompt;
  userPromptDisplay.appendChild(userBubble);
  pane.appendChild(userPromptDisplay);
  pane.scrollTop = pane.scrollHeight;
}

function addToolThinking(pane) {
  if (!pane) return null;
  const thinkingElement = document.createElement("div");
  thinkingElement.className = "prompt-display ai thinking";
  thinkingElement.innerHTML = `<div class="avatar ai"><i class="fa-solid fa-bolt"></i></div>
         <div class="bubble"><div class="thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  pane.appendChild(thinkingElement);
  pane.scrollTop = pane.scrollHeight;
  return thinkingElement;
}

function getFollowupBarHTML(toolName, functionName) {
  const inputId = `${toolName}-followup-prompt`;
  const sendBtnId = `${toolName}-followup-send-btn`;
  const stopBtnId = `${toolName}-followup-stop-btn`;

  return `
<div class="tool-followup-bar">
  <input type="text" id="${inputId}" class="tool-followup-input" placeholder="Ask a follow-up...">
  <button class="send-btn" id="${sendBtnId}" onclick="${functionName}()">
      <i class="fa-solid fa-arrow-up"></i>
  </button>
  <button class="stop-btn" id="${stopBtnId}" onclick="stopToolResponse('${toolName}')" style="display: none;">
      <i class="fa-solid fa-square"></i>
  </button>
</div>`;
}

function setToolResponding(toolName, responding) {
  isResponding = responding; // global var
  const sendBtn = document.getElementById(`${toolName}-followup-send-btn`);
  const stopBtn = document.getElementById(`${toolName}-followup-stop-btn`);

  if (responding) {
    if (sendBtn) sendBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "flex";
  } else {
    if (sendBtn) sendBtn.style.display = "flex";
    if (stopBtn) stopBtn.style.display = "none";
  }
}

function stopToolResponse(toolName) {
  if (currentController) {
    currentController.abort(); // global var
    currentController = null;
  }
  isResponding = false; // global var
  setToolResponding(toolName, false);
}

async function streamToolResponse(
  pane,
  fullText,
  thinkingElement,
  toolName = null
) {
  if (thinkingElement) thinkingElement.remove();
  if (!pane) return;

  const aiTextBlock = document.createElement("div");
  aiTextBlock.className = "prompt-display ai";
  aiTextBlock.innerHTML = `<div class="avatar ai"><i class="fa-solid fa-bolt"></i></div>`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  aiTextBlock.appendChild(bubble);
  pane.appendChild(aiTextBlock);

  const words = fullText.split(" ");
  let currentText = "";

  for (let i = 0; i < words.length; i++) {
    if (!isResponding) { // global var
      bubble.innerHTML = marked.parse(currentText.trim());
      bubble
         .querySelectorAll("pre code")
          .forEach((block) => {
            if (block.classList.contains("language-mermaid")) return;
            hljs.highlightElement(block);
          });
      if (toolName) setToolResponding(toolName, false);
      saveState(); // global func
      return;
    }

    currentText += words[i] + " ";
    bubble.innerHTML = marked.parse(
      currentText + (i < words.length - 1 ? "..." : "")
    );
    pane.scrollTop = pane.scrollHeight;
    await new Promise((r) =>
      setTimeout(r, Math.floor(Math.random() * 10) + 10)
    );
  }

  bubble.innerHTML = marked.parse(fullText);
  bubble
    .querySelectorAll("pre code")
    .forEach((block) => hljs.highlightBlock(block));

  if (toolName) setToolResponding(toolName, false);
  pane.scrollTop = pane.scrollHeight;
  saveState(); // global func
}

function updateCodeHistoryNav() {
  const nav = document.getElementById("code-history-nav");
  const status = document.getElementById("code-history-status");
  if (!nav || !status) return;

  if (codeSnapshots.length > 0) { // global var
    nav.style.display = "flex";
    status.textContent = `Generation ${currentSnapshotIndex + 1} of ${
      codeSnapshots.length
    }`;

    const buttons = nav.querySelectorAll(".history-nav-btn");
    buttons[0].onclick = () => navigateCodeHistory(-1);
    buttons[1].onclick = () => navigateCodeHistory(1);

    buttons[0].disabled = currentSnapshotIndex <= 0;
    buttons[1].disabled = currentSnapshotIndex >= codeSnapshots.length - 1;
  } else {
    nav.style.display = "none";
  }
}

function navigateCodeHistory(direction) {
  const newIndex = currentSnapshotIndex + direction;
  if (newIndex >= 0 && newIndex < codeSnapshots.length) {
    currentSnapshotIndex = newIndex;
    const snapshot = codeSnapshots[currentSnapshotIndex];
    generatedRawCode = snapshot.code; // global var
    updateCodePreview(snapshot.code, snapshot.lang); // this is a local func
    updateCodeHistoryNav(); // this is a local func
    saveState(); // global func
  }
}

// --- CODE GENERATOR ---

async function generateCode() {
  const promptEl = document.getElementById("code-prompt");
  if (!promptEl) return;
  const prompt = promptEl.value.trim();
  if (!prompt) {
    showToast("Please enter a prompt first."); // global func
    return;
  }

  document.getElementById("tool-code-view").classList.add("generation-active");
  const isCanvasMode = document.getElementById("canvas-mode-toggle").checked;

  document.getElementById("code-placeholder").style.display = "none";
  const resultContainer = document.getElementById("code-result");
  resultContainer.style.display = "grid";

  const inputContainer = document.getElementById("code-input-container");
  const leftColumn = document.getElementById("code-result-left-column");
  if (!inputContainer.classList.contains("moved")) {
    leftColumn.appendChild(inputContainer);
    inputContainer.classList.add("moved");
    inputContainer.innerHTML = getFollowupBarHTML(
      "code",
      "generateCodeFollowup"
    );
    document
      .getElementById("code-followup-prompt")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          generateCodeFollowup();
        }
      });
  }

  if (isCanvasMode) resultContainer.classList.remove("regular-mode");
  else resultContainer.classList.add("regular-mode");

  const textResponsePane = document.getElementById("view-text-response");
  addToolUserPrompt(textResponsePane, prompt);
  const thinkingElement = addToolThinking(textResponsePane);

  setToolResponding("code", true);

  if (currentController) currentController.abort();
  currentController = new AbortController();
  const signal = currentController.signal;

  try {
    codeHistory = []; // global var
    codeSnapshots = []; // global var
    currentSnapshotIndex = -1; // global var

    const taskMessage = `You are an expert code generator.
1.  Provide a brief explanation of your solution.
2.  After the explanation, provide this exact separator tag: [CODE_BLOCK_SEPARATOR]
3.  After the tag, provide the complete code in markdown blocks (html, css, js).
DO NOT put any other text after the separator tag.`;

    const systemMessage = getSystemMessage(taskMessage); // global func

    const fullResponse = await getApiResponse( // global func
      prompt,
      systemMessage,
      [],
      signal
    );

    codeHistory.push({ role: "user", content: prompt });
    codeHistory.push({ role: "assistant", content: fullResponse });

    const parts = fullResponse.split("[CODE_BLOCK_SEPARATOR]");
    const explanation = parts[0] ? parts[0].trim() : "Generating code...";
    const code = parts[1] ? parts[1].trim() : fullResponse;

    generatedRawCode = code; // global var
    const lang = "html"; 

    if (generatedRawCode) {
      codeSnapshots.push({ code: generatedRawCode, lang: lang });
      currentSnapshotIndex = codeSnapshots.length - 1;
    }

    await streamToolResponse(
      textResponsePane,
      explanation,
      thinkingElement,
      "code"
    );

    await streamCodeToEditor(code, lang, signal);

    if (!isCanvasMode) {
      document.getElementById("code-canvas-switch-btn").style.display = "flex";
    }

    updateCodeHistoryNav();
    switchCodeViewTab("code");
    saveState(); // global func
    showToast("Code Generated Successfully!"); // global func
  } catch (error) {
    showApiError(error.message, thinkingElement); // global func
  } finally {
    setToolResponding("code", false);
    currentController = null;
  }
}

async function generateCodeFollowup() {
  const promptInput = document.getElementById("code-followup-prompt");
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  const resultContainer = document.getElementById("code-result");
  const isCanvasMode = !resultContainer.classList.contains("regular-mode");
  const textResponsePane = document.getElementById("view-text-response");

  addToolUserPrompt(textResponsePane, prompt);
  promptInput.value = "";
  const thinkingElement = addToolThinking(textResponsePane);

  setToolResponding("code", true);

  if (currentController) currentController.abort();
  currentController = new AbortController();
  const signal = currentController.signal;

  try {
    const taskMessage = `You are an expert code generator. The user is asking a follow-up.
1.  Provide a brief explanation of the code changes.
2.  After the explanation, provide this exact separator tag: [CODE_BLOCK_SEPARATOR]
3.  After the tag, provide the complete, updated code in markdown blocks.
DO NOT put any other text after the separator tag.`;
    
    const systemMessage = getSystemMessage(taskMessage); // global func

    const fullResponse = await getApiResponse( // global func
      prompt,
      systemMessage,
      codeHistory, // global var
      signal
    );

    codeHistory.push({ role: "user", content: prompt });
    codeHistory.push({ role: "assistant", content: fullResponse });

    const parts = fullResponse.split("[CODE_BLOCK_SEPARATOR]");
    const explanation = parts[0] ? parts[0].trim() : "Updating code...";
    const code = parts[1] ? parts[1].trim() : fullResponse;

    generatedRawCode = code; // global var
    const lang = "html";

    if (generatedRawCode) {
      codeSnapshots.push({ code: generatedRawCode, lang: lang }); // global var
      currentSnapshotIndex = codeSnapshots.length - 1; // global var
    }

    await streamToolResponse(
      textResponsePane,
      explanation,
      thinkingElement,
      "code"
    );

    await streamCodeToEditor(code, lang, signal);

    if (!isCanvasMode) {
      document.getElementById("code-canvas-switch-btn").style.display = "flex";
    }

    updateCodeHistoryNav();
    switchCodeViewTab("code");
    saveState(); // global func
  } catch (error) {
    showApiError(error.message, thinkingElement); // global func
  } finally {
    setToolResponding("code", false);
    currentController = null;
  }
}

function copyGeneratedCode() {
  if (generatedRawCode) { // global var
    navigator.clipboard.writeText(generatedRawCode).then(() => {
      showToast("Code copied to clipboard!"); // global func
    });
  }
}

// --- ROADMAP GENERATOR ---

function parseAiResponse(fullText, dataTag = "VISUALIZER_DATA") {
  const regex = new RegExp(`\\[${dataTag}\\]([\\s\\S]*?)\\[\\/${dataTag}\\]`, "im");
  const match = fullText.match(regex);
  if (!match) return { text: fullText.trim(), data: null };

  let dataString = match[1].trim();
  let parsedData = null;
  try {
    parsedData = JSON.parse(dataString);
  } catch {
    parsedData = { graph: dataString };
  }

  const cleanedText = fullText.replace(regex, "").trim();
  return { text: cleanedText, data: parsedData };
}

function normalizeGraphData(graphCandidate) {
  if (!graphCandidate) return null;
  let graphText = graphCandidate;
  if (typeof graphCandidate === "object" && graphCandidate.graph) {
    graphText = graphCandidate.graph;
  }
  if (typeof graphText === "string") {
    const trimmed = graphText.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith('"')) {
      try {
        const parsedOnce = JSON.parse(trimmed);
        if (parsedOnce && parsedOnce.graph) {
          graphText = parsedOnce.graph;
        } else {
          if (typeof parsedOnce === "string") graphText = parsedOnce;
        }
      } catch (e) {
        try {
          const unescaped = trimmed.replace(/\\n/g, "\\n");
          const parsed2 = JSON.parse(unescaped);
          if (parsed2 && parsed2.graph) graphText = parsed2.graph;
        } catch (ee) {
          graphText = trimmed;
        }
      }
    }
  }
  graphText = graphText.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  if (
    (graphText.startsWith('"') && graphText.endsWith('"')) ||
    (graphText.startsWith("'") && graphText.endsWith("'"))
  ) {
    graphText = graphText.slice(1, -1);
  }
  return graphText.trim();
}

async function renderRoadmapVisualizer(graphDefinition) {
  const pane = document.getElementById("roadmap-visualizer-pane");
  if (!pane) return;
  pane.innerHTML = ""; 

  try {
    if (
      !graphDefinition ||
      (!graphDefinition.trim().startsWith("graph") &&
        !graphDefinition.trim().startsWith("flowchart") &&
        !graphDefinition.trim().startsWith("sequence") &&
        !graphDefinition.trim().startsWith("gantt"))
    ) {
      pane.innerHTML = `<div class="tool-visualizer-placeholder"><i class="fa-solid fa-exclamation-triangle"></i><p>Could not render visualizer: invalid or missing Mermaid graph.</p></div>`;
      return;
    }
    
    if (typeof mermaid === "undefined") {
      pane.innerHTML = `<div class="tool-visualizer-placeholder"><i class="fa-solid fa-exclamation-triangle"></i><p>Mermaid not loaded.</p></div>`;
      return;
    }

    const graphId = "roadmap-graph-" + Date.now();
    const { svg } = await mermaid.render(graphId, graphDefinition);
    pane.innerHTML = svg;

    const svgEl = pane.querySelector("svg");
    if (svgEl) {
      svgEl.style.maxWidth = "100%";
      svgEl.style.height = "auto";
      svgEl.setAttribute("preserveAspectRatio", "xMidYMin meet");
      svgEl.style.display = "block";
    }
  } catch (error) {
    console.error("renderRoadmapVisualizer error:", error);
    pane.innerHTML = `<div class="tool-visualizer-placeholder"><i class="fa-solid fa-exclamation-triangle"></i><p>An error occurred while rendering the visualizer.</p></div>`;
  }
}

// This is the function called by the global window.onRoadmapNodeClick
function handleRoadmapNodeClick(nodeId) {
    const topic = nodeId.replace(/['"]+/g, "");
    const prompt = `Tell me more about ${topic} from the roadmap.`;
    const input = document.getElementById("roadmap-followup-prompt");
    if (input) {
        input.value = prompt;
        showToast(`Loading details for: ${topic}...`); // global func
        generateRoadmapFollowup();
    }
}

async function generateRoadmap() {
  const promptEl = document.getElementById("roadmap-prompt");
  if (!promptEl) return;
  const prompt = promptEl.value.trim();
  if (!prompt) {
    showToast("Please enter a topic to learn."); // global func
    return;
  }

  document
    .getElementById("tool-roadmap-view")
    .classList.add("generation-active");
  const isCanvasMode = document.getElementById(
    "roadmap-canvas-mode-toggle"
  ).checked;

  document.getElementById("roadmap-placeholder").style.display = "none";
  const resultContainer = document.getElementById("roadmap-result");
  resultContainer.style.display = "grid";
  if (isCanvasMode) resultContainer.classList.remove("regular-mode");
  else resultContainer.classList.add("regular-mode");

  const inputContainer = document.getElementById("roadmap-input-container");
  const leftColumn = document.getElementById("roadmap-result-left-column");
  if (!inputContainer.classList.contains("moved")) {
    leftColumn.appendChild(inputContainer);
    inputContainer.classList.add("moved");
    inputContainer.innerHTML = getFollowupBarHTML(
      "roadmap",
      "generateRoadmapFollowup"
    );
    document
      .getElementById("roadmap-followup-prompt")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          generateRoadmapFollowup();
        }
      });
  }

  const textResponsePane = document.getElementById("view-roadmap-text");
  addToolUserPrompt(textResponsePane, prompt);
  const thinkingElement = addToolThinking(textResponsePane);
  setToolResponding("roadmap", true);

  if (currentController) currentController.abort();
  currentController = new AbortController();
  const signal = currentController.signal;

  try {
    const taskMessage = `
You are an expert curriculum designer.
1. Create a clear, step-by-step learning roadmap in markdown.
2. After the markdown, add a [VISUALIZER_DATA] block.
3. Inside this block, return valid JSON: { "graph": "<Mermaid.js graph with escaped \\n>" }.
4. For every node, include: click NodeID call onRoadmapNodeClick("Node Text").
        `;
    const systemMessage = getSystemMessage(taskMessage); // global func
    const fullResponse = await getApiResponse( // global func
      prompt,
      systemMessage,
      [],
      signal
    );

    roadmapHistory = []; // global var
    roadmapHistory.push({ role: "user", content: prompt });
    roadmapHistory.push({ role: "assistant", content: fullResponse });

    const { text, data } = parseAiResponse(fullResponse, "VISUALIZER_DATA");
    const displayText =
      text && text.trim() ? text : "_(Visualizer generated — no extra text)_";

    await streamToolResponse(
      textResponsePane,
      displayText,
      thinkingElement,
      "roadmap"
    );
    
    if (data && data.graph) {
      const graphDef = normalizeGraphData(data.graph);
      if (graphDef) {
        await renderRoadmapVisualizer(graphDef);
      } else {
        document.getElementById(
          "roadmap-visualizer-pane"
        ).innerHTML = `<div class="tool-visualizer-placeholder"><i class="fa-solid fa-exclamation-triangle"></i><p>Visualizer data could not be parsed.</p></div>`;
      }
    }

    if (!isCanvasMode) {
      document.getElementById("roadmap-canvas-switch-btn").style.display =
        "flex";
    }

    saveState(); // global func
  } catch (error) {
    showApiError(error.message, thinkingElement); // global func
    setToolResponding("roadmap", false);
  } finally {
    currentController = null;
  }
}

async function generateRoadmapFollowup() {
  const promptInput = document.getElementById("roadmap-followup-prompt");
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  const textResponsePane = document.getElementById("view-roadmap-text");
  addToolUserPrompt(textResponsePane, prompt);
  promptInput.value = "";

  const thinkingElement = addToolThinking(textResponsePane);
  setToolResponding("roadmap", true);

  if (currentController) currentController.abort();
  currentController = new AbortController();
  const signal = currentController.signal;

  try {
    const taskMessage = `
You are continuing a roadmap discussion.
1. Reply in markdown with additional roadmap context or next steps.
2. If updating the roadmap, include a [VISUALIZER_DATA] block containing { "graph": "<Mermaid.js graph with escaped \\n>" }.
3. Ensure click NodeID call onRoadmapNodeClick("Node Text") is attached to each node.
        `;
    const systemMessage = getSystemMessage(taskMessage); // global func

    const fullResponse = await getApiResponse( // global func
      prompt,
      systemMessage,
      roadmapHistory, // global var
      signal
    );
    roadmapHistory.push({ role: "user", content: prompt });
    roadmapHistory.push({ role: "assistant", content: fullResponse });

    const { text, data } = parseAiResponse(fullResponse, "VISUALIZER_DATA");
    const displayText = text && text.trim() ? text : "_(Visualizer updated)_";

    await streamToolResponse(
      textResponsePane,
      displayText,
      thinkingElement,
      "roadmap"
    );
    
    if (data && data.graph) {
      const graphDef = normalizeGraphData(data.graph);
      if (graphDef) {
        await renderRoadmapVisualizer(graphDef);
      }
    }

    saveState(); // global func
  } catch (error) {
    showApiError(error.message, thinkingElement); // global func
    setToolResponding("roadmap", false);
  } finally {
    currentController = null;
  }
}

async function renderMermaidBlocks(containerId = "view-roadmap-text") {
  // This seems to be a duplicate/unused function from the original file
  // `renderRoadmapVisualizer` is the one being used.
}

// --- SEO ANALYZER ---

function renderKeywordCloud(keywords) {
  const pane = document.getElementById("seo-visualizer-pane");
  if (!pane) return;

  if (!keywords || keywords.length === 0) {
    pane.innerHTML = `<div class="tool-visualizer-placeholder"><i class="fa-solid fa-exclamation-triangle"></i><p>No keywords were extracted.</p></div>`;
    return;
  }
  pane.innerHTML = "";

  const weights = keywords.map((k) => k.weight);
  const maxWeight = Math.max(...weights);
  const minWeight = Math.min(...weights);

  function getStyle(weight) {
    let fontSize =
      0.9 + ((weight - minWeight) / (maxWeight - minWeight + 0.01)) * 1.3;
    let opacity =
      0.7 + ((weight - minWeight) / (maxWeight - minWeight + 0.01)) * 0.3;
    let color = "var(--text-primary)";
    if (weight > maxWeight * 0.8) color = "var(--text-heading)";
    if (weight < maxWeight * 0.3) color = "var(--text-secondary)";
    return `font-size: ${fontSize.toFixed(2)}rem; opacity: ${opacity.toFixed(
      2
    )}; color: ${color}; font-weight: ${weight > maxWeight * 0.5 ? 600 : 400};`;
  }

  keywords.forEach((kw) => {
    const tag = document.createElement("span");
    tag.className = "keyword-tag";
    tag.textContent = kw.text;
    tag.style = getStyle(kw.weight);
    pane.appendChild(tag);
  });
}

async function generateSeo() {
  const promptEl = document.getElementById("seo-prompt");
  if (!promptEl) return;
  const prompt = promptEl.value.trim();
  if (!prompt) {
    showToast("Please paste your content first."); // global func
    return;
  }

  document.getElementById("tool-seo-view").classList.add("generation-active");
  const isCanvasMode = document.getElementById(
    "seo-canvas-mode-toggle"
  ).checked;

  document.getElementById("seo-placeholder").style.display = "none";
  const resultContainer = document.getElementById("seo-result");
  resultContainer.style.display = "grid";

  if (isCanvasMode) resultContainer.classList.remove("regular-mode");
  else resultContainer.classList.add("regular-mode");

  const inputContainer = document.getElementById("seo-input-container");
  const leftColumn = document.getElementById("seo-result-left-column");
  if (!inputContainer.classList.contains("moved")) {
    leftColumn.appendChild(inputContainer);
    inputContainer.classList.add("moved");
    inputContainer.innerHTML = getFollowupBarHTML("seo", "generateSeoFollowup");
    document
      .getElementById("seo-followup-prompt")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          generateSeoFollowup();
        }
      });
  }

  const textResponsePane = document.getElementById("view-seo-text");
  addToolUserPrompt(
    textResponsePane,
    "Analyze the following content:\n\n" + prompt
  );
  const thinkingElement = addToolThinking(textResponsePane);

  setToolResponding("seo", true);

  if (currentController) currentController.abort();
  currentController = new AbortController();
  const signal = currentController.signal;

  try {
    seoHistory = []; // global var

    const taskMessage = `You are an expert SEO analyzer.
1. Analyze the user's content and provide a detailed markdown report.
2. After the report, provide a JSON array of the top 15-20 keywords and their weight (1-10).
3. Wrap the JSON array in a [VISUALIZER_DATA] block.`;
    const systemMessage = getSystemMessage(taskMessage); // global func

    const fullResponse = await getApiResponse( // global func
      prompt,
      systemMessage,
      [],
      signal
    );

    seoHistory.push({ role: "user", content: prompt });
    seoHistory.push({ role: "assistant", content: fullResponse });

    const { text, data } = parseAiResponse(fullResponse, "VISUALIZER_DATA");

    await streamToolResponse(textResponsePane, text, thinkingElement, "seo");

    if (data && Array.isArray(data)) {
      renderKeywordCloud(data);
    }

    if (!isCanvasMode) {
      document.getElementById("seo-canvas-switch-btn").style.display = "flex";
    }
    saveState(); // global func
  } catch (error) {
    showApiError(error.message, thinkingElement); // global func
    setToolResponding("seo", false);
  } finally {
    currentController = null;
  }
}

async function generateSeoFollowup() {
  const promptInput = document.getElementById("seo-followup-prompt");
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  const textResponsePane = document.getElementById("view-seo-text");

  addToolUserPrompt(textResponsePane, prompt);
  promptInput.value = "";
  const thinkingElement = addToolThinking(textResponsePane);

  setToolResponding("seo", true);

  if (currentController) currentController.abort();
  currentController = new AbortController();
  const signal = currentController.signal;

  try {
    const taskMessage =
      "You are an expert SEO analyzer. The user is asking a follow-up question about your analysis. Answer their question in detail.";
    const systemMessage = getSystemMessage(taskMessage); // global func

    const response = await getApiResponse( // global func
      prompt,
      systemMessage,
      seoHistory, // global var
      signal
    );

    seoHistory.push({ role: "user", content: prompt });
    seoHistory.push({ role: "assistant", content: response });

    await streamToolResponse(
      textResponsePane,
      response,
      thinkingElement,
      "seo"
    );

    saveState(); // global func
  } catch (error) {
    showApiError(error.message, thinkingElement); // global func
    setToolResponding("seo", false);
  } finally {
    currentController = null;
  }
}

// --- REGEX GENERATOR ---

async function generateRegex() {
  const promptEl = document.getElementById("regex-prompt");
  const testStringEl = document.getElementById("regex-test-string");
  if (!promptEl || !testStringEl) return;
  
  const prompt = promptEl.value.trim();
  if (!prompt) {
    showToast("Please describe the pattern to match."); // global func
    return;
  }

  const testString = testStringEl.value.trim();
  const fullPrompt =
    prompt +
    (testString
      ? `\n\nHere is a test string to match against:\n${testString}`
      : "");

  document.getElementById("tool-regex-view").classList.add("generation-active");
  const isCanvasMode = document.getElementById(
    "regex-canvas-mode-toggle"
  ).checked;

  document.getElementById("regex-placeholder").style.display = "none";
  const resultContainer = document.getElementById("regex-result");
  resultContainer.style.display = "grid";

  if (isCanvasMode) resultContainer.classList.remove("regular-mode");
  else resultContainer.classList.add("regular-mode");

  const inputContainer = document.getElementById("regex-input-container");
  const leftColumn = document.getElementById("regex-result-left-column");
  if (!inputContainer.classList.contains("moved")) {
    leftColumn.appendChild(inputContainer);
    inputContainer.classList.add("moved");
    inputContainer.innerHTML = getFollowupBarHTML(
      "regex",
      "generateRegexFollowup"
    );
    document
      .getElementById("regex-followup-prompt")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          generateRegexFollowup();
        }
      });
  }

  const textResponsePane = document.getElementById("view-regex-text");
  addToolUserPrompt(textResponsePane, prompt);
  const thinkingElement = addToolThinking(textResponsePane);

  setToolResponding("regex", true);

  if (currentController) currentController.abort();
  currentController = new AbortController();
  const signal = currentController.signal;

  try {
    regexHistory = []; // global var

    const taskMessage =
      "You are a Regex generation expert. First, provide the pattern in a markdown code block. Then, provide a brief explanation. If the user provides a test string, analyze it and show all matches found in a markdown list.";

    const systemMessage = getSystemMessage(taskMessage); // global func

    const response = await getApiResponse( // global func
      fullPrompt,
      systemMessage,
      [],
      signal
    );

    regexHistory.push({ role: "user", content: prompt });
    regexHistory.push({ role: "assistant", content: response });

    await streamToolResponse(
      textResponsePane,
      response,
      thinkingElement,
      "regex"
    );

    if (!isCanvasMode) {
      document.getElementById("regex-canvas-switch-btn").style.display = "flex";
    }
    saveState(); // global func
  } catch (error) {
    showApiError(error.message, thinkingElement); // global func
    setToolResponding("regex", false);
  } finally {
    currentController = null;
  }
}

async function generateRegexFollowup() {
  const promptInput = document.getElementById("regex-followup-prompt");
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  const textResponsePane = document.getElementById("view-regex-text");

  addToolUserPrompt(textResponsePane, prompt);
  promptInput.value = "";
  const thinkingElement = addToolThinking(textResponsePane);

  setToolResponding("regex", true);

  if (currentController) currentController.abort();
  currentController = new AbortController();
  const signal = currentController.signal;

  try {
    const taskMessage =
      "You are a Regex generation expert. The user is asking a follow-up question. Answer their question in detail.";
    const systemMessage = getSystemMessage(taskMessage); // global func

    const response = await getApiResponse( // global func
      prompt,
      systemMessage,
      regexHistory, // global var
      signal
    );

    regexHistory.push({ role: "user", content: prompt });
    regexHistory.push({ role: "assistant", content: response });

    await streamToolResponse(
      textResponsePane,
      response,
      thinkingElement,
      "regex"
    );

    saveState(); // global func
  } catch (error) {
    showApiError(error.message, thinkingElement); // global func
    setToolResponding("regex", false);
  } finally {
    currentController = null;
  }
}