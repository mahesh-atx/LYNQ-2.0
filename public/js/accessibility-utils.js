/*
  Accessibility Utilities
  Handles focus trapping for modals and other A11y features
*/

const AccessibilityUtils = {
  /**
   * Traps focus within a given element
   * @param {HTMLElement} element - The element to trap focus inside
   */
  trapFocus(element) {
    const focusableEls = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableEls.length === 0) return;
    
    const firstFocusableEl = focusableEls[0];
    const lastFocusableEl = focusableEls[focusableEls.length - 1];
    
    // Focus the first element initially
    firstFocusableEl.focus();
    
    element.addEventListener('keydown', function(e) {
      const isTabPressed = e.key === 'Tab' || e.keyCode === 9;
      
      if (!isTabPressed) return;
      
      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstFocusableEl) {
          lastFocusableEl.focus();
          e.preventDefault();
        }
      } else { // Tab
        if (document.activeElement === lastFocusableEl) {
          firstFocusableEl.focus();
          e.preventDefault();
        }
      }
    });
  },

  /**
   * Announces a message to screen readers
   * @param {string} message - The message to announce
   */
  announce(message) {
    let announcer = document.getElementById('a11y-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'a11y-announcer';
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.position = 'absolute';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.padding = '0';
      announcer.style.margin = '-1px';
      announcer.style.overflow = 'hidden';
      announcer.style.clip = 'rect(0, 0, 0, 0)';
      announcer.style.whiteSpace = 'nowrap';
      announcer.style.borderWidth = '0';
      document.body.appendChild(announcer);
    }
    announcer.textContent = message;
  }
};

// Export to window
window.AccessibilityUtils = AccessibilityUtils;

// Automatically hook into modal openings if possible
// Note: This requires the modal scripts to call AccessibilityUtils.trapFocus()
