/*
  sidebar.js
  Sidebar functionality extracted from script.js
  Handles sidebar open/close, swipe gestures, and profile menu
*/

// --- DOM References (assigned in init) ---
let sidebar = null;
let mobileOverlay = null;

// --- Swipe Detection State ---
let touchStartX = 0;
let touchEndX = 0;
const SWIPE_THRESHOLD = 50;

// ============================================
// SIDEBAR TOGGLE FUNCTIONS
// ============================================

function saveSidebarState(isCollapsed) {
  localStorage.setItem("lynq-sidebar-collapsed", isCollapsed ? "true" : "false");
}

function toggleSidebar() {
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    // Mobile mode
    const isActive = sidebar.classList.toggle("active");
    if (mobileOverlay) {
      mobileOverlay.classList.toggle("active", isActive);
    }
  } else {
    // Desktop mode
    const isCollapsed = sidebar.classList.toggle("collapsed");
    saveSidebarState(isCollapsed);
  }
}

function closeSidebar() {
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    // Mobile mode
    sidebar.classList.remove("active");
    if (mobileOverlay) {
      mobileOverlay.classList.remove("active");
    }
  } else {
    // Desktop mode
    sidebar.classList.add("collapsed");
    saveSidebarState(true);
  }
}

// ============================================
// SWIPE GESTURE HANDLERS
// ============================================

function handleTouchStart(event) {
  touchStartX = event.touches[0].clientX;
  touchEndX = 0;
}

function handleTouchMove(event) {
  touchEndX = event.touches[0].clientX;
}

function handleTouchEnd(event) {
  if (window.innerWidth > 768 || !sidebar || touchEndX === 0) return;

  const isSidebarOpen = sidebar.classList.contains("active");
  const diffX = touchEndX - touchStartX;
  const OPEN_TRIGGER_AREA = 300;

  if (Math.abs(diffX) > SWIPE_THRESHOLD) {
    if (diffX > 0 && touchStartX < OPEN_TRIGGER_AREA && !isSidebarOpen) {
      toggleSidebar();
      event.preventDefault();
    } else if (diffX < 0 && isSidebarOpen) {
      if (touchStartX < window.innerWidth * 0.8) {
        closeSidebar();
      }
    }
  }
  touchStartX = 0;
  touchEndX = 0;
}

// ============================================
// SIDEBAR PROFILE MENU
// ============================================

function toggleSidebarProfileMenu() {
  const menu = document.getElementById("sidebar-profile-menu");
  if (menu) {
    const isVisible = menu.style.display === "flex";
    menu.style.display = isVisible ? "none" : "flex";
  }
}

function closeSidebarProfileMenu() {
  const menu = document.getElementById("sidebar-profile-menu");
  if (menu) {
    menu.style.display = "none";
  }
}

function updateSidebarUserInfo(user, retryCount = 0) {
  const avatar = document.getElementById("sidebar-user-avatar");
  const name = document.getElementById("sidebar-user-name");
  const plan = document.getElementById("sidebar-user-plan");

  // If elements aren't found, retry a few times (waiting for injection)
  if ((!avatar || !name) && retryCount < 5) {
    console.log(`Sidebar elements not found, retrying sync (${retryCount + 1}/5)...`);
    setTimeout(() => updateSidebarUserInfo(user, retryCount + 1), 500);
    return;
  }

  if (user) {
    const displayName = user.displayName || user.email?.split("@")[0] || "User";
    const initial = displayName.charAt(0).toUpperCase();

    if (avatar) avatar.textContent = initial;
    if (name) name.textContent = displayName;
    if (plan) plan.textContent = "Free";
  } else {
    if (avatar) avatar.textContent = "U";
    if (name) name.textContent = "User";
    if (plan) plan.textContent = "Free";
  }
}

// ============================================
// INITIALIZATION
// ============================================

function initSidebar() {
  sidebar = document.getElementById("sidebar");
  mobileOverlay = document.getElementById("mobile-overlay");

  // Swipe gesture listeners
  document.addEventListener("touchstart", handleTouchStart, { passive: true });
  document.addEventListener("touchmove", handleTouchMove, { passive: false });
  document.addEventListener("touchend", handleTouchEnd, { passive: true });

  // Mobile overlay click to close
  if (mobileOverlay) {
    mobileOverlay.addEventListener("click", closeSidebar);
  }

  // Initial state - force collapsed on desktop
  if (sidebar && window.innerWidth > 768) {
    sidebar.classList.add("collapsed");
  }
}

// Auto-init when DOM is ready
document.addEventListener("DOMContentLoaded", initSidebar);
