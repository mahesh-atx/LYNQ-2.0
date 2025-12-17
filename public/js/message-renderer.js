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
// YOUTUBE EMBEDDING
// ============================================

/**
 * Embeds YouTube videos from links in the bubble
 */
function embedYouTubeVideos(bubbleElement) {
  const youtubeLinks = bubbleElement.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]');
  
  youtubeLinks.forEach((link) => {
    const url = link.href;
    let videoId = null;
    
    if (url.includes("youtube.com/watch")) {
      const urlObj = new URL(url);
      videoId = urlObj.searchParams.get("v");
    } else if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1]?.split("?")[0];
    }
    
    if (videoId) {
      createVideoPlayer(link, videoId);
    }
  });
}

/**
 * Creates a video player element to replace the link
 */
function createVideoPlayer(linkElement, videoId) {
  const playerWrapper = document.createElement("div");
  playerWrapper.className = "video-player-wrapper";
  playerWrapper.style.cssText = "margin: 16px 0; border-radius: 12px; overflow: hidden;";
  
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube.com/embed/${videoId}`;
  iframe.style.cssText = "width: 100%; aspect-ratio: 16/9; border: none;";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  iframe.allowFullscreen = true;
  
  playerWrapper.appendChild(iframe);
  linkElement.parentNode.insertBefore(playerWrapper, linkElement.nextSibling);
}

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
      '<div class="thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
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
