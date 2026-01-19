/**
 * Supabase Authentication Module
 * Handles user authentication with email/password and OAuth providers
 */

// Auth state
let currentUser = null;
let authStateListeners = [];

/**
 * Initialize authentication and set up listeners
 */
async function initAuth() {
    const supabase = await window.initSupabase();
    if (!supabase) {
        console.error('[Auth] Supabase client not available');
        return;
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] State changed:', event, session?.user?.email);

        if (session?.user) {
            currentUser = session.user;
            updateAuthUI(true);
        } else {
            currentUser = null;
            updateAuthUI(false);
        }

        // Notify all listeners
        authStateListeners.forEach(listener => listener(event, session));
    });

    // Check existing session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        currentUser = session.user;
        updateAuthUI(true);
        console.log('[Auth] Existing session found:', session.user.email);
    }
}

/**
 * Sign up with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>} Result with user or error
 */
async function signUpWithEmail(email, password) {
    const supabase = window.getSupabase();
    if (!supabase) {
        return { error: { message: 'Supabase not initialized' } };
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: 'mosaic://auth/callback' // Deep link for Electron
            }
        });

        if (error) {
            console.error('[Auth] Sign up error:', error);
            return { error };
        }

        console.log('[Auth] Sign up successful:', data.user?.email);
        return { data };
    } catch (error) {
        console.error('[Auth] Sign up exception:', error);
        return { error: { message: error.message } };
    }
}

/**
 * Sign in with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>} Result with user or error
 */
async function signInWithEmail(email, password) {
    const supabase = window.getSupabase();
    if (!supabase) {
        return { error: { message: 'Supabase not initialized' } };
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('[Auth] Sign in error:', error);
            return { error };
        }

        console.log('[Auth] Sign in successful:', data.user?.email);
        return { data };
    } catch (error) {
        console.error('[Auth] Sign in exception:', error);
        return { error: { message: error.message } };
    }
}

/**
 * Sign in with OAuth provider
 * @param {string} provider - 'google', 'github', 'apple'
 * @returns {Promise<object>} Result with URL or error
 */
async function signInWithOAuth(provider) {
    const supabase = window.getSupabase();
    if (!supabase) {
        return { error: { message: 'Supabase not initialized' } };
    }

    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: 'mosaic://auth/callback',
                skipBrowserRedirect: true // Handle manually in Electron
            }
        });

        if (error) {
            console.error('[Auth] OAuth error:', error);
            return { error };
        }

        // In Electron, we need to open the URL in the system browser
        if (data?.url && window.electronAPI?.openExternal) {
            window.electronAPI.openExternal(data.url);
            return { data: { message: 'Opening browser for authentication...' } };
        } else if (data?.url) {
            // Fallback: open in new window
            window.open(data.url, '_blank');
            return { data: { message: 'Opening browser for authentication...' } };
        }

        return { error: { message: 'No redirect URL received' } };
    } catch (error) {
        console.error('[Auth] OAuth exception:', error);
        return { error: { message: error.message } };
    }
}

/**
 * Sign out the current user
 * @returns {Promise<object>} Result with success or error
 */
async function signOut() {
    const supabase = window.getSupabase();
    if (!supabase) {
        return { error: { message: 'Supabase not initialized' } };
    }

    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('[Auth] Sign out error:', error);
            return { error };
        }

        currentUser = null;
        console.log('[Auth] Signed out successfully');
        return { success: true };
    } catch (error) {
        console.error('[Auth] Sign out exception:', error);
        return { error: { message: error.message } };
    }
}

/**
 * Get the current user
 * @returns {object|null} Current user or null
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if user is signed in
 */
function isAuthenticated() {
    return currentUser !== null;
}

/**
 * Add a listener for auth state changes
 * @param {function} listener - Callback function(event, session)
 */
function onAuthStateChange(listener) {
    authStateListeners.push(listener);
}

/**
 * Update UI based on auth state
 * @param {boolean} isSignedIn 
 */
function updateAuthUI(isSignedIn) {
    // Update sidebar user info
    const userSection = document.getElementById('sidebar-user');
    const signInPrompt = document.getElementById('sidebar-signin-prompt');

    if (isSignedIn && currentUser) {
        if (userSection) {
            userSection.innerHTML = `
                <div class="user-avatar">
                    <img src="${currentUser.user_metadata?.avatar_url || 'assets/default-avatar.png'}" alt="Avatar">
                </div>
                <div class="user-info">
                    <span class="user-name">${currentUser.user_metadata?.full_name || currentUser.email}</span>
                    <span class="user-email">${currentUser.email}</span>
                </div>
                <button class="sign-out-btn" onclick="window.signOut()">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            `;
            userSection.style.display = 'flex';
        }
        if (signInPrompt) signInPrompt.style.display = 'none';
    } else {
        if (userSection) userSection.style.display = 'none';
        if (signInPrompt) signInPrompt.style.display = 'block';
    }

    // Dispatch custom event for other modules
    window.dispatchEvent(new CustomEvent('authStateChanged', {
        detail: { isSignedIn, user: currentUser }
    }));
}

/**
 * Send password reset email
 * @param {string} email 
 * @returns {Promise<object>} Result
 */
async function resetPassword(email) {
    const supabase = window.getSupabase();
    if (!supabase) {
        return { error: { message: 'Supabase not initialized' } };
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'mosaic://auth/reset-password'
        });

        if (error) {
            return { error };
        }

        return { success: true, message: 'Password reset email sent' };
    } catch (error) {
        return { error: { message: error.message } };
    }
}

// Export functions globally
window.initAuth = initAuth;
window.signUpWithEmail = signUpWithEmail;
window.signInWithEmail = signInWithEmail;
window.signInWithOAuth = signInWithOAuth;
window.signOut = signOut;
window.getCurrentUser = getCurrentUser;
window.isAuthenticated = isAuthenticated;
window.onAuthStateChange = onAuthStateChange;
window.resetPassword = resetPassword;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.isSupabaseConfigured && window.isSupabaseConfigured()) {
        initAuth().catch(err => console.error('[Auth] Init failed:', err));
    } else {
        console.warn('[Auth] Supabase not configured. Set SUPABASE_ANON_KEY in supabase-client.js');
    }

    // Listen for deep link auth callbacks from Electron
    if (window.electronAPI && window.electronAPI.onAuthDeepLink) {
        window.electronAPI.onAuthDeepLink(async (data) => {
            console.log('[Auth] Deep link callback received:', data);

            if (data.accessToken && data.refreshToken) {
                const supabase = window.getSupabase();
                if (supabase) {
                    try {
                        const { data: sessionData, error } = await supabase.auth.setSession({
                            access_token: data.accessToken,
                            refresh_token: data.refreshToken
                        });

                        if (error) {
                            console.error('[Auth] Session set error:', error);
                        } else {
                            console.log('[Auth] Session restored from deep link');
                            // Hide sign-up/sign-in screens
                            if (window.hideSignUpScreen) window.hideSignUpScreen();
                            if (window.hideSignInScreen) window.hideSignInScreen();
                        }
                    } catch (err) {
                        console.error('[Auth] Deep link session error:', err);
                    }
                }
            }
        });
    }
});
