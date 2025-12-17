# LYNQ AI - Codebase Analysis Report

> Generated: December 17, 2025

---

## 📊 Project Overview

LYNQ is a full-stack AI chat application with multi-model support, built with **Node.js/Express** backend and **vanilla JavaScript** frontend.

### Tech Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Backend      | Node.js, Express, MongoDB (Mongoose)    |
| Frontend     | Vanilla JS, HTML5, CSS3                 |
| Auth         | Firebase Authentication                 |
| AI Providers | Google AI (Gemini), Groq                |
| Features     | Monaco Editor, Chart.js, Web Speech API |

### File Structure Summary

```
LYNQ/
├── server.js (979 lines) - Backend API & AI routing
├── config/
│   ├── models.json - AI model configurations
│   ├── systemprompt.txt - Base system prompt
│   ├── canvasprompt.txt - Canvas mode prompt
│   └── tool_prompts.json - Tool-specific prompts
├── public/
│   ├── js/ (12 files, ~7,100+ lines total)
│   ├── css/ (9 files)
│   └── *.html (7 pages)
└── package.json
```

---

## ✅ What the Project Does Well

### 1. **Modular Architecture**
- Clean separation of concerns with dedicated files for each feature
- `chat.js`, `canvas.js`, `pdf.js`, `voice.js`, `data-analysis.js` are well-isolated
- Shared components via `components.js` reduce HTML duplication

### 2. **Multi-Model AI Support**
- Dynamic model selection between Google AI and Groq
- Centralized model configuration in `config/models.json`
- Server-side routing handles different API formats seamlessly

### 3. **Canvas Mode (Live Code Preview)**
- Monaco Editor integration for syntax highlighting
- Real-time HTML/CSS/JS preview in iframe
- Code streaming with line-by-line animation
- Download functionality for generated code

### 4. **Data Analysis Pipeline**
- Robust parsing for CSV, JSON, Excel files
- Comprehensive statistical calculations (mean, median, mode, std dev, correlation)
- Smart data sampling for AI context (full data ≤100 rows, sample otherwise)
- Chart.js integration with auto-detection of chart types

### 5. **Authentication System**
- Firebase Auth with multiple providers (Google, GitHub, Email, Phone)
- JWT-based API authentication
- User sync with MongoDB backend
- Guest mode support (no forced login)

### 6. **Web Search Integration**
- Server-side search with caching (5-min TTL)
- Rate limiting (10/min, 100/day)
- Source authority scoring
- Content scraping with timeout handling

### 7. **Real-time Chat Features**
- Response streaming with AbortController support
- Message editing and regeneration
- Chat history with pinning and search
- Attachment support (PDF, images, data files)

### 8. **UI/UX Polish**
- Theme toggle (light/dark)
- Toast notifications
- Responsive sidebar with swipe gestures
- Code block enhancement with copy buttons

---

## ⚠️ Limitations & Solutions

### 1. **Code Organization**

| Issue                  | Details                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| Large monolithic files | `script.js` (1,798 lines), `chat.js` (1,594 lines) are too large |
| Global state pollution | Heavy reliance on global variables across files                  |
| No module bundler      | Direct script loading order dependencies                         |

#### 💡 Solutions:

**Large monolithic files:**
```
Split script.js into:
├── state.js         → Global state & localStorage
├── sidebar.js       → Sidebar open/close, swipe gestures
├── theme.js         → Theme toggle logic
├── model-selector.js → Model dropdown handling
└── chat-list.js     → Recent chats rendering

Split chat.js into:
├── message-renderer.js  → addMessage, enhanceCodeBlocks
├── stream-handler.js    → streamResponse, streamTextToBubble
├── chat-actions.js      → edit, regenerate, copy, share
└── suggestions.js       → Inline suggestions logic
```

**Global state pollution:**
```javascript
// Create a centralized store in store.js
const AppStore = {
  state: {
    currentChat: null,
    isWebSearchActive: false,
    selectedModel: 'gemini-2.0-flash',
    mainChatHistory: []
  },
  
  setState(key, value) {
    this.state[key] = value;
    document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
  },
  
  getState(key) {
    return this.state[key];
  }
};
```

**No module bundler:**
```bash
# Option 1: Vite (recommended)
npm create vite@latest . -- --template vanilla

# Option 2: esbuild (minimal config)
npm install esbuild
npx esbuild src/main.js --bundle --outfile=dist/bundle.js
```

---

### 2. **Error Handling**

