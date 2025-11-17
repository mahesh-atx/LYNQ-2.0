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

  if (recentChats.length === 0) {
    // global var
    showToast("Nothing to export."); // global func
    return;
  }

  // Export all recent chats into one big file
  let fullExport = "";
  // NOTE: This assumes 'recentChats' is a global array containing chat objects with history.
  // This requires the full chat history data structure to be available globally or loaded here.
  // For the simulation, we proceed with the assumption that global state is correctly loaded.

  recentChats.forEach((chat) => {
    // global var
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
  // We use a custom modal for confirmation instead of confirm()
  // For now, we clear state directly and rely on a redirect or refresh to confirm the action.

  // In a real application, you'd use a confirmation modal:
  // if (showConfirmModal("Are you sure you want to delete all chat history?")) { ... }

  // Since we cannot use confirm() and don't have the modal structure:
  // We'll proceed with the global state reset and rely on the UI displaying a Toast first.

  localStorage.removeItem("lynq_app_state");
  localStorage.removeItem("lynq_custom_instructions");
  // Assuming a full server-side deletion would happen here if using MongoDB.

  // Display a toast and reload the page
  if (typeof showToast === "function") {
    showToast("All local settings and history cleared. Reloading page...");
  }
  setTimeout(() => {
    location.reload();
  }, 1000);
}
