/**
 * Cursor Sync - Real-time cursor position sharing for P2P collaboration
 */

class CursorSync {
    constructor() {
        this.enabled = false;
        this.userColors = new Map();      // userId -> color
        this.remoteCursors = new Map();   // peerId -> {x, y, userId, name, lastUpdate}
        this.cursorLayer = null;
        this.localUserId = null;
        this.localUserName = null;
        this.throttleMs = 100;            // Broadcast every 100ms (10fps)
        this.lastBroadcast = 0;
        this.cursorTimeout = 5000;        // Hide cursor after 5s of inactivity

        // Bind methods
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
    }

    /**
     * Initialize cursor sync (call when P2P session starts)
     */
    init(canvasContainer) {
        const user = window.getCurrentUser?.();
        if (!user) {
            console.warn('[CursorSync] No user found, cannot initialize');
            return;
        }

        this.localUserId = user.id;
        this.localUserName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

        // Create cursor overlay layer
        this.cursorLayer = document.createElement('div');
        this.cursorLayer.className = 'cursor-sync-layer';
        this.cursorLayer.id = 'cursor-sync-layer';

        // Insert into canvas-content (the scrollable/zoomable canvas area)
        const container = canvasContainer || document.getElementById('canvas-content');
        if (!container) {
            console.error('[CursorSync] Canvas container not found');
            return;
        }

        container.style.position = 'relative';
        container.appendChild(this.cursorLayer);
        console.log('[CursorSync] Added cursor layer to canvas');

        // Attach mouse listeners to the main canvas wrapper for coordinate capture
        const canvasWrapper = document.getElementById('canvas-wrapper') || container;
        canvasWrapper.addEventListener('mousemove', this.onMouseMove);
        canvasWrapper.addEventListener('mouseleave', this.onMouseLeave);
        console.log('[CursorSync] Attached mouse listeners');

        // Listen for P2P cursor messages
        if (window.p2pManager) {
            window.p2pManager.on((event, data) => {
                if (event === 'cursor-move') {
                    this.handleRemoteCursor(data);
                } else if (event === 'cursor-leave') {
                    this.removeRemoteCursor(data.peerId || data.userId);
                } else if (event === 'guest-disconnected' || event === 'disconnected-from-host') {
                    this.removeRemoteCursor(data.peerId);
                }
            });
            console.log('[CursorSync] P2P message listener attached');
        } else {
            console.warn('[CursorSync] p2pManager not available');
        }

        // Cleanup stale cursors periodically
        this.cleanupInterval = setInterval(() => this.cleanupStaleCursors(), 1000);

        this.enabled = true;
        console.log('[CursorSync] Initialized for user:', this.localUserName);
    }

    /**
     * Generate consistent color for a user ID
     */
    generateColor(userId) {
        if (!userId) return '#4ade80';

        if (this.userColors.has(userId)) {
            return this.userColors.get(userId);
        }

        // Hash the userId to get a consistent hue
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Generate HSL color with good saturation and lightness
        const hue = Math.abs(hash) % 360;
        const color = `hsl(${hue}, 70%, 50%)`;

        this.userColors.set(userId, color);
        return color;
    }

    /**
     * Handle local mouse movement
     */
    onMouseMove(e) {
        // Debug: check why we might skip
        if (!this.enabled) {
            if (!this._debugSkip1) { console.log('[CursorSync] Skip: not enabled'); this._debugSkip1 = true; }
            return;
        }
        if (!window.p2pManager) {
            if (!this._debugSkip2) { console.log('[CursorSync] Skip: no p2pManager'); this._debugSkip2 = true; }
            return;
        }
        if (window.p2pManager.connections.size === 0) {
            // Don't log repeatedly - only every 5s
            const now = Date.now();
            if (!this._lastNoConnLog || now - this._lastNoConnLog > 5000) {
                console.log('[CursorSync] Waiting for peer connections...');
                this._lastNoConnLog = now;
            }
            return;
        }

        const now = Date.now();
        if (now - this.lastBroadcast < this.throttleMs) return;
        this.lastBroadcast = now;

        // Get position in canvas coordinates (accounting for zoom and pan)
        let x, y;
        if (window.getCanvasPosition) {
            const pos = window.getCanvasPosition(e);
            x = pos.x;
            y = pos.y;
        } else {
            // Fallback: use offset and scale
            const scale = window.canvasScale || 1;
            const offset = window.canvasOffset || { x: 0, y: 0 };
            x = (e.clientX - offset.x) / scale;
            y = (e.clientY - offset.y) / scale;
        }

        // Broadcast cursor position
        window.p2pManager.broadcast({
            type: 'cursor-move',
            x: x,
            y: y,
            userId: this.localUserId,
            name: this.localUserName
        });

        // Debug log (every 2 seconds max)
        if (!this._lastCursorDebug || now - this._lastCursorDebug > 2000) {
            console.log('[CursorSync] Broadcasting cursor:', { x: Math.round(x), y: Math.round(y), to: window.p2pManager.connections.size + ' peers' });
            this._lastCursorDebug = now;
        }
    }

