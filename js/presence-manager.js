/**
 * Presence Manager
 * Handles user online/offline status with Supabase Realtime
 */

class PresenceManager {
    constructor() {
        this.status = 'offline';
        this.isVisible = true; // false = görünmez mod
        this.subscription = null;
        this.heartbeatInterval = null;
        this.onlineUsers = new Map(); // userId -> presence data

        this.init();
    }

    async init() {
        // Wait for auth
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            setTimeout(() => this.setup(), 500);
        }
    }

    async setup() {
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!user) {
            console.log('[Presence] Not authenticated, skipping presence setup');
            return;
        }

        console.log('[Presence] Setting up for user:', user.id);

        // Set initial status to online
        await this.setStatus('online');

        // Start heartbeat
        this.startHeartbeat();

        // Subscribe to presence changes
        this.subscribeToPresence();

        // Handle window close/refresh
        window.addEventListener('beforeunload', () => this.setStatus('offline'));

        // Handle visibility change (tab switch)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.setStatus('away');
            } else {
                this.setStatus('online');
            }
        });

        // Update UI
        this.updateStatusIndicator();
    }

    async setStatus(status) {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        const user = window.getCurrentUser ? window.getCurrentUser() : null;

        if (!supabase || !user) return;

        this.status = status;
        this.currentStatus = status;

        try {
            const { error } = await supabase
                .from('user_presence')
                .upsert({
                    user_id: user.id,
                    status: status,
                    last_seen: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (error) {
                console.error('[Presence] Update error:', error);
            } else {
                console.log('[Presence] Status updated:', status);
                this.updateStatusIndicator();
            }
        } catch (err) {
            console.error('[Presence] Exception:', err);
        }
    }

    async setInvisible(invisible) {
        this.isVisible = !invisible;
        await this.setStatus(this.status);
        console.log('[Presence] Invisible mode:', invisible);
    }

    startHeartbeat() {
        // Update presence every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            if (this.status === 'online') {
                this.setStatus('online');
            }
        }, 30000);
    }

    subscribeToPresence() {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        if (!supabase) return;

        try {
            this.subscription = supabase
                .channel('presence-changes')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'user_presence'
                }, (payload) => {
                    console.log('[Presence] Change detected:', payload);

                    if (payload.new) {
                        this.onlineUsers.set(payload.new.user_id, payload.new);
                    }

                    // Notify listeners
                    window.dispatchEvent(new CustomEvent('presence-update', {
                        detail: payload
                    }));
                })
                .subscribe();
        } catch (err) {
            console.log('[Presence] Subscription error:', err);
        }
    }

    async getOnlineUsers() {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        if (!supabase) return [];

        try {
            const { data, error } = await supabase
                .from('user_presence')
                .select('user_id, status, last_seen')
                .eq('status', 'online');

            if (error) {
                console.error('[Presence] Fetch error:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('[Presence] Exception:', err);
            return [];
        }
    }

    async isUserOnline(userId) {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        if (!supabase) return false;

        try {
            const { data, error } = await supabase
                .from('user_presence')
                .select('status, last_seen')
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                console.log('[Presence] User not found or error:', userId, error);
                return false;
            }

            // Check if presence is stale (last seen > 60 seconds ago)
            const lastSeen = new Date(data.last_seen);
            const now = new Date();
            const secondsSinceLastSeen = (now - lastSeen) / 1000;

            const isOnline = data.status === 'online' && secondsSinceLastSeen < 60;
            console.log('[Presence] User', userId, 'status:', data.status, 'lastSeen:', secondsSinceLastSeen.toFixed(0) + 's ago', '=> online:', isOnline);

            return isOnline;
        } catch (err) {
            console.error('[Presence] isUserOnline error:', err);
            return false;
        }
    }

    updateStatusIndicator() {
        // Update sidebar status text
        const statusText = document.getElementById('user-status-text');

        if (statusText) {
            // Only Online or Offline - no invisible
            if (this.status === 'online') {
                statusText.textContent = 'Online';
                statusText.style.color = '#4ade80';
            } else {
                statusText.textContent = 'Offline';
                statusText.style.color = '#f97316';
            }
        }

        // Store current status for other components
        this.currentStatus = this.status;
    }

    destroy() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}

// Initialize and export
let presenceManager = null;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        presenceManager = new PresenceManager();
        window.presenceManager = presenceManager;
    }, 1000);
});

window.PresenceManager = PresenceManager;
