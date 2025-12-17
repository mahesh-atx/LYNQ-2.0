/*
  theme.js
  Theme management extracted from script.js
  Handles dark/light mode toggle and accent colors
*/

// ============================================
// THEME TOGGLE
// ============================================

function toggleTheme() {
  const body = document.body;
  if (!body) return;

  body.classList.toggle("dark-mode");
  document.documentElement.classList.toggle("dark-mode");

  if (body.classList.contains("dark-mode")) {
    localStorage.setItem("lynq-theme", "dark");
  } else {
    localStorage.setItem("lynq-theme", "light");
  }

  // Sync settings page toggle if it exists
  const settingsToggle = document.getElementById("settings-theme-toggle");
  if (settingsToggle) {
    settingsToggle.checked = body.classList.contains("dark-mode");
  }
}

// ============================================
// THEME LOADING
// ============================================

function loadTheme() {
  const savedTheme = localStorage.getItem("lynq-theme");
  const settingsToggle = document.getElementById("settings-theme-toggle");

  if (savedTheme === "light") {
    document.body.classList.remove("dark-mode");
    document.documentElement.classList.remove("dark-mode");
    if (settingsToggle) settingsToggle.checked = false;
  } else {
    document.body.classList.add("dark-mode");
    document.documentElement.classList.add("dark-mode");
    localStorage.setItem("lynq-theme", "dark");
    if (settingsToggle) settingsToggle.checked = true;
  }
}

// ============================================
// ACCENT COLOR
// ============================================

function loadAccentColor() {
  const savedAccent = localStorage.getItem("lynq-accent-color");
  if (savedAccent) {
    // Apply to the global CSS variable
    document.documentElement.style.setProperty("--bg-gold", savedAccent);

    // Update spotlight colors to match accent
    if (typeof window.updateSpotlightColors === "function") {
      window.updateSpotlightColors(savedAccent);
    }

    // Update the Logo icon if it exists
    setTimeout(() => {
      const logoIcon = document.querySelector(".top-logo-title i.fa-bolt");
      if (logoIcon) logoIcon.style.color = savedAccent;
    }, 50);
  }
}

function setAccentColor(color) {
  localStorage.setItem("lynq-accent-color", color);
  document.documentElement.style.setProperty("--bg-gold", color);
  
  if (typeof window.updateSpotlightColors === "function") {
    window.updateSpotlightColors(color);
  }

  const logoIcon = document.querySelector(".top-logo-title i.fa-bolt");
  if (logoIcon) logoIcon.style.color = color;
}

// ============================================
// INITIALIZATION
// ============================================

function initTheme() {
  loadTheme();
  loadAccentColor();
}

// Auto-init when DOM is ready (but after theme-init.js runs)
document.addEventListener("DOMContentLoaded", initTheme);
