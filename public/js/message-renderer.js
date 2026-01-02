/*
  message-renderer.js
  Message rendering functionality extracted from chat.js
  Handles adding messages, enhancing code blocks, and rendering charts
*/

// ============================================
// CHART INSTANCE TRACKING (Memory Leak Prevention)
// ============================================
// Global Map to track all Chart.js instances
const chartInstances = new Map();

// ============================================
// INLINE CITATIONS PROCESSING
// ============================================

/**
 * Processes inline citation markers and converts them to clickable badges
 * Format: [[cite:1]]  (Reference ID)
 * Output: <a class="inline-citation" href="URL" target="_blank">[Source Name]</a>
 */
function processInlineCitations(html) {
  // Regex to match [[cite:ID]]
  // Also handles potentially auto-linked IDs if that ever happens, though unlikely with digits
  const citationRegex = /\[\[cite:(\d+)\]\]/g;
  
  // Replace all citation markers with styled badges
  return html.replace(citationRegex, (match, id) => {
    const sourceIndex = parseInt(id) - 1;
    
    // Look up the real source data from the global array
    if (window.lastResponseSources && window.lastResponseSources[sourceIndex]) {
        const source = window.lastResponseSources[sourceIndex];
        // Use a short name for the badge (e.g. "Apple", "Wiki")
        let shortName = source.title.split(/[-|–:]/)[0].trim();
        if (shortName.length > 15) shortName = new URL(source.url).hostname.replace('www.', '').split('.')[0];
        
        // Get favicon URL from Google's service
        const domain = new URL(source.url).hostname;
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        
        // Create the safe, verified inline citation badge with favicon
        return `<a class="inline-citation" href="${source.url}" target="_blank" rel="noopener noreferrer" title="Source: ${source.title}"><img src="${faviconUrl}" class="citation-favicon" alt="" onerror="this.style.display='none'">${shortName}</a>`;
    }
    
    // FALLBACK: Source ID doesn't exist - show generic badge or hide
    // Option 1: Hide completely (return empty string)
    // Option 2: Show generic badge
    console.warn(`⚠️ Citation [${id}] not found in sources array`);
    return `<span class="inline-citation inline-citation-missing" title="Source ${id} not found">Source ${id}</span>`;
  });
}

/**
 * Applies inline citation processing to a bubble element
 */
function renderInlineCitations(bubble) {
  if (!bubble) return;
  
  // Get current HTML and process citations
  const originalHtml = bubble.innerHTML;
  const processedHtml = processInlineCitations(originalHtml);
  
  // Only update if there were changes
  if (processedHtml !== originalHtml) {
    bubble.innerHTML = processedHtml;
    const citationCount = (processedHtml.match(/inline-citation/g) || []).length;
    console.log(`📎 Processed ${citationCount} inline citations`);
    
    // Attach hover listeners for the cards
    attachCitationHoverListeners(bubble);
  }
}

// --- HOVER CARD IMPLEMENTATION ---
let hoverCardElement = null;
let sourcesCache = new Map(); // Cache to store sources globally
let citationDelegationSetup = false; // Prevent multiple setups

function getOrCreateHoverCard() {
  if (hoverCardElement) return hoverCardElement;
  
  hoverCardElement = document.createElement('div');
  hoverCardElement.className = 'citation-hover-card';
  document.body.appendChild(hoverCardElement);
  return hoverCardElement;
}

// MEMORY LEAK FIX: Use event delegation instead of per-element listeners
function setupCitationEventDelegation() {
  if (citationDelegationSetup) return; // Only setup once
  citationDelegationSetup = true;
  
  const card = getOrCreateHoverCard();
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Delegated event handler for all .inline-citation elements
  document.body.addEventListener(isTouchDevice ? 'click' : 'mouseenter', (e) => {
    const citation = e.target.closest('.inline-citation');
    if (!citation || citation.classList.contains('inline-citation-missing')) return;
    
    if (isTouchDevice && card.classList.contains('visible')) {
      // On mobile, second tap on same citation should navigate
      return; 
    }
    if (isTouchDevice) {
      e.preventDefault(); // Prevent first tap navigation
    }
    
    showHoverCard(citation, card);
  }, isTouchDevice ? false : true); // Use capture for mouseenter
  
  // Hide card on mouseleave (desktop) or touchstart elsewhere (mobile)
  if (!isTouchDevice) {
    document.body.addEventListener('mouseleave', (e) => {
      if (e.target.closest('.inline-citation')) {
        card.classList.remove('visible');
      }
    }, true);
  } else {
    document.addEventListener('touchstart', (e) => {
      if (!e.target.closest('.inline-citation') && !e.target.closest('.citation-hover-card')) {
        card.classList.remove('visible');
      }
    }, { passive: true });
  }
  
  console.log('📎 Citation event delegation setup complete');
}

