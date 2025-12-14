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
      <!-- Header: Logo + Toggle -->
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <i class="fa-solid fa-bolt"></i>
        </div>
        <!-- Only Sidebar Close Button -->
        <button class="sidebar-close-btn" onclick="toggleSidebar()" title="Close Sidebar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Navigation Menu -->
      <nav class="nav-menu">
        <!-- Fixed Navigation Items -->
        <div class="nav-fixed-group">
          <!-- New Chat -->
          <a ${newChatAction} class="nav-item nav-item-primary" id="nav-new-chat">
            <i class="fa-solid fa-pen-to-square"></i> New chat
          </a>
          
          <!-- Search Chats -->
          <button class="nav-item" id="nav-search-chats" onclick="toggleChatSearch(true)">
            <i class="fa-solid fa-magnifying-glass"></i> Search chats
          </button>
          
          <!-- Library (Tools) -->
          <a href="tools.html" class="nav-item ${activePage === 'tools' ? 'active' : ''}" id="nav-tools">
            <i class="fa-solid fa-bookmark"></i> Library
          </a>
          
          <!-- Projects -->
          <a href="projects.html" class="nav-item ${activePage === 'projects' ? 'active' : ''}" id="nav-projects">
            <i class="fa-solid fa-folder"></i> Projects
          </a>

          <!-- Your Chats Section -->
          <div class="nav-label">
            <span>Your chats</span>
          </div>
          
          <!-- Hidden Search Input -->
          <div class="chat-search-wrapper" id="chat-search-wrapper" style="display: none;">
            <input type="text" id="chat-search-input" placeholder="Search chats..." 
              onkeyup="filterRecentChats()" />
            <button class="chat-search-close" onclick="toggleChatSearch(false)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        
        <!-- Scrollable Recent Chats -->
        <div id="recent-chats-container"></div>
      </nav>

      <!-- Footer: User Profile Section -->
      <div class="sidebar-footer-profile">
        <button class="sidebar-user-btn" id="sidebar-user-btn" onclick="toggleSidebarProfileMenu()">
          <div class="sidebar-user-avatar" id="sidebar-user-avatar">U</div>
          <div class="sidebar-user-info">
            <span class="sidebar-user-name" id="sidebar-user-name">User</span>
            <span class="sidebar-user-plan" id="sidebar-user-plan">Free</span>
          </div>
        </button>
        <button class="sidebar-upgrade-btn" onclick="togglePricing()">
          Upgrade
        </button>
      </div>
      
      <!-- User Profile Popup Menu (ChatGPT Style) -->
      <div class="sidebar-profile-menu" id="sidebar-profile-menu" style="display: none;">
        <a href="profile.html" class="profile-menu-item">
          <i class="fa-solid fa-user-pen"></i> Edit profile
        </a>
        <button class="profile-menu-item" onclick="togglePricing(); closeSidebarProfileMenu();">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Upgrade plan
        </button>
        <a href="settings.html" class="profile-menu-item">
          <i class="fa-solid fa-sliders"></i> Personalization
        </a>
        <a href="settings.html" class="profile-menu-item">
          <i class="fa-solid fa-gear"></i> Settings
        </a>
        <a href="help.html" class="profile-menu-item profile-menu-item-with-arrow">
          <i class="fa-solid fa-circle-question"></i> Help
          <i class="fa-solid fa-chevron-right menu-arrow"></i>
        </a>
        <div class="profile-menu-divider"></div>
        <button class="profile-menu-item profile-menu-item-logout" onclick="logoutUser()">
          <i class="fa-solid fa-arrow-right-from-bracket"></i> Log out
        </button>
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
      <div class="top-bar-left">
        <!-- Bolt Logo Sidebar Toggle -->
        <div class="top-logo-container" onclick="toggleSidebar()" title="Toggle Sidebar">
          <i class="fa-solid fa-bolt top-logo-bolt"></i>
          <i class="fa-solid fa-sidebar top-logo-sidebar-icon"></i>
        </div>
        
        <!-- LYNQ Tier Selector (Restored) -->
        <div class="header-model-selector">
          <div class="model-selector-group">
            <button class="header-model-btn" id="header-model-btn" onclick="toggleHeaderModelDropdown()">
              <span class="header-model-name" id="header-model-name">LYNQ</span>
              <i class="fa-solid fa-chevron-down header-model-chevron"></i>
            </button>
            
            <div class="header-model-dropdown" id="header-model-dropdown" style="display: none;">
              <div class="model-dropdown-item" onclick="selectHeaderTier(this, 'LYNQ Pro', 'Upgrade for advanced reasoning')">
                <div class="model-dropdown-icon">
                  <i class="fa-solid fa-bolt-lightning"></i>
                </div>
                <div class="model-dropdown-info">
                  <span class="model-dropdown-title">LYNQ Pro</span>
                  <span class="model-dropdown-desc">Our smartest model & more</span>
                </div>
                <button class="model-upgrade-badge" onclick="event.stopPropagation(); togglePricing();">Upgrade</button>
              </div>
              
              <div class="model-dropdown-item selected" onclick="selectHeaderTier(this, 'LYNQ', 'Great for everyday tasks')">
                <div class="model-dropdown-icon">
                  <i class="fa-solid fa-message"></i>
                </div>
                <div class="model-dropdown-info">
                  <span class="model-dropdown-title">LYNQ</span>
                  <span class="model-dropdown-desc">Great for everyday tasks</span>
                </div>
                <i class="fa-solid fa-check model-check-icon"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div style="flex: 1"></div>
      
      <div class="top-actions">
        <!-- New Chat Button -->
        <button class="new-chat-btn" onclick="resetChat()" title="New Chat">
          <i class="fa-solid fa-pen-to-square"></i>
          <span>New Chat</span>
        </button>

        <button class="auth-btn login-btn" onclick="location.href='login.html'" id="header-login-btn"
          style="display: none;">
          Login
        </button>

        <button class="auth-btn signup-btn" onclick="location.href='login.html?action=signup'" id="header-signup-btn"
          style="display: none;">
          Sign Up
        </button>

        <div class="header-profile-container" id="header-profile-container" style="display: none;">
          <button class="header-profile-avatar" id="header-profile-avatar" onclick="toggleHeaderProfileMenu()" title="Profile">
            <img id="header-avatar-img" src="" alt="Profile" style="display: none;">
            <span id="header-avatar-initial">U</span>
          </button>
          
          <!-- Profile Dropdown Menu -->
          <div class="header-profile-dropdown" id="header-profile-dropdown">
            <div class="profile-dropdown-header">
              <div class="profile-dropdown-avatar" id="dropdown-avatar">
                <img id="dropdown-avatar-img" src="" alt="Profile" style="display: none;">
                <span id="dropdown-avatar-initial">U</span>
              </div>
              <div class="profile-dropdown-info">
                <span class="profile-dropdown-name" id="dropdown-name">User</span>
                <span class="profile-dropdown-email" id="dropdown-email">user@email.com</span>
              </div>
            </div>
            
            <div class="profile-dropdown-divider"></div>
            
            <button class="profile-dropdown-item" onclick="openAvatarPicker()">
              <i class="fa-solid fa-palette"></i> Change Avatar
            </button>
            <a href="profile.html" class="profile-dropdown-item">
              <i class="fa-solid fa-user-pen"></i> Edit Profile
            </a>
            <a href="settings.html" class="profile-dropdown-item">
              <i class="fa-solid fa-gear"></i> Settings
            </a>
            
            <div class="profile-dropdown-divider"></div>
            
            <button class="profile-dropdown-item profile-logout" onclick="logoutUser()">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Avatar Picker Modal -->
    <div class="avatar-picker-modal" id="avatar-picker-modal">
      <div class="avatar-picker-content">
        <div class="avatar-picker-header">
          <h3>Choose Your Avatar</h3>
          <button class="avatar-picker-close" onclick="closeAvatarPicker()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div class="avatar-picker-tabs">
          <button class="avatar-tab active" data-tab="avatars" onclick="switchAvatarTab('avatars')">
            <i class="fa-solid fa-face-smile"></i> Avatars
          </button>
          <button class="avatar-tab" data-tab="upload" onclick="switchAvatarTab('upload')">
            <i class="fa-solid fa-upload"></i> Upload
          </button>
        </div>
        
        <div class="avatar-picker-body">
          <!-- Preset Avatars -->
          <div class="avatar-grid" id="avatar-grid">
            <!-- Avatars will be populated by JS -->
          </div>
          
          <!-- Upload Section -->
          <div class="avatar-upload-section" id="avatar-upload-section" style="display: none;">
            <div class="upload-dropzone" id="avatar-dropzone" onclick="document.getElementById('avatar-file-input').click()">
              <i class="fa-solid fa-cloud-arrow-up"></i>
              <p>Click to upload or drag an image here</p>
              <span>PNG, JPG up to 2MB</span>
            </div>
            <input type="file" id="avatar-file-input" accept="image/*" style="display: none;" onchange="handleAvatarUpload(event)">
          </div>
        </div>
        
        <div class="avatar-picker-footer">
          <button class="avatar-cancel-btn" onclick="closeAvatarPicker()">Cancel</button>
          <button class="avatar-save-btn" id="avatar-save-btn" onclick="saveSelectedAvatar()">Save</button>
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
