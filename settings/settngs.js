/*
  settings.js
  This file contains logic ONLY for the Settings page (settings.html).
*/
console.log("Settings script loaded.");

document.addEventListener("DOMContentLoaded", () => {
  // Initialize settings state
  console.log("Settings DOMContentLoaded");
  
  // Set theme toggle state based on loaded theme
  const themeToggle = document.getElementById("settings-theme-toggle");
  if (themeToggle && document.body.classList.contains("dark-mode")) {
    themeToggle.checked = true;
  }
  
  // Add listeners for this page's buttons
  const clearBtn = document.querySelector(".btn-danger");
  if (clearBtn) clearBtn.onclick = clearAllHistory;

  const saveBtn = document.getElementById("save-instructions-btn");
  if (saveBtn) saveBtn.onclick = saveCustomInstructions;

  const exportBtn = document.getElementById("export-data-btn");
  if (exportBtn) exportBtn.onclick = exportChatHistory;

  // Load saved custom instructions
  loadCustomInstructions();
});

function saveCustomInstructions() {
  const textEl = document.getElementById("custom-instructions-textarea");
  if (textEl) {
      localStorage.setItem("lynq_custom_instructions", textEl.value);
      showToast("Instructions saved!"); // global func
  }
}

function loadCustomInstructions() {
  const text = localStorage.getItem("lynq_custom_instructions");
  const textEl = document.getElementById("custom-instructions-textarea");
  if (text && textEl) {
    textEl.value = text;
  }
}

function exportChatHistory() {
  // We need to find the *active* chat history to export
  // This is a bit tricky. Let's export *all* chats.
  
  if (recentChats.length === 0) { // global var
    showToast("Nothing to export."); // global func
    return;
  }
  
  // Export all recent chats into one big file
  let fullExport = "";
  recentChats.forEach(chat => { // global var
    fullExport += `--- CHAT: ${chat.title} (ID: ${chat.id}) ---\n\n`;
    fullExport += chat.history
        .map(
          (m) => `**${m.role === "user" ? "User" : "LYNQ AI"}:**\n\n${m.content}`
        )
        .join("\n\n---\n\n");
    fullExport += "\n\n\n";
  });


  const blob = new Blob([fullExport], { type: "text/markdown" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `LYNQ-All-Chats-${new Date().toISOString().split("T")[0]}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function clearAllHistory() {
  // Can't use confirm()
  showToast("Clear All History - TBC"); // global func
//   if (
//     confirm(
//       "Are you sure you want to delete all chat history? This cannot be undone."
//     )
//   ) {
    localStorage.removeItem("lynq_app_state");
    localStorage.removeItem("lynq_custom_instructions");
    location.reload();
//   }
}