/**
 * mobile.js
 * Mobile-specific features: Pull to refresh, Swipe to delete, Haptic feedback, PWA install
 */

// ============================================
// HAPTIC FEEDBACK
// ============================================
function hapticFeedback(type = 'light') {
    if (!navigator.vibrate) return;

    const patterns = {
        light: 10,
        medium: 25,
        heavy: 50,
        success: [10, 50, 30],
        error: [50, 30, 50],
        warning: [30, 20, 30]
    };

    navigator.vibrate(patterns[type] || 10);
}

// ============================================
// PULL TO REFRESH
// ============================================
let pullStartY = 0;
let pullDistance = 0;
let isPulling = false;
let pullRefreshEnabled = true;
const PULL_THRESHOLD = 80;

function initPullToRefresh() {
    const container = document.getElementById('recent-chats-container');
    const nav = document.querySelector('.nav-menu');
    if (!container || !nav) return;

    // Create pull indicator
    let pullIndicator = document.getElementById('pull-refresh-indicator');
    if (!pullIndicator) {
        pullIndicator = document.createElement('div');
        pullIndicator.id = 'pull-refresh-indicator';
        pullIndicator.innerHTML = `
      <div class="pull-spinner">
        <i class="fa-solid fa-arrow-down"></i>
      </div>
      <span class="pull-text">Pull to refresh</span>
    `;
        nav.insertBefore(pullIndicator, container);
    }

    nav.addEventListener('touchstart', handlePullStart, { passive: true });
    nav.addEventListener('touchmove', handlePullMove, { passive: false });
    nav.addEventListener('touchend', handlePullEnd, { passive: true });
}

function handlePullStart(e) {
    if (!pullRefreshEnabled) return;

    const nav = document.querySelector('.nav-menu');
    // Only enable pull if scrolled to top
    if (nav && nav.scrollTop <= 0) {
        pullStartY = e.touches[0].clientY;
        isPulling = true;
    }
}

function handlePullMove(e) {
    if (!isPulling || !pullRefreshEnabled) return;

    const currentY = e.touches[0].clientY;
    pullDistance = Math.max(0, currentY - pullStartY);

    const indicator = document.getElementById('pull-refresh-indicator');
    if (!indicator) return;

    if (pullDistance > 0) {
        e.preventDefault(); // Prevent scroll while pulling

        const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
        indicator.style.height = `${Math.min(pullDistance * 0.5, 60)}px`;
        indicator.style.opacity = progress;

        const icon = indicator.querySelector('i');
        const text = indicator.querySelector('.pull-text');

        if (pullDistance >= PULL_THRESHOLD) {
            indicator.classList.add('ready');
            if (icon) icon.className = 'fa-solid fa-rotate';
            if (text) text.textContent = 'Release to refresh';
        } else {
            indicator.classList.remove('ready');
            if (icon) icon.className = 'fa-solid fa-arrow-down';
            if (text) text.textContent = 'Pull to refresh';
        }
    }
}

async function handlePullEnd() {
    if (!isPulling) return;

    const indicator = document.getElementById('pull-refresh-indicator');

    if (pullDistance >= PULL_THRESHOLD) {
        // Trigger refresh
        hapticFeedback('medium');

        if (indicator) {
            indicator.classList.add('refreshing');
            const icon = indicator.querySelector('i');
            const text = indicator.querySelector('.pull-text');
            if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
            if (text) text.textContent = 'Refreshing...';
        }

        // Refresh chats
        if (typeof loadAllChats === 'function') {
            await loadAllChats();
        }

        hapticFeedback('success');

        // Show success briefly
        if (indicator) {
            const icon = indicator.querySelector('i');
            const text = indicator.querySelector('.pull-text');
            if (icon) icon.className = 'fa-solid fa-check';
            if (text) text.textContent = 'Updated!';

            setTimeout(() => {
                resetPullIndicator();
            }, 500);
        }
    } else {
        resetPullIndicator();
    }

    // Reset state
    isPulling = false;
    pullDistance = 0;
    pullStartY = 0;
}

function resetPullIndicator() {
    const indicator = document.getElementById('pull-refresh-indicator');
    if (indicator) {
        indicator.style.height = '0';
        indicator.style.opacity = '0';
        indicator.classList.remove('ready', 'refreshing');
    }
}

// ============================================
// SWIPE TO DELETE
// ============================================
let swipeStartX = 0;
let swipeCurrentX = 0;
let swipingElement = null;
const SWIPE_THRESHOLD = 80;

function initSwipeToDelete() {
    // This will be called each time renderRecentChats runs
    const chatItems = document.querySelectorAll('.chat-item-wrapper');

    chatItems.forEach(item => {
        // Skip if already initialized
        if (item.dataset.swipeInit) return;
        item.dataset.swipeInit = 'true';

        // Add delete background
        let deleteBackground = item.querySelector('.swipe-delete-bg');
        if (!deleteBackground) {
            deleteBackground = document.createElement('div');
            deleteBackground.className = 'swipe-delete-bg';
            deleteBackground.innerHTML = '<i class="fa-solid fa-trash"></i>';
            item.insertBefore(deleteBackground, item.firstChild);
        }

        // Add touch handlers
        item.addEventListener('touchstart', handleSwipeStart, { passive: true });
        item.addEventListener('touchmove', handleSwipeMove, { passive: false });
        item.addEventListener('touchend', handleSwipeEnd, { passive: true });
    });
}

