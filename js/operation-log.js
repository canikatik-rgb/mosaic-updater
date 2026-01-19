/**
 * Operation Log System
 * Tracks all canvas operations for sync and undo/redo
 */

class OperationLog {
    constructor(projectId) {
        this.projectId = projectId;
        this.operations = []; // Local operation log
        this.pendingOps = []; // Ops to sync when online
        this.appliedOpIds = new Set(); // Prevent duplicate application
        this.listeners = new Set();
    }

    /**
     * Log a new operation
     * @param {string} type - Operation type: ADD_NODE, UPDATE_NODE, DELETE_NODE, etc.
     * @param {object} data - Operation data
     */
    log(type, data) {
        const user = window.getCurrentUser ? window.getCurrentUser() : null;

        const operation = {
            id: this.generateOpId(),
            op: type,
            ts: Date.now(),
            userId: user?.id || 'local',
            ...data
        };

        this.operations.push(operation);
        this.pendingOps.push(operation);

        // Notify listeners
        this.notify('operation', operation);

        console.log('[OperationLog] Logged:', type, data);
        return operation;
    }

    /**
     * Generate unique operation ID
     */
    generateOpId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // ========== Operation Shortcuts ==========

    addNode(nodeId, nodeData) {
        return this.log('ADD_NODE', { nodeId, data: nodeData });
    }

    updateNode(nodeId, changes) {
        return this.log('UPDATE_NODE', { nodeId, changes });
    }

    deleteNode(nodeId) {
        return this.log('DELETE_NODE', { nodeId });
    }

    moveNode(nodeId, x, y) {
        return this.log('UPDATE_NODE', {
            nodeId,
            changes: { x, y }
        });
    }

    addConnection(connectionId, fromNodeId, toNodeId, data = {}) {
        return this.log('ADD_CONNECTION', {
            connectionId,
            from: fromNodeId,
            to: toNodeId,
            data
        });
    }

    deleteConnection(connectionId) {
        return this.log('DELETE_CONNECTION', { connectionId });
    }

    // ========== Merge Operations ==========

    /**
     * Merge incoming remote operations with local state
     * @param {Array} remoteOps - Operations from remote peer
     * @returns {Array} Operations to apply locally
     */
    merge(remoteOps) {
        const toApply = [];

        for (const op of remoteOps) {
            // Skip already applied
            if (this.appliedOpIds.has(op.id)) continue;

            // Check for conflicts
            const conflict = this.findConflict(op);

            if (!conflict) {
                // No conflict, apply directly
                toApply.push(op);
                this.appliedOpIds.add(op.id);
            } else {
                // Resolve conflict
                const resolved = this.resolveConflict(op, conflict);
                if (resolved) {
                    toApply.push(resolved);
                    this.appliedOpIds.add(op.id);
                }
            }
        }

        // Add to our log
        this.operations.push(...toApply);

        return toApply;
    }

    /**
     * Find conflicting local operation
     */
    findConflict(remoteOp) {
        // Look for operations on the same entity
        const entityId = remoteOp.nodeId || remoteOp.connectionId;
        if (!entityId) return null;

        // Find concurrent local ops on same entity
        return this.operations.find(localOp => {
            const localEntityId = localOp.nodeId || localOp.connectionId;
            return localEntityId === entityId &&
                Math.abs(localOp.ts - remoteOp.ts) < 5000 && // Within 5 seconds
                localOp.userId !== remoteOp.userId;
        });
    }

    /**
     * Resolve conflict between operations
     */
    resolveConflict(remoteOp, localOp) {
        // DELETE always wins (tombstone)
        if (remoteOp.op === 'DELETE_NODE' || remoteOp.op === 'DELETE_CONNECTION') {
            return remoteOp;
        }

        if (localOp.op === 'DELETE_NODE' || localOp.op === 'DELETE_CONNECTION') {
            return null; // Local delete wins, ignore remote update
        }

        // For UPDATE operations: merge per-property with LWW
        if (remoteOp.op === 'UPDATE_NODE' && localOp.op === 'UPDATE_NODE') {
            const mergedChanges = { ...localOp.changes };

            for (const [key, value] of Object.entries(remoteOp.changes || {})) {
                // If remote is newer for this property, use it
                if (remoteOp.ts > localOp.ts) {
                    mergedChanges[key] = value;
                }
            }

            return {
                ...remoteOp,
                changes: mergedChanges
            };
        }

        // For ADD: both are kept (different IDs guaranteed)
        if (remoteOp.op === 'ADD_NODE' || remoteOp.op === 'ADD_CONNECTION') {
            return remoteOp;
        }

        // Default: LWW
        return remoteOp.ts > localOp.ts ? remoteOp : null;
    }

    // ========== Pending Operations ==========

    /**
     * Get pending operations for sync
     */
    getPendingOps() {
        return [...this.pendingOps];
    }

    /**
     * Clear pending operations after sync
     */
    clearPending() {
        this.pendingOps = [];
    }

    /**
     * Mark operations as synced
     */
    markSynced(opIds) {
        this.pendingOps = this.pendingOps.filter(op => !opIds.includes(op.id));
    }

    // ========== Event System ==========

    /**
     * Add listener for operation events
     */
    on(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notify(event, data) {
        this.listeners.forEach(cb => {
            try {
                cb(event, data);
            } catch (err) {
                console.error('[OperationLog] Listener error:', err);
            }
        });
    }

    // ========== Serialization ==========

    toJSON() {
        return {
            projectId: this.projectId,
            operations: this.operations
        };
    }

    static fromJSON(json) {
        const log = new OperationLog(json.projectId);
        log.operations = json.operations || [];
        log.appliedOpIds = new Set(log.operations.map(op => op.id));
        return log;
    }
}

// Export
window.OperationLog = OperationLog;
