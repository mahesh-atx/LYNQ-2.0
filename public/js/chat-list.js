/*
  chat-list.js
  Chat list management extracted from script.js
  Handles recent chats rendering, context menus, and chat actions
*/

// ============================================
// CHAT SEARCH
// ============================================

function toggleChatSearch(show) {
  const searchWrapper = document.getElementById("chat-search-wrapper");
  const searchInput = document.getElementById("chat-search-input");

  if (!searchWrapper || !searchInput) return;

  if (show) {
    searchWrapper.style.display = "flex";
    searchInput.focus();
  } else {
    searchWrapper.style.display = "none";
    searchInput.value = "";
    filterRecentChats();
  }
}

function filterRecentChats() {
  const filterInput = document.getElementById("chat-search-input");
  if (!filterInput) return;

  const filter = filterInput.value.toLowerCase();
  const chatItems = document.querySelectorAll("#recent-chats-container .chat-item-wrapper");

  chatItems.forEach((item) => {
    const title = item.querySelector(".chat-title").innerText.toLowerCase();
    if (title.includes(filter)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
}

// ============================================
// RENDER RECENT CHATS
// ============================================

function renderRecentChats() {
  const container = document.getElementById("recent-chats-container");
  if (!container) return;

  container.innerHTML = "";

  // Sort: pinned first, then by server order
  recentChats.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  recentChats.forEach((chat) => {
    const menuId = `chat-menu-${chat.id}`;

    const wrapper = document.createElement("div");
    wrapper.className = "chat-item-wrapper";
    wrapper.id = `chat-wrapper-${chat.id}`;

    const navLink = document.createElement("a");
    navLink.className = "nav-item";
    if (chat.id == activeChatId) {
      navLink.classList.add("active");
    }
    navLink.href = `#chat-${chat.id}`;

    navLink.onclick = async (e) => {
      e.preventDefault();

      activeChatId = chat.id;
      isNewChat = false;

      document
        .querySelectorAll("#recent-chats-container .nav-item")
        .forEach((item) => item.classList.remove("active"));
      navLink.classList.add("active");

      const newUrl = window.location.pathname + `?chatId=${chat.id}`;
      history.pushState({ chatId: activeChatId }, chat.title, newUrl);

      if (typeof loadChat === "function") {
        await loadChat(activeChatId);
      }

      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    };

    const icon = chat.pinned
      ? '<i class="fa-solid fa-thumbtack" style="font-size:0.8rem; opacity:0.7;"></i>'
      : '<i class="fa-regular fa-message"></i>';

    navLink.innerHTML = `
      ${icon}
      <span class="chat-title">${chat.title}</span>
    `;

    const optionsTrigger = document.createElement("i");
    optionsTrigger.className = "fa-solid fa-ellipsis chat-options-trigger";
    optionsTrigger.onclick = (event) => toggleContextMenu(event, menuId);

    const contextMenu = document.createElement("div");
    contextMenu.className = "chat-context-menu";
    contextMenu.id = menuId;
    contextMenu.innerHTML = `
      <div class="context-item" onclick="chatAction('pin', '${chat.id}')">
        <i class="fa-solid fa-thumbtack"></i> ${chat.pinned ? "Unpin" : "Pin"}
      </div>
      <div class="context-item" onclick="chatAction('rename', '${chat.id}')">
        <i class="fa-solid fa-pen"></i> Rename
      </div>
      <div class="context-item" onclick="chatAction('delete', '${chat.id}')">
        <i class="fa-solid fa-trash"></i> Delete
      </div>
    `;

    wrapper.appendChild(navLink);
    wrapper.appendChild(optionsTrigger);
    wrapper.appendChild(contextMenu);
    container.appendChild(wrapper);
  });
}

// ============================================
// CONTEXT MENU
// ============================================

function toggleContextMenu(event, menuId) {
  event.stopPropagation();
  event.preventDefault();
  document.querySelectorAll(".chat-context-menu").forEach((menu) => {
    if (menu.id !== menuId) menu.classList.remove("show");
  });
  document.getElementById(menuId)?.classList.toggle("show");
}

// ============================================
// DELETE CONFIRMATION
// ============================================

function showDeleteConfirm(chatId, chatTitle) {
  const confirmDeleteModal = document.getElementById("confirm-delete-modal");
  const confirmDeleteText = document.getElementById("confirm-delete-text");
  let confirmDeleteCancelBtn = document.getElementById("confirm-delete-cancel");
  let confirmDeleteConfirmBtn = document.getElementById("confirm-delete-confirm");

  if (!confirmDeleteModal) {
    if (confirm(`Are you sure you want to delete "${chatTitle}"?`)) {
      executeDelete(chatId);
    }
    return;
  }

  if (confirmDeleteText) {
    confirmDeleteText.innerHTML = `Are you sure you want to delete "<strong>${chatTitle}</strong>"? This action cannot be undone.`;
  }

  // Re-attach event listeners
  const newConfirmBtn = confirmDeleteConfirmBtn.cloneNode(true);
  confirmDeleteConfirmBtn.parentNode.replaceChild(newConfirmBtn, confirmDeleteConfirmBtn);
  confirmDeleteConfirmBtn = newConfirmBtn;

  confirmDeleteConfirmBtn.onclick = async () => {
    await executeDelete(chatId);
    confirmDeleteModal.classList.remove("active");
  };

  const newCancelBtn = confirmDeleteCancelBtn.cloneNode(true);
  confirmDeleteCancelBtn.parentNode.replaceChild(newCancelBtn, confirmDeleteCancelBtn);
  confirmDeleteCancelBtn = newCancelBtn;

  confirmDeleteCancelBtn.onclick = () => {
    confirmDeleteModal.classList.remove("active");
  };

  confirmDeleteModal.classList.add("active");
}

async function executeDelete(chatId) {
  if (!currentUser) return;
  const token = await getAuthToken();
  if (!token) {
    handleAuthError();
    return;
  }

  const chatIndex = recentChats.findIndex((chat) => chat.id == chatId);
  if (chatIndex === -1) return;

  try {
    const response = await fetch(`${CHAT_API_BASE}/${chatId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      handleAuthError();
      return;
    }
    if (!response.ok) {
      throw new Error("Server failed to delete chat.");
    }

    recentChats.splice(chatIndex, 1);

    if (activeChatId == chatId) {
      if (typeof resetChat === "function") {
        resetChat();
      } else {
        activeChatId = null;
        isNewChat = true;
      }
    }

    showToast("Chat deleted successfully!");
    renderRecentChats();
  } catch (error) {
    console.error("Error executing delete:", error);
    showToast(`Failed to delete chat: ${error.message}`);
  }
}

// ============================================
// CHAT ACTIONS (Pin, Rename, Delete)
// ============================================

async function chatAction(action, chatId) {
  if (!currentUser) return;
  const token = await getAuthToken();
  if (!token) {
    handleAuthError();
    return;
  }

  const chatIndex = recentChats.findIndex((chat) => chat.id == chatId);
  if (chatIndex === -1) return;

  const chat = recentChats[chatIndex];

  if (action === "delete") {
    showDeleteConfirm(chatId, chat.title);
    return;
  } else if (action === "rename") {
    const newName = prompt("Rename chat:", chat.title);
    if (newName && newName.trim() !== "") {
      chat.title = newName.trim();
    }
  } else if (action === "pin") {
    chat.pinned = !chat.pinned;
  }

  document
    .querySelectorAll(".chat-context-menu")
    .forEach((menu) => menu.classList.remove("show"));

  try {
    const chatHistoryResponse = await fetch(`${CHAT_API_BASE}/${chatId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (chatHistoryResponse.status === 401 || chatHistoryResponse.status === 403) {
      handleAuthError();
      return;
    }
    if (!chatHistoryResponse.ok) throw new Error("Could not fetch chat history for update.");
    const fullChat = await chatHistoryResponse.json();

    fullChat.title = chat.title;
    fullChat.pinned = chat.pinned;

    await saveChat(fullChat);
    showToast(`Chat ${action}d successfully.`);
  } catch (error) {
    console.error(`Error performing chat action (${action}):`, error);
    showToast(`Failed to perform chat action: ${error.message}`);
  }
}
