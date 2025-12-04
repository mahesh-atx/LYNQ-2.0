/**
 * components.js
 * Shared UI components injected dynamically to avoid HTML duplication
 */

/**
 * Injects the sidebar HTML into the page
 * @param {string} activePage - The current page ID (e.g., 'home', 'projects', 'settings', 'profile', 'help')
 */
function injectSidebar(activePage = '') {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    const isHome = activePage === 'home';
    const newChatAction = isHome ? 'onclick="resetChat();"' : 'href="index.html"';

    container.innerHTML = `
    <aside id="sidebar" class="collapsed">
      <div style="flex-shrink: 0">
        <div class="sidebar-header">
          <span style="display: flex; align-items: center; gap: 10px"><i class="fa-solid fa-bolt"></i> LYNQ AI</span>
          <button class="action-btn mobile-only" onclick="toggleSidebar()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <nav class="nav-menu">
        <div class="nav-label">Menu</div>
        <a ${newChatAction} class="nav-item" id="nav-new-chat"><i class="fa-solid fa-plus"></i> New Chat</a>
        <a href="index.html" class="nav-item ${activePage === 'home' ? 'active' : ''}" id="nav-home"><i class="fa-solid fa-house"></i> Home</a>
        <a href="projects.html" class="nav-item ${activePage === 'projects' ? 'active' : ''}" id="nav-projects"><i class="fa-solid fa-layer-group"></i> Projects</a>

        <div class="nav-label" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-right: 5px;
          position: relative;
        ">
          <span id="recent-chats-label">Recent Chats</span>
          <input type="text" id="chat-search-input" placeholder="Search chats..." style="
            display: none;
            width: 100%;
            background: var(--bg-primary);
            border: 1px solid var(--border-primary);
            border-radius: 6px;
            padding: 4px 8px;
            color: var(--text-primary);
          " onkeyup="filterRecentChats()" onblur="toggleChatSearch(false)" />
          <i class="fa-solid fa-magnifying-glass search-trigger" id="chat-search-trigger"
            onclick="toggleChatSearch(true)"></i>
        </div>
        <div id="recent-chats-container"></div>
      </nav>

      <div class="sidebar-footer">
        <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}" id="nav-profile"><i class="fa-solid fa-user"></i> Profile</a>
        <a href="settings.html" class="nav-item ${activePage === 'settings' ? 'active' : ''}" id="nav-settings"><i class="fa-solid fa-gear"></i> Settings</a>
      </div>
    </aside>
  `;
}

/**
 * Injects the top bar HTML into the page
 */
function injectTopBar() {
    const container = document.getElementById('topbar-container');
    if (!container) return;

    container.innerHTML = `
    <div class="top-bar">
      <button class="action-btn" onclick="toggleSidebar()">
        <i class="fa-solid fa-bars"></i>
      </button>
      <div class="top-logo-title">
        <i class="fa-solid fa-bolt"></i> LYNQ AI
      </div>
      <div style="flex: 1"></div>
      <div class="top-actions">
        <button class="auth-btn login-btn" onclick="location.href='login.html'" id="header-login-btn"
          style="display: none;">
          Login
        </button>

        <button class="auth-btn signup-btn" onclick="location.href='login.html?action=signup'" id="header-signup-btn"
          style="display: none;">
          Sign Up
        </button>

        <div class="header-greeting" id="header-greeting" style="display: none;">
          <span>Hi,</span>
          <span class="greeting-name" id="greeting-name">User</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Injects the pricing modal HTML into the page
 */
function injectPricingModal() {
    const container = document.getElementById('pricing-modal-container');
    if (!container) return;

    container.innerHTML = `
    <div class="modal-overlay" id="pricing-modal">
      <div class="pricing-modal">
        <button class="close-modal" onclick="togglePricing()">&times;</button>
        <div class="pricing-header">
          <h2>Upgrade Your Plan</h2>
          <p style="color: var(--text-secondary)">
            Unlock the full power of AI with Pro features.
          </p>
        </div>
        <div class="pricing-grid">
          <div class="price-card">
            <h3>Starter</h3>
            <div class="price">
              $0<span style="font-size: 1rem; font-weight: 400">/mo</span>
            </div>
            <ul class="features-list">
              <li><i class="fa-solid fa-check"></i> Gemini Flash Model</li>
              <li><i class="fa-solid fa-check"></i> Standard Speed</li>
              <li><i class="fa-solid fa-check"></i> 5 Projects Limit</li>
            </ul>
            <button class="plan-btn free">Current Plan</button>
          </div>
          <div class="price-card pro">
            <div class="popular-tag">MOST POPULAR</div>
            <h3>Pro Member</h3>
            <div class="price">
              $19<span style="font-size: 1rem; font-weight: 400">/mo</span>
            </div>
            <ul class="features-list">
              <li>
                <i class="fa-solid fa-check"></i> <b>Gemini 1.5 Pro & GPT-4o</b>
              </li>
              <li><i class="fa-solid fa-check"></i> Unlimited Fast Projects</li>
              <li><i class="fa-solid fa-check"></i> Priority Support</li>
              <li><i class="fa-solid fa-check"></i> Code Execution</li>
            </ul>
            <button class="plan-btn pro">Upgrade Now</button>
          </div>
          <div class="price-card">
            <h3>Team</h3>
            <div class="price">
              $49<span style="font-size: 1rem; font-weight: 400">/mo</span>
            </div>
            <ul class="features-list">
              <li><i class="fa-solid fa-check"></i> Everything in Pro</li>
              <li><i class="fa-solid fa-check"></i> Admin Dashboard</li>
              <li><i class="fa-solid fa-check"></i> Shared Workspace</li>
              <li><i class="fa-solid fa-check"></i> SSO Integration</li>
            </ul>
            <button class="plan-btn free">Contact Sales</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Injects the toast notification HTML into the page
 */
function injectToast() {
    const container = document.getElementById('toast-container');
    if (!container) return;

    container.innerHTML = `
    <div id="toast">
      <i class="fa-solid fa-circle-check"></i> <span id="toast-message">Action successful</span>
    </div>
  `;
}

/**
 * Injects the profile popup HTML into the page
 */
function injectProfilePopup() {
    const container = document.getElementById('profile-popup-container');
    if (!container) return;

    container.innerHTML = `
    <div class="profile-popup-overlay" id="profile-popup">
      <div class="profile-popup">
        <button class="profile-popup-close" onclick="toggleProfilePopup()">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="profile-popup-avatar" id="popup-avatar">U</div>
        <h2 class="profile-popup-name" id="popup-name">User</h2>
        <p class="profile-popup-email" id="popup-email">user@example.com</p>
        <p class="profile-popup-phone" id="popup-phone">No phone linked</p>
        <div class="profile-popup-badge">
          <i class="fa-solid fa-crown"></i> PRO MEMBER
        </div>
        <button class="profile-popup-logout" onclick="logoutUser()">
          <i class="fa-solid fa-right-from-bracket"></i> Logout
        </button>
      </div>
    </div>
  `;
}

/**
 * Initializes all shared components on the page
 * @param {string} activePage - The current page ID
 */
function initSharedComponents(activePage = '') {
    injectSidebar(activePage);
    injectTopBar();
    injectPricingModal();
    injectToast();
    injectProfilePopup();
}
