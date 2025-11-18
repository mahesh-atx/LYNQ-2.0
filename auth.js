// --- Firebase Authentication Logic ---
// This file centralizes all Firebase auth code.

// Global auth-related variables
let app = null;
let auth = null;
let googleProvider = null;
let githubProvider = null;
let recaptchaVerifier = null;
let phoneConfirmationResult = null;

/**
 * Initializes the Firebase app and auth providers.
 * @param {object} firebaseConfig - Your Firebase project config object.
 */
function initializeFirebase(firebaseConfig) {
  if (!window.firebase) {
    console.error("Firebase SDKs not loaded.");
    return;
  }

  // Check if app is already initialized
  if (firebase.apps.length === 0) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app(); // Get the default app
  }

  auth = firebase.auth();

  // --- Initialize Providers ---
  googleProvider = new firebase.auth.GoogleAuthProvider();
  githubProvider = new firebase.auth.GithubAuthProvider();

  // --- Setup Auth State Listener ---
  // This is the most important part. It listens for changes in auth state.
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // --- User is signed in ---
      console.log("Auth state changed: User is signed in.", user);

      // 1. Sync user with our backend DB
      // We do this to store their info in our own Mongoose DB
      await syncUserWithBackend(user);

      // 2. If on login page, redirect to home
      if (window.location.pathname.includes("login.html")) {
        window.location.href = "index.html";
      }
    } else {
      // --- User is signed out ---
      console.log("Auth state changed: User is signed out.");

      // 1. If on any page *except* login, redirect to login
      // REMOVED: No longer force redirect to login.
      // User can now browse as a guest.
      /*
      if (!window.location.pathname.includes("login.html")) {
        window.location.href = "login.html";
      }
      */
    }

    // 2. Notify the global script (script.js) of the change
    // This allows script.js to update the UI (e.g., show profile, hide login btn)
    // We use a custom event to avoid tight coupling
    const event = new CustomEvent("authStateReady", { detail: { user } });
    document.dispatchEvent(event);
  });
}

/**
 * Sets up the invisible reCAPTCHA for phone authentication.
 * @param {string} containerId - The ID of the HTML element for reCAPTCHA.
 */
function setupRecaptcha(containerId) {
  if (!auth) {
    console.error(
      "Firebase Auth not initialized. Call initializeFirebase first."
    );
    return;
  }
  // Ensure the container is empty and visible
  document.getElementById(containerId).innerHTML = "";
  recaptchaVerifier = new firebase.auth.RecaptchaVerifier(containerId, {
    size: "invisible", // Use 'invisible' or 'normal'
    callback: (response) => {
      // reCAPTCHA solved, allow signInWithPhoneNumber.
      console.log("reCAPTCHA solved");
    },
    "expired-callback": () => {
      // Response expired. Ask user to solve reCAPTCHA again.
      console.log("reCAPTCHA expired");
    },
  });
  recaptchaVerifier.render().catch(console.error);
}

/**
 * Creates a new user with email and password.
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 */
async function signUpWithEmail(email, password, displayName) {
  if (!auth) throw new Error("Auth not initialized.");
  const userCredential = await auth.createUserWithEmailAndPassword(
    email,
    password
  );
  // Add the display name to the new user's profile
  if (userCredential.user && displayName) {
    await userCredential.user.updateProfile({
      displayName: displayName,
    });
  }
  // auth.onAuthStateChanged will handle the rest
}

/**
 * Logs in an existing user with email and password.
 * @param {string} email
 * @param {string} password
 */
async function logInWithEmail(email, password) {
  if (!auth) throw new Error("Auth not initialized.");
  await auth.signInWithEmailAndPassword(email, password);
  // auth.onAuthStateChanged will handle the rest
}

/**
 * Initiates sign-in with Google popup.
 */
async function signInWithGoogle() {
  if (!auth || !googleProvider)
    throw new Error("Auth/Google Provider not initialized.");
  await auth.signInWithPopup(googleProvider);
  // auth.onAuthStateChanged will handle the rest
}

/**
 * Initiates sign-in with GitHub popup.
 */
async function signInWithGitHub() {
  if (!auth || !githubProvider)
    throw new Error("Auth/GitHub Provider not initialized.");
  await auth.signInWithPopup(githubProvider);
  // auth.onAuthStateChanged will handle the rest
}

/**
 * Sends a verification code to a user's phone.
 * @param {string} phoneNumber
 */
async function signInWithPhone(phoneNumber) {
  if (!auth || !recaptchaVerifier)
    throw new Error("Auth/reCAPTCHA not initialized.");

  // Clear any previous reCAPTCHA
  recaptchaVerifier.clear();

  phoneConfirmationResult = await auth.signInWithPhoneNumber(
    phoneNumber,
    recaptchaVerifier
  );
  console.log("Phone confirmation result:", phoneConfirmationResult);
  // Now the user needs to enter the code
}

/**
 * Verifies the phone code and signs the user in.
 * @param {string} code
 */
async function verifyPhoneCode(code) {
  if (!phoneConfirmationResult) {
    throw new Error("No phone verification in progress. Send a code first.");
  }
  await phoneConfirmationResult.confirm(code);
  // auth.onAuthStateChanged will handle the rest
}

/**
 * Logs the current user out.
 */
async function logoutUser() {
  if (!auth) throw new Error("Auth not initialized.");
  await auth.signOut();
  // auth.onAuthStateChanged will handle the redirect
}

/**
 * Gets the current user's JWT token.
 * This is needed to authenticate with our *own* backend (server.js).
 */
async function getAuthToken() {
  if (!auth || !auth.currentUser) {
    return null;
  }
  try {
    return await auth.currentUser.getIdToken(true); // Force refresh
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
}

/**
 * Sends the user's info to our backend API to create/update
 * their profile in our Mongoose database.
 * @param {object} user - The Firebase User object
 */
async function syncUserWithBackend(user) {
  if (!user) return;

  try {
    const token = await user.getIdToken();
    const response = await fetch("/api/users/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      // Body is not needed, server will get user info from the token
    });

    if (!response.ok) {
      throw new Error("Backend sync failed.");
    }

    const data = await response.json();
    console.log("Backend sync successful:", data);
  } catch (error) {
    console.error("Error syncing user with backend:", error);
  }
}
