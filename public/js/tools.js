/*
  tools.js
  JavaScript for the Tools page - handles filtering, search, and tool activation
*/

// Tool welcome messages
const TOOL_MESSAGES = {
    canvas: "🎨 **You are in Canvas mode!**\n\nI can generate code with a live preview. Try asking me to:\n- Create a landing page\n- Build a React component\n- Design a dashboard UI\n\nWhat would you like me to build?",
    websearch: "🌐 **You are in Web Search mode!**\n\nI have access to real-time web data. Ask me about:\n- Latest news and events\n- Current trends and statistics\n- Recent developments\n\nWhat would you like to know?",
    dataanalysis: "📊 **You are in Data Analysis mode!**\n\nI can help you analyze data and generate insights. Try:\n- Uploading a CSV or describing your data\n- Asking for statistical summaries\n- Requesting data visualizations\n\nWhat data would you like to analyze?"
};


// Tool URL parameters for enabling specific modes
const TOOL_PARAMS = {
    canvas: 'tool=canvas',
    websearch: 'tool=websearch',
    dataanalysis: 'tool=dataanalysis'
};


// Tool metadata (names and icons) - used by chat.js and tools.js
const TOOL_INFO = {
    canvas: { name: "Canvas", icon: "fa-solid fa-file-invoice" },
    websearch: { name: "Web Search", icon: "fa-solid fa-earth-americas" },
    dataanalysis: { name: "Data Analysis", icon: "fa-solid fa-chart-line" },
    deepresearch: { name: "Deep Research", icon: "fa-solid fa-microscope" },
    thinking: { name: "Thinking", icon: "fa-solid fa-brain" },
    shoppingresearch: { name: "Shopping", icon: "fa-solid fa-bag-shopping" }
};


/**
 * Activates a tool by navigating to the home page with the tool parameter
 * @param {string} toolId - The tool identifier
 */
function activateTool(toolId) {
    const param = TOOL_PARAMS[toolId];
    if (param) {
        window.location.href = `index.html?${param}`;
    }
}

/**
 * Activates a tool with a pre-filled prompt
 * @param {string} toolId - The tool identifier
 * @param {string} prompt - The pre-filled prompt text
 */
function activateToolWithPrompt(toolId, prompt) {
    const param = TOOL_PARAMS[toolId];
    if (param) {
        const encodedPrompt = encodeURIComponent(prompt);
        window.location.href = `index.html?${param}&prompt=${encodedPrompt}`;
    }
}

/**
 * Filters tools based on search input
 */
function filterTools() {
    const searchInput = document.getElementById('tools-search');
    const searchTerm = searchInput.value.toLowerCase().trim();
    const toolCards = document.querySelectorAll('.tool-card');
    const noResults = document.getElementById('no-results');

    let visibleCount = 0;

    toolCards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        const description = card.querySelector('p').textContent.toLowerCase();
        const suggestions = card.querySelector('.tool-suggestions')?.textContent.toLowerCase() || '';

        const matchesSearch = title.includes(searchTerm) ||
            description.includes(searchTerm) ||
            suggestions.includes(searchTerm);

        // Also check if it matches the current category filter
        const activeCategory = document.querySelector('.category-pill.active')?.dataset.category || 'all';
        const cardCategory = card.dataset.category;
        const matchesCategory = activeCategory === 'all' || cardCategory === activeCategory;

        if (matchesSearch && matchesCategory) {
            card.classList.remove('hidden');
            visibleCount++;
        } else {
            card.classList.add('hidden');
        }
    });

    // Check each section visibility
    document.querySelectorAll('.tool-section').forEach(section => {
        const visibleCards = section.querySelectorAll('.tool-card:not(.hidden)').length;
        section.style.display = visibleCards > 0 ? 'block' : 'none';
    });

    // Show/hide no results message
    if (noResults) {
        noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }
}

/**
 * Filters tools by category
 * @param {string} category - The category to filter by
 */
function filterByCategory(category) {
    // Update active pill
    const pills = document.querySelectorAll('.category-pill');
    pills.forEach(pill => {
        if (pill.dataset.category === category) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    // Filter cards
    const toolCards = document.querySelectorAll('.tool-card');
    const noResults = document.getElementById('no-results');
    const searchInput = document.getElementById('tools-search');
    const searchTerm = searchInput?.value.toLowerCase().trim() || '';

    let visibleCount = 0;

    toolCards.forEach(card => {
        const cardCategory = card.dataset.category;
        const title = card.querySelector('h3').textContent.toLowerCase();
        const description = card.querySelector('p').textContent.toLowerCase();

        const matchesCategory = category === 'all' || cardCategory === category;
        const matchesSearch = searchTerm === '' ||
            title.includes(searchTerm) ||
            description.includes(searchTerm);

        if (matchesCategory && matchesSearch) {
            card.classList.remove('hidden');
            visibleCount++;
        } else {
            card.classList.add('hidden');
        }
    });

    // Check each section visibility
    document.querySelectorAll('.tool-section').forEach(section => {
        const visibleCards = section.querySelectorAll('.tool-card:not(.hidden)').length;
        section.style.display = visibleCards > 0 ? 'block' : 'none';
    });

    // Show/hide no results message
    if (noResults) {
        noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }
}

/**
 * Gets the welcome message for a specific tool
 * @param {string} toolId - The tool identifier
 * @returns {string} The welcome message
 */
function getToolWelcomeMessage(toolId) {
    return TOOL_MESSAGES[toolId] || "How can I help you today?";
}

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    // Add keyboard support for search
    const searchInput = document.getElementById('tools-search');
    if (searchInput) {
        searchInput.addEventListener('keyup', function (e) {
            if (e.key === 'Escape') {
                searchInput.value = '';
                filterTools();
                searchInput.blur();
            }
        });
    }
});
