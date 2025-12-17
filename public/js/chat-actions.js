/*
  chat-actions.js
  Chat action functionality extracted from chat.js
  Handles copy, share, edit, and regenerate actions
*/

// ============================================
// COPY TO CLIPBOARD
// ============================================

/**
 * Copies text to clipboard and shows feedback
 */
function copyToClipboard(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    if (btnElement) {
      const icon = btnElement.querySelector("i");
      if (icon) {
        icon.className = "fa-solid fa-check";
        setTimeout(() => {
          icon.className = "fa-regular fa-copy";
        }, 2000);
      }
    }
    if (typeof showToast === "function") {
      showToast("Copied to clipboard!");
    }
  }).catch(() => {
    if (typeof showToast === "function") {
      showToast("Failed to copy");
    }
  });
}

// ============================================
// SHARE RESPONSE
// ============================================

/**
 * Shares response text using Web Share API or clipboard fallback
 */
function shareResponse(text) {
  if (navigator.share) {
    navigator.share({
      title: "LYNQ AI Response",
      text: text,
    }).catch(() => {
      // User cancelled or error
      copyToClipboard(text, null);
    });
  } else {
    copyToClipboard(text, null);
  }
}

// ============================================
// TOGGLE EDIT
// ============================================

/**
 * Enables editing of a user message
 */
function toggleEdit(msgWrapper, originalText, originalAttachment) {
  const bubble = msgWrapper.querySelector(".bubble");
  const actionsDiv = msgWrapper.querySelector(".message-actions");
  
  if (!bubble || !actionsDiv) return;

  // Check if already in edit mode
  if (bubble.classList.contains("editing")) {
    // Exit edit mode
    bubble.classList.remove("editing");
    bubble.innerHTML = "";
    bubble.innerText = originalText;
    
    // Restore action buttons
    actionsDiv.innerHTML = "";
    
    const editBtn = document.createElement("button");
    editBtn.className = "action-icon";
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    editBtn.title = "Edit";
    editBtn.onclick = () => toggleEdit(msgWrapper, originalText, originalAttachment);
    
    const copyBtn = document.createElement("button");
    copyBtn.className = "action-icon";
    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
    copyBtn.title = "Copy";
    copyBtn.onclick = () => copyToClipboard(originalText, copyBtn);
    
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(copyBtn);
    return;
  }

  // Enter edit mode
  bubble.classList.add("editing");
  
  const textarea = document.createElement("textarea");
  textarea.className = "edit-textarea";
  textarea.value = originalText;
  textarea.style.cssText = `
    width: 100%;
    min-height: 80px;
    padding: 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: inherit;
    resize: vertical;
  `;
  
  bubble.innerHTML = "";
  bubble.appendChild(textarea);
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  // Replace actions with save/cancel
  actionsDiv.innerHTML = "";
  
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "action-icon";
  cancelBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  cancelBtn.title = "Cancel";
  cancelBtn.onclick = () => toggleEdit(msgWrapper, originalText, originalAttachment);

  const saveBtn = document.createElement("button");
  saveBtn.className = "action-icon";
  saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
  saveBtn.title = "Save & Regenerate";
  saveBtn.onclick = () => {
    const newText = textarea.value.trim();
    if (newText && newText !== originalText) {
      regenerateResponseAfterEdit(newText, originalAttachment);
    }
    toggleEdit(msgWrapper, newText || originalText, originalAttachment);
  };

  actionsDiv.appendChild(cancelBtn);
  actionsDiv.appendChild(saveBtn);
}

// ============================================
// REGENERATE MESSAGE
// ============================================

/**
 * Regenerates an AI response
 */
function regenerateMessage(msgDiv) {
  if (!msgDiv || isResponding) return;

  // Find the user message before this AI message
  const messages = messagesWrapper.querySelectorAll(".message");
  let userMessageIndex = -1;
  let userText = "";
  let userAttachment = null;

  for (let i = 0; i < messages.length; i++) {
    if (messages[i] === msgDiv) {
      // Look backwards for user message
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].classList.contains("user")) {
          userMessageIndex = j;
          const userBubble = messages[j].querySelector(".bubble");
          userText = userBubble ? userBubble.innerText : "";
          break;
        }
      }
      break;
    }
  }

  if (userMessageIndex === -1 || !userText) {
    if (typeof showToast === "function") {
      showToast("Cannot regenerate - no user message found");
    }
    return;
  }

  // Remove the AI message
  msgDiv.remove();

  // Remove from history if exists
  if (mainChatHistory && mainChatHistory.length > 0) {
    // Find and remove the last assistant message
    for (let i = mainChatHistory.length - 1; i >= 0; i--) {
      if (mainChatHistory[i].role === "assistant") {
        mainChatHistory.splice(i, 1);
        break;
      }
    }
  }

  // Regenerate using handleSend logic
  if (typeof handleSend === "function") {
    // Set input text and trigger send
    const inputField = document.getElementById("chat-input");
    if (inputField) {
      inputField.value = userText;
      handleSend();
    }
  }
}

// ============================================
// REGENERATE AFTER EDIT
// ============================================

/**
 * Regenerates response after editing a user message
 */
async function regenerateResponseAfterEdit(newPrompt, attachment) {
  if (isResponding) return;

  // Remove all messages after the edited one
  const messages = messagesWrapper.querySelectorAll(".message");
  let foundUserMessage = false;
  
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].classList.contains("user") && 
        messages[i].querySelector(".bubble")?.innerText?.trim() === newPrompt.trim()) {
      foundUserMessage = true;
      // Remove all messages after this one
      for (let j = messages.length - 1; j > i; j--) {
        messages[j].remove();
      }
      break;
    }
  }

  // Clear history after the edited message
  if (mainChatHistory && mainChatHistory.length > 0) {
    // Find the last user message with the new prompt
    for (let i = mainChatHistory.length - 1; i >= 0; i--) {
      if (mainChatHistory[i].role === "user" && 
          mainChatHistory[i].content === newPrompt) {
        // Remove everything after
        mainChatHistory.splice(i + 1);
        break;
      }
    }
  }

  // Trigger new response
  isResponding = true;
  
  const sendBtn = document.getElementById("send-btn");
  const stopBtn = document.getElementById("stop-btn");
  
  if (sendBtn) sendBtn.style.display = "none";
  if (stopBtn) {
    stopBtn.style.display = "flex";
    stopBtn.classList.add("generating");
    const toolbarRight = stopBtn.closest(".toolbar-right");
    if (toolbarRight) toolbarRight.classList.add("generating");
  }

  showThinking();

  try {
    const systemMsg = await buildContextualSystemMessage(attachment);
    const response = await getApiResponse([
      { role: "system", content: systemMsg },
      ...mainChatHistory,
    ]);

    // Remove thinking indicator
    const thinkingMsg = messagesWrapper.querySelector(".message.thinking");
    if (thinkingMsg) thinkingMsg.remove();

    if (response) {
      mainChatHistory.push({ role: "assistant", content: response });
      await streamResponse(response);
      if (typeof saveChat === "function") saveChat();
    }
  } catch (error) {
    console.error("Regenerate error:", error);
    const thinkingMsg = messagesWrapper.querySelector(".message.thinking");
    if (thinkingMsg) thinkingMsg.remove();
    
    if (typeof showApiError === "function") {
      showApiError(error.message);
    }
  }

  isResponding = false;
}
