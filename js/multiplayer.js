/**
 * Multiplayer Manager
 * Handles real-time collaboration using Supabase Realtime
 */

class MultiplayerManager {
    constructor() {
        this.supabase = null;
        this.channel = null;
        this.projectId = null;
        this.user = null;
        this.presenceState = {};
        this.isConnected = false;

        // Event listeners
        this.onPresenceUpdate = null; // Callback for user list updates
        this.onCursorUpdate = null; // Callback for remote cursor movement
        this.onBroadcastEvent = null; // Callback for other events (node updates, etc.)

        // Throttling for cursor updates
        this.lastCursorUpdate = 0;
        this.cursorUpdateInterval = 50; // ms

        this.init();
    }

    async init() {
        if (window.getSupabase) {
            this.supabase = window.getSupabase();
        }

        // Listen for auth changes to update user info
        if (window.onAuthStateChange) {
            window.onAuthStateChange((event, session) => {
                if (session?.user) {
                    this.user = session.user;
                } else {
                    this.user = null;
                    this.disconnect();
                }
            });
        }

        // Get initial user if available
        if (window.getCurrentUser) {
            this.user = window.getCurrentUser();
        }
    }

    /**
     * Connect to a project's realtime channel
     * @param {string} projectId 
     */
    async connect(projectId) {
        if (!this.supabase || !this.user) {
            console.warn('[Multiplayer] Cannot connect: Supabase not init or no user');
            return;
        }

        if (this.channel) {
            this.disconnect();
        }

        this.projectId = projectId;
        const channelId = `project:${projectId}`;

        console.log(`[Multiplayer] Connecting to channel: ${channelId}`);

        // Create channel with presence enabled
        this.channel = this.supabase.channel(channelId, {
            config: {
                presence: {
                    key: this.user.id,
                },
            },
        });

        // Subscribe to events
        this.channel
            .on('presence', { event: 'sync' }, () => {
                this.presenceState = this.channel.presenceState();
                console.log('[Multiplayer] Presence sync:', this.presenceState);
                if (this.onPresenceUpdate) this.onPresenceUpdate(this.presenceState);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('[Multiplayer] User joined:', key, newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('[Multiplayer] User left:', key, leftPresences);
            })
            .on('broadcast', { event: 'cursor-move' }, (payload) => {
                // Ignore own events (though broadcast typically doesn't send to self)
                if (payload.userId === this.user.id) return;
                if (this.onCursorUpdate) this.onCursorUpdate(payload);
            })
            .on('broadcast', { event: 'node-update' }, (payload) => {
                if (payload.userId === this.user.id) return;
                if (this.onBroadcastEvent) this.onBroadcastEvent('node-update', payload);
            })
            // Add more specific event types as needed
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    this.isConnected = true;
                    console.log('[Multiplayer] Connected!');
                    // Track initial presence
                    await this.channel.track({
                        user_id: this.user.id,
                        email: this.user.email,
                        name: this.user.user_metadata?.full_name || this.user.email.split('@')[0],
                        avatar_url: this.user.user_metadata?.avatar_url,
                        online_at: new Date().toISOString(),
                        cursor: null
                    });
                } else {
                    console.log(`[Multiplayer] Channel status: ${status}`);
                }
            });
    }

    /**
     * Disconnect from current channel
     */
    disconnect() {
        if (this.channel) {
            console.log('[Multiplayer] Disconnecting...');
            this.supabase.removeChannel(this.channel);
            this.channel = null;
            this.isConnected = false;
            this.presenceState = {};
            if (this.onPresenceUpdate) this.onPresenceUpdate({});
        }
    }

    /**
     * Send cursor position update
     * @param {number} x 
     * @param {number} y 
     */
    sendCursorMove(x, y) {
        if (!this.isConnected || !this.channel) return;

        const now = Date.now();
        if (now - this.lastCursorUpdate < this.cursorUpdateInterval) return;
        this.lastCursorUpdate = now;

        this.channel.send({
            type: 'broadcast',
            event: 'cursor-move',
            payload: {
                userId: this.user.id,
                x,
                y,
                name: this.user.user_metadata?.full_name || 'User',
                color: this.getUserColor(this.user.id)
            }
        });
    }

    /**
     * Broadcast a generic event
     * @param {string} eventName 
     * @param {object} data 
     */
    broadcast(eventName, data) {
        if (!this.isConnected || !this.channel) return;

        this.channel.send({
            type: 'broadcast',
            event: eventName,
            payload: {
                userId: this.user.id,
                ...data
            }
        });
    }

    /**
     * Generate a consistent color based on user ID
     */
    getUserColor(userId) {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }
}

// Export global instance
window.MultiplayerManager = MultiplayerManager;
window.multiplayer = new MultiplayerManager();
