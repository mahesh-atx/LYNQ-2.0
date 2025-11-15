/*
  plugins.js
  This file contains logic ONLY for the Plugins page (plugins.html).
  
  NOTE: This script assumes 'script.js' is loaded BEFORE it,
  as it relies on 'installedPlugins', 'saveState()', and 'showToast()'.
  
  Your plugins.html file should also be updated.
  Each plugin button needs two things:
  1. A 'data-plugin-id' attribute (e.g., data-plugin-id="web-browser")
  2. An updated onclick call: onclick="togglePlugin(this, 'web-browser')"
*/
console.log("Plugins script loaded.");

/**
 * Toggles the installed state of a plugin.
 * @param {HTMLElement} btn - The button element that was clicked.
 * @param {string} pluginId - The unique ID for the plugin.
 */
function togglePlugin(btn, pluginId) {
  // installedPlugins, saveState, and showToast are global vars/funcs from script.js
  const index = installedPlugins.indexOf(pluginId);

  if (index > -1) {
    // --- Plugin is installed, so UNINSTALL it ---
    installedPlugins.splice(index, 1); // Remove from array
    btn.classList.remove("installed");
    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Install';
    showToast("Plugin uninstalled");
  } else {
    // --- Plugin is NOT installed, so INSTALL it ---
    installedPlugins.push(pluginId); // Add to array
    btn.classList.add("installed");
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Installed';
    showToast("Plugin installed successfully");
  }

  saveState(); // Save the new 'installedPlugins' array to localStorage
}

/**
 * Initializes the plugin buttons on page load based on saved state.
 */
function initializePluginButtons() {
  // Find all plugin buttons on the page
  const pluginButtons = document.querySelectorAll(".plugin-btn");

  pluginButtons.forEach((btn) => {
    const pluginId = btn.dataset.pluginId; // Get ID from data attribute
    if (!pluginId) {
      console.warn("Plugin button found missing 'data-plugin-id'", btn);
      return;
    }

    // Check if this plugin's ID is in our saved array
    if (installedPlugins.includes(pluginId)) {
      // YES: Mark as installed
      btn.classList.add("installed");
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Installed';
    } else {
      // NO: Mark as not installed
      btn.classList.remove("installed");
      btn.innerHTML = '<i class="fa-solid fa-plus"></i> Install';
    }
  });
}

// Run the initialization function once the DOM is loaded
// This ensures 'loadState()' from script.js has already run.
document.addEventListener("DOMContentLoaded", () => {
  // A small delay ensures script.js's DOMContentLoaded has fired
  // and 'installedPlugins' is populated.
  setTimeout(initializePluginButtons, 100);
});
