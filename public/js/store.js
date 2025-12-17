/*
  store.js
  Centralized state management for LYNQ AI
  Provides a single source of truth for application state
*/

const AppStore = {
  // --- Core State ---
  state: {
    // User & Auth
    currentUser: null,
    
    // Chat State
    mainChatHistory: [],
    recentChats: [],
    activeChatId: null,
    isNewChat: true,
    
    // Model State
    currentSelectedModel: "llama-3.1-8b-instant",
    availableModels: [],
    
    // UI State
    isResponding: false,
    currentController: null,
    
    // Tool State
    currentSelectedTool: null,
    isWebSearchActive: false,
    isCanvasModeActive: false, // Managed by canvas.js but tracked here
    currentToolId: null,
    
    // Cached Data
    systemPromptCache: null
  },

  // --- State Getters ---
  get(key) {
    return this.state[key];
  },

  // --- State Setters (with optional event dispatch) ---
  set(key, value, silent = false) {
    const oldValue = this.state[key];
    this.state[key] = value;
    
    if (!silent && oldValue !== value) {
      document.dispatchEvent(new CustomEvent('storeChange', { 
        detail: { key, value, oldValue } 
      }));
    }
    
    return value;
  },

  // --- Batch Update ---
  update(updates, silent = false) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value, silent);
    });
  },

  // --- Reset State ---
  reset(keys = null) {
    if (keys === null) {
      // Reset all to defaults
      this.state.mainChatHistory = [];
      this.state.recentChats = [];
      this.state.activeChatId = null;
      this.state.isNewChat = true;
      this.state.isResponding = false;
      this.state.currentController = null;
      this.state.currentSelectedTool = null;
      this.state.isWebSearchActive = false;
      this.state.currentToolId = null;
    } else {
      // Reset specific keys
      keys.forEach(key => {
        if (key in this.state) {
          // Reset to sensible defaults
          if (typeof this.state[key] === 'boolean') this.state[key] = false;
          else if (Array.isArray(this.state[key])) this.state[key] = [];
          else this.state[key] = null;
        }
      });
    }
  }
};

// Export to window for global access (until ES modules are adopted)
window.AppStore = AppStore;

// --- Backward Compatibility Layer ---
// Set up global variable proxies to AppStore
// These act as global variables but sync with AppStore state

Object.defineProperty(window, 'mainChatHistory', {
  get: () => AppStore.state.mainChatHistory,
  set: (val) => AppStore.set('mainChatHistory', val, true),
  configurable: true
});

Object.defineProperty(window, 'currentUser', {
  get: () => AppStore.state.currentUser,
  set: (val) => AppStore.set('currentUser', val, true),
  configurable: true
});

Object.defineProperty(window, 'recentChats', {
  get: () => AppStore.state.recentChats,
  set: (val) => AppStore.set('recentChats', val, true),
  configurable: true
});

Object.defineProperty(window, 'activeChatId', {
  get: () => AppStore.state.activeChatId,
  set: (val) => AppStore.set('activeChatId', val, true),
  configurable: true
});

Object.defineProperty(window, 'isNewChat', {
  get: () => AppStore.state.isNewChat,
  set: (val) => AppStore.set('isNewChat', val, true),
  configurable: true
});

Object.defineProperty(window, 'currentSelectedModel', {
  get: () => AppStore.state.currentSelectedModel,
  set: (val) => AppStore.set('currentSelectedModel', val, true),
  configurable: true
});

Object.defineProperty(window, 'availableModels', {
  get: () => AppStore.state.availableModels,
  set: (val) => AppStore.set('availableModels', val, true),
  configurable: true
});

Object.defineProperty(window, 'isResponding', {
  get: () => AppStore.state.isResponding,
  set: (val) => AppStore.set('isResponding', val, true),
  configurable: true
});

Object.defineProperty(window, 'currentController', {
  get: () => AppStore.state.currentController,
  set: (val) => AppStore.set('currentController', val, true),
  configurable: true
});

Object.defineProperty(window, 'currentSelectedTool', {
  get: () => AppStore.state.currentSelectedTool,
  set: (val) => AppStore.set('currentSelectedTool', val, true),
  configurable: true
});

Object.defineProperty(window, 'systemPromptCache', {
  get: () => AppStore.state.systemPromptCache,
  set: (val) => AppStore.set('systemPromptCache', val, true),
  configurable: true
});
