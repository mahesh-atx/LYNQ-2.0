/*
  canvas.js
  This file contains all Monaco Editor and Canvas-related functionality.
  Separated from home.js for better maintainability.
*/

// --- Canvas DOM Elements (will be assigned on DOMContentLoaded) ---
let monacoEditorContainer; // Monaco editor container
let monacoEditor = null; // Monaco editor instance
let canvasPlaceholder;
let canvasTabCode;
let canvasTabPreview;
let canvasDownloadBtn;
let canvasContent;
let canvasPreviewWrapper;
let canvasPreviewIframe;
let canvasPreviewPlaceholder;
let canvasToggleBtn;
let canvasPane;
let canvasCloseBtn;

// --- Canvas State ---
let isCanvasModeActive = false; // State for canvas mode toggle
let monacoLoaded = false; // Track if Monaco is loaded

/**
 * Initializes Monaco Editor
 */
function initMonacoEditor() {
    if (typeof require === "undefined" || !monacoEditorContainer) {
        console.warn("Monaco loader not available or container not found");
        return;
    }

    require.config({
        paths: {
            vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs",
        },
    });

    require(["vs/editor/editor.main"], function () {
        // Define custom dark theme similar to VS Code
        monaco.editor.defineTheme("lynq-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [
                { token: "comment", foreground: "6A9955" },
                { token: "keyword", foreground: "569CD6" },
                { token: "string", foreground: "CE9178" },
                { token: "number", foreground: "B5CEA8" },
                { token: "tag", foreground: "569CD6" },
                { token: "attribute.name", foreground: "9CDCFE" },
                { token: "attribute.value", foreground: "CE9178" },
            ],
            colors: {
                "editor.background": "#1e1e1e",
                "editor.foreground": "#D4D4D4",
                "editorLineNumber.foreground": "#858585",
                "editorCursor.foreground": "#AEAFAD",
                "editor.selectionBackground": "#264F78",
                "editor.lineHighlightBackground": "#1e1e1e", // Same as background (invisible)
                "editorIndentGuide.background": "#1e1e1e", // Hide indent guides
                "editorIndentGuide.activeBackground": "#1e1e1e", // Hide active indent guides
                "scrollbarSlider.background": "#4E4E4E80",
            },
        });

        // Create the editor instance
        monacoEditor = monaco.editor.create(monacoEditorContainer, {
            value: "",
            language: "html",
            theme: "lynq-dark",
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace",
            lineNumbers: "on",
            wordWrap: "on",
            scrollBeyondLastLine: false,
            readOnly: false,
            renderWhitespace: "none",
            tabSize: 2,
            // Disable visual clutter
            renderIndentGuides: false,
            guides: {
                indentation: false,
                highlightActiveIndentation: false,
                bracketPairs: false,
            },
            renderLineHighlight: "none",
            occurrencesHighlight: false,
            folding: false,
            lineDecorationsWidth: 0,
            scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
            },
            padding: { top: 16, bottom: 16 },
        });

        monacoLoaded = true;
        console.log("✅ Monaco Editor initialized");

        // Listen for changes to update preview
        monacoEditor.onDidChangeModelContent(() => {
            if (canvasPreviewWrapper && canvasPreviewWrapper.style.display !== "none") {
                updateCanvasPreview();
            }
        });
    });
}

/**
 * Gets the current code from Monaco editor
 */
function getMonacoCode() {
    if (monacoEditor) {
        return monacoEditor.getValue();
    }
    return "";
}

/**
 * Sets the code in Monaco editor
 */
function setMonacoCode(code, language = "html") {
    if (!monacoEditor) {
        console.warn("Monaco editor not ready");
        return;
    }

    // Set the language
    const model = monacoEditor.getModel();
    if (model) {
        monaco.editor.setModelLanguage(model, language);
    }

    // Set the value
    monacoEditor.setValue(code);

    // Show the editor container
    if (monacoEditorContainer) {
        monacoEditorContainer.style.display = "block";
    }
}

/**
 * Clears the Monaco editor content
 */
function clearMonacoEditor() {
    if (monacoEditor) {
        monacoEditor.setValue("");
    }
    if (monacoEditorContainer) {
        monacoEditorContainer.style.display = "none";
    }
}

/**
 * Updates the canvas preview with current Monaco editor content
 * (Debounced to prevent excessive updates)
 */