function showHoverCard(citation, card) {
  const url = citation.getAttribute('href');
  const sourceName = citation.innerText;
  
  let sourceData = sourcesCache.get(url);
  if (!sourceData) {
    try {
      const urlObj = new URL(url);
      sourceData = sourcesCache.get(urlObj.hostname + urlObj.pathname);
    } catch (e) {}
  }
  if (!sourceData && window.lastResponseSources) {
    sourceData = window.lastResponseSources.find(s => s.url === url || s.url.includes(url) || url.includes(s.url));
  }

  if (sourceData) {
    const domain = new URL(sourceData.url).hostname;
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    
    card.innerHTML = `
      <div class="citation-card-header">
        <img src="${faviconUrl}" class="citation-card-favicon" alt="" onerror="this.style.display='none'">
        <span class="citation-card-source-name">${sourceName}</span>
      </div>
      <div class="citation-card-title">${sourceData.title}</div>
      <div class="citation-card-snippet">${sourceData.snippet || "No description available."}</div>
    `;
    
    const rect = citation.getBoundingClientRect();
    card.style.left = `${Math.min(rect.left, window.innerWidth - 310)}px`;
    card.style.top = `${rect.bottom + 10}px`;
    
    card.classList.add('visible');
  }
}

function attachCitationHoverListeners(bubble) {
  // Try to get sources from the message element first (per-message), then global fallback
  let messageSources = null;
  const parentWrapper = bubble.closest('.content-wrapper') || bubble.parentElement;
  if (parentWrapper && parentWrapper.dataset.sources) {
    try {
      messageSources = JSON.parse(parentWrapper.dataset.sources);
    } catch (e) {}
  }
  
  // Use message sources if available, otherwise use global
  const sourcesToUse = messageSources || window.lastResponseSources || [];
  
  // Cache sources by URL for quick lookup (this is safe to call multiple times)
  if (sourcesToUse.length > 0) {
    sourcesToUse.forEach(source => {
      sourcesCache.set(source.url, source);
      try {
        const urlObj = new URL(source.url);
        sourcesCache.set(urlObj.hostname + urlObj.pathname, source);
      } catch (e) {}
    });
  }
  
  // Setup event delegation once (prevents memory leaks)
  setupCitationEventDelegation();
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Formats language name for display in code blocks
 */
function formatLanguageName(lang) {
  const languageMap = {
    js: "JavaScript",
    javascript: "JavaScript",
    ts: "TypeScript",
    typescript: "TypeScript",
    py: "Python",
    python: "Python",
    rb: "Ruby",
    ruby: "Ruby",
    java: "Java",
    cpp: "C++",
    c: "C",
    cs: "C#",
    csharp: "C#",
    go: "Go",
    rs: "Rust",
    rust: "Rust",
    php: "PHP",
    swift: "Swift",
    kotlin: "Kotlin",
    scala: "Scala",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    sass: "SASS",
    less: "LESS",
    json: "JSON",
    xml: "XML",
    yaml: "YAML",
    yml: "YAML",
    md: "Markdown",
    markdown: "Markdown",
    sql: "SQL",
    sh: "Shell",
    bash: "Bash",
    zsh: "Zsh",
    powershell: "PowerShell",
    ps1: "PowerShell",
    dockerfile: "Dockerfile",
    docker: "Docker",
    plaintext: "Plain Text",
    text: "Text",
    txt: "Text",
    jsx: "JSX",
    tsx: "TSX",
    vue: "Vue",
    svelte: "Svelte",
    graphql: "GraphQL",
    gql: "GraphQL",
  };

  return languageMap[lang.toLowerCase()] || lang.toUpperCase();
}

// ============================================
// CODE BLOCK ENHANCEMENT
// ============================================

/**
 * Enhances code blocks with a header containing language name and copy button.
 */
function enhanceCodeBlocks(container) {
  const codeBlocks = container.querySelectorAll("pre");

  codeBlocks.forEach((pre) => {
    if (pre.parentElement.classList.contains("code-block-wrapper")) return;

    const code = pre.querySelector("code");
    if (!code) return;

    let language = "plaintext";
    const classNames = code.className.split(" ");
    for (const cls of classNames) {
      if (cls.startsWith("language-")) {
        language = cls.replace("language-", "");
        break;
      } else if (cls.startsWith("hljs-")) {
        continue;
      } else if (cls && cls !== "hljs") {
        language = cls;
        break;
      }
    }

    const displayLang = formatLanguageName(language);

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    const header = document.createElement("div");
    header.className = "code-block-header";

    const langLabel = document.createElement("span");
    langLabel.className = "code-language";
    langLabel.textContent = displayLang;

    const copyBtn = document.createElement("button");
    copyBtn.className = "code-copy-btn";
    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
    copyBtn.onclick = () => {
      const textToCopy = code.textContent;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
            copyBtn.classList.remove("copied");
          }, 2000);
        })
        .catch(() => {
          if (typeof showToast === "function") showToast("Failed to copy code");
        });
    };

    header.appendChild(langLabel);
    header.appendChild(copyBtn);

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });
}

