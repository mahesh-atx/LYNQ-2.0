/*
  theme-init.js
  Blocking theme initialization script - runs before body renders to prevent flash.
  This file should be loaded in the <body> tag immediately after it opens.
*/
(function () {
    // Apply saved theme
    const savedTheme = localStorage.getItem("lynq-theme");
    if (savedTheme === "light") {
        document.body.classList.remove("dark-mode");
    }

    // Apply saved accent color  
    const savedAccent = localStorage.getItem("lynq-accent-color");
    if (savedAccent) {
        document.documentElement.style.setProperty("--bg-gold", savedAccent);
    }
})();
