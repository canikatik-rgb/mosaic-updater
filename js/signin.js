/**
 * Sign In Screen Controller
 * Manages the sign-in UI before dashboard
 */

// Initialize sign-in screen
function initSignInScreen() {
    const signinScreen = document.getElementById('signin-screen');
    if (!signinScreen) {
        console.warn('[SignIn] Screen element not found');
        return;
    }

    // Check if already authenticated
    if (window.isAuthenticated && window.isAuthenticated()) {
        hideSignInScreen();
        return;
    }

    // Show sign-in screen
    showSignInScreen();

    // Setup event listeners
    setupSignInEvents();
}

/**
 * Show the sign-in screen
 */
function showSignInScreen() {
    const signinScreen = document.getElementById('signin-screen');
    const dashboard = document.getElementById('dashboard-view');
    const appContainer = document.getElementById('app-container');
    const titlebar = document.getElementById('custom-titlebar');
    const sidebar = document.getElementById('main-sidebar');

    if (signinScreen) {
        signinScreen.classList.remove('hidden');
        signinScreen.style.display = 'flex';
    }
    if (dashboard) dashboard.classList.add('hidden'); // Use class for dashboard
    if (appContainer) appContainer.style.display = 'none';
    if (titlebar) titlebar.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';

    console.log('[SignIn] Screen shown');
}

/**
 * Hide the sign-in screen and show dashboard
 * NOTE: Only shows dashboard if no project is currently open
 */
function hideSignInScreen() {
    const signinScreen = document.getElementById('signin-screen');
    const appContainer = document.getElementById('app-container');
    const dashboard = document.getElementById('dashboard-view');
    const titlebar = document.getElementById('custom-titlebar');
    const sidebar = document.getElementById('main-sidebar');

    // If signin screen is already hidden, don't do anything
    // This prevents dashboard from opening when app regains focus while in a project
    if (signinScreen && (signinScreen.classList.contains('hidden') || signinScreen.style.display === 'none')) {
        console.log('[SignIn] Screen already hidden, skipping dashboard show');
        return;
    }

    if (signinScreen) {
        signinScreen.classList.add('hidden');
        signinScreen.style.display = 'none';
    }

    // Only show dashboard and sidebar if no project is currently open
    const isProjectOpen = appContainer && appContainer.style.display !== 'none';

    if (!isProjectOpen) {
        if (dashboard) {
            dashboard.classList.remove('hidden');
        }
        if (sidebar) sidebar.style.display = 'flex';

        // Initialize dashboard
        if (window.dashboardManager) {
            window.dashboardManager.show();
        }
        console.log('[SignIn] Screen hidden, dashboard shown');
    } else {
        console.log('[SignIn] Screen hidden, project is open - dashboard NOT shown');
    }

    if (titlebar) titlebar.style.display = 'flex';
}

/**
 * Setup event listeners
 */
function setupSignInEvents() {
    const form = document.getElementById('signin-form');
    const emailInput = document.getElementById('signin-email');
    const passwordInput = document.getElementById('signin-password');
    const submitBtn = document.getElementById('signin-submit');
    const googleBtn = document.getElementById('signin-google');
    const githubBtn = document.getElementById('signin-github');
    const skipBtn = document.getElementById('signin-skip');
    const errorDiv = document.getElementById('signin-error');

    // Form submit
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleEmailSignIn(emailInput.value, passwordInput.value);
        });
    }

    // Google OAuth
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            await handleOAuthSignIn('google');
        });
    }

    // GitHub OAuth
    if (githubBtn) {
        githubBtn.addEventListener('click', async () => {
            await handleOAuthSignIn('github');
        });
    }

    // Skip to local mode
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            hideSignInScreen();
        });
    }

    // Listen for auth state changes
    if (window.onAuthStateChange) {
        window.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                hideSignInScreen();
                updateUserDisplay(session.user);
            }
        });
    }

    // Sign Up link - opens sign up screen
    const signupLink = document.getElementById('signin-signup-link');
    if (signupLink) {
        signupLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.showSignUpScreen) {
                window.showSignUpScreen();
            }
        });
    }
}

/**
 * Handle email/password sign in
 */
async function handleEmailSignIn(email, password) {
    const submitBtn = document.getElementById('signin-submit');
    const errorDiv = document.getElementById('signin-error');

    if (!email || !password) {
        showSignInError('Please enter email and password');
        return;
    }

    // Show loading
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    hideSignInError();

    try {
        const result = await window.signInWithEmail(email, password);

        if (result.error) {
            showSignInError(result.error.message || 'Sign in failed');
        } else {
            // Success - auth state change will hide screen
            console.log('[SignIn] Email sign in successful');
        }
    } catch (error) {
        showSignInError(error.message || 'An error occurred');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

/**
 * Handle OAuth sign in
 */
async function handleOAuthSignIn(provider) {
    hideSignInError();

    try {
        const result = await window.signInWithOAuth(provider);

        if (result.error) {
            showSignInError(result.error.message || 'OAuth sign in failed');
        }
        // OAuth opens external browser, so we wait for callback
    } catch (error) {
        showSignInError(error.message || 'An error occurred');
    }
}

/**
 * Show error message
 */
function showSignInError(message) {
    const errorDiv = document.getElementById('signin-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    }
}

/**
 * Hide error message
 */
function hideSignInError() {
    const errorDiv = document.getElementById('signin-error');
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
}

/**
 * Update user display in sidebar
 */
function updateUserDisplay(user) {
    const userAvatar = document.querySelector('.dashboard-user-avatar');
    const userName = document.querySelector('.dashboard-user-name');
    const userStatus = document.querySelector('.dashboard-user-status');

    if (user) {
        const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        const avatarLetter = displayName.charAt(0).toUpperCase();

        if (userAvatar) userAvatar.textContent = avatarLetter;
        if (userName) userName.textContent = displayName;
        if (userStatus) userStatus.textContent = 'Cloud Sync Active';
    }
}

// Export functions
window.initSignInScreen = initSignInScreen;
window.showSignInScreen = showSignInScreen;
window.hideSignInScreen = hideSignInScreen;

// Auto-init removed - Handled by AppLifecycle.js