let previewUpdateTimeout = null;
function updateCanvasPreview() {
    if (previewUpdateTimeout) {
        clearTimeout(previewUpdateTimeout);
    }
    previewUpdateTimeout = setTimeout(() => {
        generatePreview();
    }, 300);
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
        // Hide tool indicator
        const indicator = document.getElementById("selected-tool-indicator");
        if (indicator && indicator.style.display !== "none") {
            const labelEl = document.getElementById("selected-tool-label");
            if (labelEl && labelEl.textContent === "Canvas") {
                indicator.style.display = "none";
            }
        }
        if (typeof showToast === "function") showToast("Canvas Mode Disabled");
    } else {
        isCanvasModeActive = true;
        if (canvasToggleBtn) canvasToggleBtn.classList.add("active");
        // Show tool indicator
        if (typeof showSelectedToolIndicator === "function") {
            showSelectedToolIndicator('canvas', 'fa-solid fa-file-invoice', 'Canvas');
        }
        if (typeof showToast === "function") showToast("Canvas Mode Enabled");
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
 * Renders the code from the Monaco editor into the preview iframe.
 */
function generatePreview() {
    if (!canvasPreviewIframe || !canvasPreviewPlaceholder)
        return;

    const code = getMonacoCode();

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
    <script src="https://cdn.tailwindcss.com"><\/script>
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
    <script src="https://cdn.tailwindcss.com"><\/script>
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
 * Downloads the content of the Monaco editor as a file.
 */
function downloadCanvasCode() {
    const code = getMonacoCode();
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
 * CLEANS UP: Centralized function to reset the canvas UI state.
 */
function resetCanvasUI() {
    if (canvasPlaceholder) canvasPlaceholder.style.display = "flex";
    clearMonacoEditor();
    if (canvasPreviewIframe) canvasPreviewIframe.srcdoc = "";
    if (canvasPreviewPlaceholder) canvasPreviewPlaceholder.style.display = "flex";
    switchCanvasTab("code");
    toggleCanvasMode(false);
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
 * Streams code to the Monaco editor line-by-line in real-time.
 */
async function streamCodeToCanvas(codeString, lang) {
    if (!monacoEditor) {
        console.warn("Monaco editor not ready, falling back to direct set");
        setMonacoCode(codeString, lang);
        return;
    }

    // Map language to Monaco language ID
    const langMap = {
        html: "html",
        javascript: "javascript",
        js: "javascript",
        css: "css",
        python: "python",
        json: "json",
        typescript: "typescript",
        ts: "typescript",
        plaintext: "plaintext",
    };
    const monacoLang = langMap[lang] || "plaintext";

    // Show editor immediately and clear
    if (monacoEditorContainer) {
        monacoEditorContainer.style.display = "block";
    }
    if (canvasPlaceholder) {
        canvasPlaceholder.style.display = "none";
    }

    // Clear and set language
    monacoEditor.setValue("");
    const model = monacoEditor.getModel();
    if (model) {
        monaco.editor.setModelLanguage(model, monacoLang);
    }

    // Stream line-by-line for realistic typing effect
    const lines = codeString.split('\n');
    let currentCode = "";

    for (let i = 0; i < lines.length; i++) {
        if (!isResponding) {
            break;
        }

        // Add line (with newline if not the last line)
        currentCode += lines[i] + (i < lines.length - 1 ? '\n' : '');
        monacoEditor.setValue(currentCode);

        // Scroll to show current line
        monacoEditor.revealLine(i + 1);

        // Variable delay based on line length for natural feel
        const delay = Math.min(30, Math.max(5, lines[i].length / 3));
        await new Promise((r) => setTimeout(r, delay));
    }

    // Final set to ensure complete code
    monacoEditor.setValue(codeString);
}

/**
 * Initializes Canvas DOM elements - called from chat.js DOMContentLoaded
 */
function initCanvasElements() {
    canvasToggleBtn = document.getElementById("canvas-toggle-btn");
    canvasPane = document.getElementById("canvas-pane");
    canvasCloseBtn = document.getElementById("canvas-close-btn");
    monacoEditorContainer = document.getElementById("monaco-editor-container");
    canvasPlaceholder = document.getElementById("canvas-placeholder");
    canvasTabCode = document.getElementById("canvas-tab-code");
    canvasTabPreview = document.getElementById("canvas-tab-preview");
    canvasDownloadBtn = document.getElementById("canvas-download-btn");
    canvasContent = document.getElementById("canvas-content");
    canvasPreviewWrapper = document.getElementById("canvas-preview-wrapper");
    canvasPreviewIframe = document.getElementById("canvas-preview-iframe");
    canvasPreviewPlaceholder = document.getElementById("canvas-preview-placeholder");

    // Initialize Monaco Editor
    initMonacoEditor();
}

/**
 * Sets up Canvas event listeners - called from chat.js DOMContentLoaded
 */
function initCanvasListeners() {
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
}