// ============================================
// CHART RENDERING
// ============================================

/**
 * Get chart color by index
 */
function getChartColor(index, alpha = 1) {
  const colors = [
    `rgba(102, 126, 234, ${alpha})`,
    `rgba(245, 158, 11, ${alpha})`,
    `rgba(16, 185, 129, ${alpha})`,
    `rgba(236, 72, 153, ${alpha})`,
    `rgba(139, 92, 246, ${alpha})`,
    `rgba(6, 182, 212, ${alpha})`,
  ];
  return colors[index % colors.length];
}

/**
 * Renders chart blocks from AI responses
 * Detects ```chartdata blocks and replaces with Chart.js charts
 */
function renderChartBlocks(container) {
  // Find all code blocks with 'chartdata' language
  const codeBlocks = container.querySelectorAll('pre code.language-chartdata, pre code.hljs.language-chartdata');
  
  codeBlocks.forEach((codeBlock, index) => {
    try {
      const jsonStr = codeBlock.textContent.trim();
      const chartConfig = JSON.parse(jsonStr);
      
      // Create chart container
      const chartId = `chart-${Date.now()}-${index}`;
      const chartContainer = document.createElement('div');
      chartContainer.className = 'chart-container';
      chartContainer.id = chartId;
      chartContainer.style.cssText = 'height: 300px; width: 100%; margin: 16px 0; background: rgba(0,0,0,0.2); border-radius: 12px; padding: 16px;';
      
      const canvas = document.createElement('canvas');
      chartContainer.appendChild(canvas);
      
      // Replace the pre block with chart container
      const preBlock = codeBlock.closest('pre');
      const wrapper = preBlock.closest('.code-block-wrapper');
      if (wrapper) {
        wrapper.replaceWith(chartContainer);
      } else {
        preBlock.replaceWith(chartContainer);
      }
      
      // Render chart using Chart.js
      if (typeof Chart !== 'undefined') {
        const ctx = canvas.getContext('2d');
        
        // Build Chart.js config from our format
        const chartData = {
          labels: chartConfig.labels || [],
          datasets: (chartConfig.datasets || []).map((ds, i) => ({
            label: ds.label || `Dataset ${i + 1}`,
            data: ds.data || [],
            backgroundColor: ds.backgroundColor || getChartColor(i, 0.7),
            borderColor: ds.borderColor || getChartColor(i, 1),
            borderWidth: 2,
            tension: 0.3
          }))
        };
        
        const chart = new Chart(ctx, {
          type: chartConfig.type || 'bar',
          data: chartData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
                labels: { color: '#e5e7eb', font: { family: 'Inter, sans-serif' } }
              },
              title: {
                display: !!chartConfig.title,
                text: chartConfig.title || '',
                color: '#f3f4f6'
              }
            },
            scales: chartConfig.type !== 'pie' && chartConfig.type !== 'doughnut' ? {
              x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
              y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } }
            } : undefined
          }
        });
        
        // Track the chart instance for cleanup
        chartInstances.set(chartId, chart);
        
        console.log('📊 Chart rendered:', chartConfig.type);
      } else {
        chartContainer.innerHTML = '<p style="color: #ef4444; text-align: center;">Chart.js not loaded</p>';
      }
    } catch (err) {
      console.error('Chart render error:', err);
    }
  });
}

/**
 * Destroys all Chart.js instances within an element
 * Call this before removing messages to prevent memory leaks
 */
function destroyChartsInElement(element) {
  if (!element) return;
  
  const chartContainers = element.querySelectorAll('.chart-container');
  chartContainers.forEach(container => {
    const chartId = container.id;
    if (chartInstances.has(chartId)) {
      const chart = chartInstances.get(chartId);
      chart.destroy();
      chartInstances.delete(chartId);
      console.log('🗑️ Chart destroyed:', chartId);
    }
  });
}