function handleSwipeStart(e) {
    swipeStartX = e.touches[0].clientX;
    swipingElement = e.currentTarget;
    swipingElement.classList.add('swiping');
}

function handleSwipeMove(e) {
    if (!swipingElement) return;

    swipeCurrentX = e.touches[0].clientX;
    const diff = swipeStartX - swipeCurrentX;

    // Only allow left swipe
    if (diff > 0) {
        e.preventDefault();
        const translateX = Math.min(diff, 100);
        const navItem = swipingElement.querySelector('.nav-item');
        if (navItem) {
            navItem.style.transform = `translateX(-${translateX}px)`;
        }

        // Show delete background
        const bg = swipingElement.querySelector('.swipe-delete-bg');
        if (bg) {
            bg.style.opacity = Math.min(diff / SWIPE_THRESHOLD, 1);
        }

        if (diff >= SWIPE_THRESHOLD) {
            swipingElement.classList.add('delete-ready');
        } else {
            swipingElement.classList.remove('delete-ready');
        }
    }
}

function handleSwipeEnd(e) {
    if (!swipingElement) return;

    const diff = swipeStartX - swipeCurrentX;
    const chatId = swipingElement.id.replace('chat-wrapper-', '');

    if (diff >= SWIPE_THRESHOLD) {
        // Trigger delete
        hapticFeedback('warning');

        // Animate out
        swipingElement.style.transform = 'translateX(-100%)';
        swipingElement.style.opacity = '0';
        swipingElement.style.height = '0';
        swipingElement.style.marginBottom = '0';
        swipingElement.style.transition = 'all 0.3s ease';

        setTimeout(() => {
            // Call delete function
            if (typeof chatAction === 'function') {
                chatAction('delete', chatId);
            }
        }, 300);
    } else {
        // Reset position
        resetSwipeItem(swipingElement);
    }

    swipingElement.classList.remove('swiping', 'delete-ready');
    swipingElement = null;
    swipeStartX = 0;
    swipeCurrentX = 0;
}

function resetSwipeItem(item) {
    const navItem = item.querySelector('.nav-item');
    const bg = item.querySelector('.swipe-delete-bg');

    if (navItem) {
        navItem.style.transform = 'translateX(0)';
        navItem.style.transition = 'transform 0.2s ease';
        setTimeout(() => {
            navItem.style.transition = '';
        }, 200);
    }

    if (bg) {
        bg.style.opacity = '0';
    }
}

// ============================================
// PWA INSTALL PROMPT
// ============================================
let deferredPrompt = null;
let installBannerDismissed = false;

function initPWAInstall() {
    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Check if user hasn't dismissed before
        const dismissed = localStorage.getItem('lynq-pwa-dismissed');
        if (!dismissed) {
            setTimeout(() => showInstallBanner(), 3000); // Show after 3s
        }
    });

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
        hideInstallBanner();
        deferredPrompt = null;
        hapticFeedback('success');
        if (typeof showToast === 'function') {
            showToast('LYNQ AI installed successfully! 🎉');
        }
    });
}

function showInstallBanner() {
    if (installBannerDismissed || !deferredPrompt) return;

    // Check if banner already exists
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
    <div class="pwa-banner-content">
      <div class="pwa-banner-icon">
        <i class="fa-solid fa-mobile-screen"></i>
      </div>
      <div class="pwa-banner-text">
        <strong>Install LYNQ AI</strong>
        <span>Add to home screen for quick access</span>
      </div>
    </div>
    <div class="pwa-banner-actions">
      <button class="pwa-install-btn" onclick="installPWA()">
        <i class="fa-solid fa-download"></i> Install
      </button>
      <button class="pwa-dismiss-btn" onclick="dismissInstallBanner()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;

    document.body.appendChild(banner);

    // Animate in
    requestAnimationFrame(() => {
        banner.classList.add('visible');
    });

    hapticFeedback('light');
}

function hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 300);
    }
}

function dismissInstallBanner() {
    installBannerDismissed = true;
    localStorage.setItem('lynq-pwa-dismissed', 'true');
    hideInstallBanner();
}

async function installPWA() {
    if (!deferredPrompt) return;

    hapticFeedback('medium');

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
        console.log('PWA installed');
    }

    deferredPrompt = null;
    hideInstallBanner();
}

// ============================================
// INITIALIZATION
// ============================================
function initMobileFeatures() {
    // Only init on mobile/touch devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        initPullToRefresh();
        initPWAInstall();

        // Re-init swipe handlers when chats are rendered
        const originalRenderRecentChats = window.renderRecentChats;
        if (typeof originalRenderRecentChats === 'function') {
            window.renderRecentChats = function () {
                originalRenderRecentChats.apply(this, arguments);
                initSwipeToDelete();
            };
        }

        console.log('Mobile features initialized');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileFeatures);
} else {
    initMobileFeatures();
}
