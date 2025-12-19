// Welcome Screen Personalization
// Dynamically updates greeting based on time and user context

function personalizeWelcomeScreen() {
  const welcomeNameSpan = document.getElementById('welcome-name-span');
  const greetingSub = document.querySelector('.greeting-sub');
  const heroQuestion = document.querySelector('.hero-question');
  
  if (!welcomeNameSpan || !greetingSub) return;
  
  // Get user info from auth or localStorage
  const user = window.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
  const userName = user.displayName || user.name || 'there';
  const isReturningUser = localStorage.getItem('hasVisited') === 'true';
  
  // Time-based greeting
  // Time-based greeting removed as per user request
  const timeGreeting = 'Hi';
  
  // Format name to show only first name
  const firstName = userName.split(' ')[0];
  
  // Update greeting
  const greetingHTML = `${timeGreeting} <span id="welcome-name-span">${firstName}</span> 👋`;
  greetingSub.innerHTML = greetingHTML;
  
  // Add returning user animation
  if (isReturningUser) {
    greetingSub.classList.add('returning-user');
  }
  
  // Random question logic removed as per user request
  // The hero question is now static in HTML
  
  // Mark as visited
  localStorage.setItem('hasVisited', 'true');
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', personalizeWelcomeScreen);
} else {
  personalizeWelcomeScreen();
}

// Re-run when user logs in
window.addEventListener('userLoggedIn', personalizeWelcomeScreen);