// ============================================
// YOUTUBE EMBEDDING (DISABLED)
// ============================================
// Video embedding has been temporarily disabled.
// TODO: Re-enable with YouTube Data API validation when API key is added.

// ============================================
// SOURCES PANEL RENDERING (REMOVED)
// ============================================
// The large collapsible sources panel has been removed.
// Sources are now shown only via stacked favicons with dropdown (createSourcesStackIndicator).

// ============================================
// ADD MESSAGE FUNCTION
// ============================================

/**
 * Adds a message to the chat
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
    
    if (attachment.type === "image" && attachment.data_url) {
      // Image Attachment - Compact thumbnail style
      const img = document.createElement("img");
      img.src = attachment.data_url;
      img.className = "message-attachment-image";
      img.style.width = "80px";
      img.style.height = "80px";
      img.style.borderRadius = "8px";
      img.style.cursor = "pointer";
      img.style.objectFit = "cover";
      img.style.border = "1px solid var(--border-secondary)";
      img.onclick = () => window.open(attachment.data_url, '_blank');
      
      attachmentContainer.appendChild(img);
    } else {
      // Default / PDF Attachment
      const pill = document.createElement("div");
      pill.className = "attachment-pill";
      pill.innerHTML = `<i class="fa-solid fa-file-pdf"></i> <span>${attachment.name}</span>`;
      attachmentContainer.appendChild(pill);
    }
    contentWrapper.appendChild(attachmentContainer);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (isThinking) {
    bubble.innerHTML =
      '<div class="thinking-container">' +
        '<div class="thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>' +
        '<span class="thinking-label">Thinking...</span>' +
      '</div>';

  } else if (sender === "user") {
    bubble.innerText = text;
  } else {
    if (text) {
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
    editBtn.onclick = () => toggleEdit(contentWrapper, text, attachment);
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
    
    // Add stacked sources indicator if sources are available
    if (window.lastResponseSources && window.lastResponseSources.length > 0) {
      const sourcesIndicator = createSourcesStackIndicator(window.lastResponseSources);
      actionsDiv.appendChild(sourcesIndicator);
    }
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
    enhanceCodeBlocks(bubble);
  }

  const chatContainer = document.getElementById("chat-container");
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

  return bubble;
}

/**
 * Creates a stacked favicons indicator for sources (GLOBAL FUNCTION)
 */
function createSourcesStackIndicator(sources) {
  const container = document.createElement('div');
  container.className = 'sources-stack-container';
  
  // Stacked favicons (show max 4)
  const stackDiv = document.createElement('div');
  stackDiv.className = 'sources-stack';
  
  const uniqueDomains = [...new Set(sources.map(s => {
    try { return new URL(s.url).hostname; } catch { return null; }
  }).filter(Boolean))].slice(0, 4);
  
  uniqueDomains.forEach((domain, index) => {
    const favicon = document.createElement('img');
    favicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    favicon.className = 'stack-favicon';
    favicon.style.zIndex = 10 - index;
    favicon.style.marginLeft = index > 0 ? '-8px' : '0';
    favicon.onerror = () => favicon.style.display = 'none';
    stackDiv.appendChild(favicon);
  });
  
  // Count badge
  const countBadge = document.createElement('span');
  countBadge.className = 'sources-count-badge';
  countBadge.innerText = sources.length;
  stackDiv.appendChild(countBadge);
  
  container.appendChild(stackDiv);
  
  // Dropdown panel (hidden by default)
  const dropdown = document.createElement('div');
  dropdown.className = 'sources-dropdown';
  dropdown.innerHTML = `<div class="sources-dropdown-header">Sources (${sources.length})</div>`;
  
  sources.slice(0, 6).forEach(source => {
    const domain = new URL(source.url).hostname;
    const item = document.createElement('a');
    item.className = 'sources-dropdown-item';
    item.href = source.url;
    item.target = '_blank';
    item.innerHTML = `
      <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" class="dropdown-favicon" onerror="this.style.display='none'">
      <div class="dropdown-item-text">
        <span class="dropdown-item-title">${source.title.substring(0, 40)}${source.title.length > 40 ? '...' : ''}</span>
        <span class="dropdown-item-domain">${domain}</span>
      </div>
    `;
    dropdown.appendChild(item);
  });
  
  container.appendChild(dropdown);
  
  // Toggle dropdown on click
  stackDiv.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('visible');
  };
  
  // Close dropdown when clicking outside
  document.addEventListener('click', () => dropdown.classList.remove('visible'));
  
  return container;
}
