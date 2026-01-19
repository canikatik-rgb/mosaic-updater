/**
 * Supabase Client Configuration
 * Central Supabase client instance for Mosaic
 */

// Supabase project configuration
const SUPABASE_URL = 'https://uiumjahsopqtcllyjeca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpdW1qYWhzb3BxdGNsbHlqZWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTc4MjUsImV4cCI6MjA4MzEzMzgyNX0.vS2fo5YI7bRmYB66C8bM9cFvT0ZerZ0YoLb93IkMYJ0';

// For Electron apps, we need to use the CDN version or bundle it
// Since we're in a renderer process, we'll load via dynamic import or CDN

let supabaseClient = null;

/**
 * Initialize Supabase client
 * @returns {Promise<object>} Supabase client instance
 */
async function initSupabase() {
    if (supabaseClient) {
        return supabaseClient;
    }

    try {
        // Use the CDN-loaded Supabase library (window.supabase)
        if (window.supabase && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: false // Disable for Electron
                }
            });
            console.log('[Supabase] Client initialized from CDN');
        } else {
            throw new Error('Supabase library not loaded. Make sure CDN script is included.');
        }

        return supabaseClient;
    } catch (error) {
        console.error('[Supabase] Failed to initialize client:', error);
        throw error;
    }
}

/**
 * Get the current Supabase client instance
 * @returns {object|null} Supabase client or null if not initialized
 */
function getSupabase() {
    return supabaseClient;
}

/**
 * Check if Supabase is properly configured
 * @returns {boolean} True if anon key is set
 */
function isSupabaseConfigured() {
    return SUPABASE_ANON_KEY !== 'YOUR_ANON_KEY_HERE';
}

// Export for use in other modules
window.initSupabase = initSupabase;
window.getSupabase = getSupabase;
window.isSupabaseConfigured = isSupabaseConfigured;
window.SUPABASE_URL = SUPABASE_URL;