| Issue                 | Details                                            |
| --------------------- | -------------------------------------------------- |
| Inconsistent error UX | Some errors show toast, others log to console only |
| No retry mechanism    | Failed API calls don't offer retry options         |
| Silent failures       | Some async operations fail silently                |

#### 💡 Solutions:

**Unified error handler:**
```javascript
// Create error-handler.js
function handleError(error, options = {}) {
  const { silent = false, userMessage = "Something went wrong." } = options;
  
  console.error('[LYNQ Error]:', error);
  
  if (!silent && typeof showToast === 'function') {
    showToast(userMessage);
  }
}

// Usage:
try {
  await someAsyncOperation();
} catch (error) {
  handleError(error, { userMessage: "Failed to load chat" });
}
```

**Retry mechanism:**
```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}
```

---

### 3. **Performance**

| Issue             | Details                                               |
| ----------------- | ----------------------------------------------------- |
| No code splitting | All JS loads on every page                            |
| No lazy loading   | Monaco Editor loads immediately whether needed or not |
| Memory leaks      | Chart instances created but not always destroyed      |

#### 💡 Solutions:

**Code splitting:**
```html
<!-- Only load what's needed per page -->
<!-- index.html -->
<script src="js/chat.js" defer></script>
<script src="js/canvas.js" defer></script>

<!-- settings.html - don't include chat.js -->
```

**Lazy load Monaco:**
```javascript
let monacoPromise = null;

async function loadMonacoLazily() {
  if (monacoPromise) return monacoPromise;
  
  monacoPromise = new Promise((resolve) => {
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor/min/vs' }});
    require(['vs/editor/editor.main'], resolve);
  });
  
  return monacoPromise;
}

// Only load when canvas mode is activated
async function toggleCanvasMode() {
  if (!monacoLoaded) {
    showToast("Loading code editor...");
    await loadMonacoLazily();
    initMonacoEditor();
  }
}
```

**Fix memory leaks:**
```javascript
function removeMessage(msgElement) {
  // Destroy charts before removing
  const charts = msgElement.querySelectorAll('.chart-container');
  charts.forEach(c => {
    if (chartInstances.has(c.id)) {
      chartInstances.get(c.id).destroy();
      chartInstances.delete(c.id);
    }
  });
  msgElement.remove();
}

window.addEventListener('beforeunload', destroyAllCharts);
```

---

### 4. **Security Concerns**

| Issue                   | Details                                      |
| ----------------------- | -------------------------------------------- |
| Firebase config exposed | API keys visible in client-side `auth.js`    |
| No input sanitization   | User input rendered with innerHTML in places |
| No CSP headers          | Missing Content-Security-Policy              |

#### 💡 Solutions:

**Firebase config:**
```
Note: Firebase API keys are designed to be public.
Secure via Firebase Console:
1. Authentication → Settings → Authorized domains (whitelist only your domain)
2. Add Firestore security rules:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

**Input sanitization:**
```javascript
// Option 1: Use textContent (safe)
element.textContent = userInput;

// Option 2: DOMPurify for HTML
import DOMPurify from 'dompurify';
bubble.innerHTML = DOMPurify.sanitize(marked.parse(response));

// Option 3: Escape HTML manually
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, c => 
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
```

**CSP headers:**
```javascript
// server.js - add helmet
import helmet from 'helmet';
app.use(helmet());

// Or manually:
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net;"
  );
  next();
});
```

---

### 5. **Missing Features**

| Feature         | Status                                    |
| --------------- | ----------------------------------------- |
| Chat PDF Export | Not implemented (only JSON export exists) |
| Offline support | No service worker or caching              |
| Accessibility   | Limited ARIA labels, keyboard navigation  |
| Testing         | No test files found                       |
| TypeScript      | All vanilla JS, no type safety            |

#### 💡 Solutions:

**Chat PDF Export:**
```javascript
// Client-side with html2pdf.js
import html2pdf from 'html2pdf.js';

function exportChatAsPDF() {
  const chat = document.getElementById('chat-display');
  html2pdf().from(chat).set({
    margin: 10,
    filename: `chat-${Date.now()}.pdf`,
    jsPDF: { format: 'a4' }
  }).save();
}

// Or server-side with puppeteer (better quality)
import puppeteer from 'puppeteer';