    /**
     * Handle mouse leaving canvas
     */
    onMouseLeave() {
        if (!this.enabled) return;
        if (!window.p2pManager || window.p2pManager.connections.size === 0) return;

        window.p2pManager.broadcast({
            type: 'cursor-leave',
            userId: this.localUserId
        });
    }

    /**
     * Handle incoming remote cursor data
     */
    handleRemoteCursor(data) {
        const { x, y, userId, name, peerId } = data;

        // Debug log
        console.log('[CursorSync] Received cursor from:', name || userId, 'at', Math.round(x), Math.round(y));

        // Don't show our own cursor
        if (userId === this.localUserId) return;

        const cursorId = peerId || userId;

        this.remoteCursors.set(cursorId, {
            x, y, userId, name,
            lastUpdate: Date.now()
        });

        this.renderRemoteCursor(cursorId);
    }

    /**
     * Render a remote user's cursor
     */
    renderRemoteCursor(cursorId) {
        if (!this.cursorLayer) {
            console.warn('[CursorSync] No cursor layer available');
            return;
        }

        const cursorData = this.remoteCursors.get(cursorId);
        if (!cursorData) return;

        let cursorEl = document.getElementById(`remote-cursor-${cursorId}`);

        if (!cursorEl) {
            // Create new cursor element
            cursorEl = document.createElement('div');
            cursorEl.id = `remote-cursor-${cursorId}`;
            cursorEl.className = 'remote-cursor';

            const color = this.generateColor(cursorData.userId);
            cursorEl.style.setProperty('--cursor-color', color);

            cursorEl.innerHTML = `
                <svg class="cursor-pointer" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.5 3.21V20.8l5.17-5.64h7.83L5.5 3.21z"/>
                </svg>
                <span class="cursor-label">${cursorData.name || 'User'}</span>
            `;

            this.cursorLayer.appendChild(cursorEl);
            console.log('[CursorSync] Created cursor for:', cursorData.name);
        }

        // Update position - directly in canvas coordinates
        cursorEl.style.left = `${cursorData.x}px`;
        cursorEl.style.top = `${cursorData.y}px`;
        cursorEl.classList.add('active');
    }

    /**
     * Remove a remote cursor
     */
    removeRemoteCursor(cursorId) {
        if (!cursorId) return;

        this.remoteCursors.delete(cursorId);

        const cursorEl = document.getElementById(`remote-cursor-${cursorId}`);
        if (cursorEl) {
            cursorEl.classList.add('leaving');
            setTimeout(() => cursorEl.remove(), 300);
        }
    }

    /**
     * Clean up stale cursors (no movement for cursorTimeout)
     */
    cleanupStaleCursors() {
        const now = Date.now();

        for (const [cursorId, data] of this.remoteCursors) {
            if (now - data.lastUpdate > this.cursorTimeout) {
                this.removeRemoteCursor(cursorId);
            }
        }
    }

    /**
     * Get list of active remote users
     */
    getActiveUsers() {
        const users = [];
        for (const [, data] of this.remoteCursors) {
            users.push({
                userId: data.userId,
                name: data.name,
                color: this.generateColor(data.userId)
            });
        }
        return users;
    }

    /**
     * Destroy cursor sync
     */
    destroy() {
        this.enabled = false;

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        const canvasWrapper = document.getElementById('canvas-wrapper');
        if (canvasWrapper) {
            canvasWrapper.removeEventListener('mousemove', this.onMouseMove);
            canvasWrapper.removeEventListener('mouseleave', this.onMouseLeave);
        }

        if (this.cursorLayer) {
            this.cursorLayer.remove();
        }

        this.remoteCursors.clear();
        this.userColors.clear();

        console.log('[CursorSync] Destroyed');
    }
}

// Export
window.CursorSync = CursorSync;
window.cursorSync = null;

// Auto-initialize when p2p connection happens
// The p2pManager will call init explicitly
