/**
 * canvas-toolbar.js
 * Handles the logic for the fixed formatting toolbar in the Canvas header.
 * Supports formatting for both Monaco Editor (Markdown/Code) and Preview (WYSIWYG).
 */

const CanvasToolbar = {
    editor: null,
    toolbar: null,
    buttons: {},
    activeContext: 'monaco', // 'monaco' | 'preview'

    init(monacoEditor) {
        this.editor = monacoEditor;
        this.toolbar = document.getElementById('formatting-toolbar');
        
        if (!this.toolbar) {
            console.warn("Formatting toolbar element not found.");
            return;
        }

        // Initialize buttons
        this.buttons = {
            bold: this.toolbar.querySelector('[data-format="bold"]'),
            italic: this.toolbar.querySelector('[data-format="italic"]'),
            heading: this.toolbar.querySelector('[data-format="heading"]'),
            list: this.toolbar.querySelector('[data-format="list"]')
        };

        // Bind click events
        Object.keys(this.buttons).forEach(type => {
            const btn = this.buttons[type];
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.applyFormatting(type);
                });
                
                // Prevent focus loss when clicking button
                btn.addEventListener('mousedown', (e) => {
                     e.preventDefault();
                });
            }
        });

        // Listen for Monaco selection changes
        this.editor.onDidChangeCursorSelection((e) => {
            const selection = this.editor.getSelection();
            if (selection && !selection.isEmpty()) {
                this.activeContext = 'monaco';
                this.updateToolbarState(true);
            } else {
                // Only disable if we were in monaco mode
                if (this.activeContext === 'monaco') {
                    this.updateToolbarState(false);
                }
            }
        });
        
        // Listen for Preview selection changes (from iframe)
        window.addEventListener('message', (e) => {
            if (e.data.type === 'preview-selection') {
                if (e.data.hasSelection) {
                    this.activeContext = 'preview';
                    this.updateToolbarState(true);
                } else {
                    if (this.activeContext === 'preview') {
                        this.updateToolbarState(false);
                    }
                }
            }
        });

        // Initial state update
        this.updateToolbarState(false);
        
        console.log("✅ Canvas Toolbar Initialized (Dual Mode)");
    },

    updateToolbarState(isEnabled) {
        if (!this.toolbar) return;

        if (isEnabled) {
            this.toolbar.classList.remove('disabled');
            this.toolbar.querySelectorAll('button').forEach(btn => btn.disabled = false);
            this.toolbar.style.opacity = "1";
            this.toolbar.style.pointerEvents = "auto";
        } else {
            this.toolbar.classList.add('disabled');
            this.toolbar.querySelectorAll('button').forEach(btn => btn.disabled = true);
            this.toolbar.style.opacity = "0.3";
            this.toolbar.style.pointerEvents = "none";
        }
    },

    applyFormatting(type) {
        // console.log(`Applying formatting: ${type} to ${this.activeContext}`);

        // --- PREVIEW MODE (WYSIWYG) ---
        if (this.activeContext === 'preview') {
            let format = type;
            let value = null;

            // Map internal types to execCommand types
            // 'bold' -> 'bold'
            // 'italic' -> 'italic'
            if (type === 'heading') { 
                format = 'formatBlock'; 
                value = '<h1>'; // Simple toggle for now
            }
            if (type === 'list') { 
                format = 'insertUnorderedList'; 
            }

            const iframe = document.getElementById('canvas-preview-iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ 
                    type: 'apply-format', 
                    format: format, 
                    value: value 
                }, '*');
            }
            return;
        }

        // --- MONACO MODE ---
        if (!this.editor) return;

        const selection = this.editor.getSelection();
        if (!selection || selection.isEmpty()) return;

        const model = this.editor.getModel();
        const text = model.getValueInRange(selection);
        
        let newText = text;

        switch (type) {
            case 'bold':
                if (text.startsWith('**') && text.endsWith('**')) {
                    newText = text.substring(2, text.length - 2);
                } else {
                    newText = `**${text}**`;
                }
                break;
                
            case 'italic':
                if (text.startsWith('*') && text.endsWith('*') && !text.startsWith('**')) {
                    newText = text.substring(1, text.length - 1);
                } else {
                    newText = `*${text}*`;
                }
                break;
                
            case 'heading':
                this.toggleLinePrefix(['# ', '## ', '### ']);
                return; 
                
            case 'list':
                this.toggleLinePrefix(['- ']);
                return;
        }

        this.editor.executeEdits('toolbar', [{
            range: selection,
            text: newText,
            forceMoveMarkers: true
        }]);
    },

    // Helper for Monaco line-based formatting
    toggleLinePrefix(prefixes) {
        const selection = this.editor.getSelection();
        const model = this.editor.getModel();
        const startLineNumber = selection.startLineNumber;
        const lineContent = model.getLineContent(startLineNumber);
        
        let newLineContent = lineContent;
        let matched = false;

        for (const prefix of prefixes) {
            if (lineContent.startsWith(prefix)) {
                newLineContent = lineContent.substring(prefix.length);
                matched = true;
                break;
            }
        }
        
        if (!matched) {
            newLineContent = prefixes[0] + lineContent;
        }
        
        const range = new monaco.Range(startLineNumber, 1, startLineNumber, lineContent.length + 1);
        
        this.editor.executeEdits('toolbar', [{
            range: range,
            text: newLineContent
        }]);
    }
};

window.CanvasToolbar = CanvasToolbar;