app.post('/api/export-pdf', async (req, res) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(req.body.html);
  const pdf = await page.pdf({ format: 'A4' });
  res.contentType('application/pdf').send(pdf);
});
```

**Offline support:**
```javascript
// public/sw.js
const CACHE = 'lynq-v1';
const ASSETS = ['/', '/index.html', '/css/index.css', '/js/script.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// Register in HTML
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

**Accessibility:**
```html
<!-- Add ARIA labels -->
<button id="send-btn" aria-label="Send message">
<div id="chat-display" role="log" aria-live="polite">

<!-- Keyboard shortcuts -->
<script>
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') sendBtn.click();
  if (e.key === 'Escape') closeAllModals();
});
</script>
```

**Testing:**
```bash
npm install --save-dev vitest

# tests/data-analysis.test.js
import { parseCSV } from '../public/js/data-analysis.js';

test('parses CSV', () => {
  const result = parseCSV('a,b\n1,2');
  expect(result.headers).toEqual(['a', 'b']);
});
```

**TypeScript (gradual):**
```bash
npm install --save-dev typescript

# Start with JSDoc (no file changes)
/** @param {string} text @returns {{ headers: string[] }} */
function parseCSV(text) { ... }

# Then gradually rename .js → .ts
```

---

### 6. **Documentation**

| Issue                  | Details                            |
| ---------------------- | ---------------------------------- |
| No API documentation   | Backend endpoints undocumented     |
| Sparse inline comments | Most functions lack JSDoc          |
| No README              | Project setup instructions missing |

#### 💡 Solutions:

**API Documentation (Swagger):**
```javascript
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const spec = swaggerJsdoc({
  definition: { openapi: '3.0.0', info: { title: 'LYNQ API', version: '1.0.0' }},
  apis: ['./server.js']
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));

// Add to endpoints:
/**
 * @swagger
 * /api/generate:
 *   post:
 *     summary: Generate AI response
 */
```

**JSDoc comments:**
```javascript
/**
 * Streams response text to chat bubble with animation
 * @param {string} fullText - Complete AI response
 * @returns {Promise<void>}
 */
async function streamResponse(fullText) { ... }
```

**README.md:**
```markdown
# LYNQ AI

## Quick Start
npm install
cp .env.example .env  # Add your API keys
npm run dev

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/generate | AI response |
| GET | /api/chats | List chats |
```

---

## 📁 File-by-File Summary

### Backend

| File        | Lines | Purpose                                                               |
| ----------- | ----- | --------------------------------------------------------------------- |
| `server.js` | 979   | Express server, API endpoints, AI routing, web search, MongoDB models |

### Frontend JavaScript

| File                 | Lines | Purpose                                                  |
| -------------------- | ----- | -------------------------------------------------------- |
| `script.js`          | 1,798 | Global state, sidebar, theme, chat list, model selection |
| `chat.js`            | 1,594 | Message handling, streaming, code blocks, suggestions    |
| `canvas.js`          | 493   | Monaco Editor, code preview, canvas mode toggle          |
| `data-analysis.js`   | 443   | CSV/JSON/Excel parsing, statistics, AI summary           |
| `components.js`      | 395   | Shared UI injection (sidebar, topbar, modals)            |
| `pdf.js`             | 310   | File upload handling, PDF text extraction                |
| `chart-generator.js` | 262   | Chart.js wrapper, auto chart detection                   |
| `tools.js`           | 203   | Tool definitions, activation, filtering                  |
| `auth.js`            | 249   | Firebase authentication, user sync                       |
| `api.js`             | 92    | Authenticated fetch wrapper, API methods                 |
| `voice.js`           | 67    | Web Speech API voice input                               |
| `theme-init.js`      | ~100  | Early theme loading to prevent flicker                   |

### HTML Pages

| File            | Purpose                    |
| --------------- | -------------------------- |
| `index.html`    | Main chat interface        |
| `login.html`    | Authentication page        |
| `tools.html`    | Tools gallery              |
| `settings.html` | User settings, data export |
| `profile.html`  | User profile management    |
| `help.html`     | Help documentation         |
| `projects.html` | Projects (placeholder)     |

---

## 📈 Metrics

| Metric               | Value                            |
| -------------------- | -------------------------------- |
| Total JS Lines       | ~7,100+                          |
| Total HTML Pages     | 7                                |
| AI Providers         | 2 (Google AI, Groq)              |
| Auth Providers       | 4 (Google, GitHub, Email, Phone) |
| Tools Available      | 10+                              |
| Supported File Types | PDF, CSV, JSON, Excel, Images    |

---

*This analysis is based on code review as of December 2025.*
