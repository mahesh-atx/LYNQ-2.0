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

  // Helper function to parse color from gradient or rgba string
  function parseAccentColor(colorString) {
    // Check if it's a gradient (linear-gradient)
    if (colorString.includes("linear-gradient")) {
      // Extract the first color from gradient
      const match = colorString.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
      if (match) return match[0];
    }
    // Check if it's a hex color
    if (colorString.startsWith("#")) return colorString;
    return null;
  }

  // Helper function to hex to RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      // Try 3-digit hex
      const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
      if (shortResult) {
        return {
          r: parseInt(shortResult[1] + shortResult[1], 16),
          g: parseInt(shortResult[2] + shortResult[2], 16),
          b: parseInt(shortResult[3] + shortResult[3], 16),
        };
      }
      return null;
    }
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  // Update spotlight colors based on accent color
  function updateSpotlightColors(accentColor) {
    const hex = parseAccentColor(accentColor);
    if (!hex) return;

    const rgb = hexToRgb(hex);
    if (!rgb) return;

    const root = document.documentElement;

    // Set spotlight main colors (based on accent with varying opacity)
    root.style.setProperty(
      "--spotlight-color-1",
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`
    );
    root.style.setProperty(
      "--spotlight-color-2",
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`
    );
    root.style.setProperty(
      "--spotlight-color-3",
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`
    );
    root.style.setProperty(
      "--spotlight-color-4",
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`
    );

    // Set spotlight accent colors (tinted white towards the accent)
    root.style.setProperty("--spotlight-accent-1", `rgba(255, 255, 255, 1)`);
    root.style.setProperty(
      "--spotlight-accent-2",
      `rgba(${Math.min(255, rgb.r + 100)}, ${Math.min(
        255,
        rgb.g + 100
      )}, ${Math.min(255, rgb.b + 100)}, 0.7)`
    );
    root.style.setProperty(
      "--spotlight-accent-3",
      `rgba(${Math.min(255, rgb.r + 50)}, ${Math.min(
        255,
        rgb.g + 50
      )}, ${Math.min(255, rgb.b + 50)}, 0.3)`
    );
  }

  // Apply saved accent color
  const savedAccent = localStorage.getItem("lynq-accent-color");
  if (savedAccent) {
    document.documentElement.style.setProperty("--bg-gold", savedAccent);
    // Also update spotlight colors
    updateSpotlightColors(savedAccent);
  }

  // Expose function globally for dynamic updates
  window.updateSpotlightColors = updateSpotlightColors;
})();
