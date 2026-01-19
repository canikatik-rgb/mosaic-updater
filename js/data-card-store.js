/**
 * DataCardStore.js
 * Central store for managing data packets flowing between nodes.
 * Enables typed previews, chain propagation, and update notifications.
 */

class DataCardStore {
    constructor() {
        // nodeId -> Array of DataPackets (outgoing from this node)
        this.outgoingPackets = new Map();

        // nodeId -> Array of DataPackets (incoming to this node)
        this.incomingPackets = new Map();

        // Update listeners
        this.listeners = new Set();

        console.log('[DataCardStore] Initialized');
    }

    /**
     * Create a standardized data packet
     * @param {string} sourceNodeId - Origin node ID
     * @param {object} rawData - Raw data from node output
     * @returns {object} DataPacket
     */
    createPacket(sourceNodeId, rawData) {
        const sourceNode = document.getElementById(sourceNodeId);
        const sourceTitle = sourceNode?.querySelector('.node-title')?.textContent ||
            sourceNode?.dataset.nodeTitle ||
            'Unknown Node';

        return {
            id: 'packet-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            sourceNodeId: sourceNodeId,
            sourceTitle: sourceTitle,
            type: rawData.type || 'text',
            timestamp: Date.now(),
            // File-backed storage
            filePath: rawData.filePath || null,
            fileName: rawData.fileName || null,
            fileSize: rawData.fileSize || null,
            // Inline data (for small content or as fallback)
            data: rawData
        };
    }

    /**
     * Create packet with auto file-backing for large content
     * @param {string} sourceNodeId - Origin node ID
     * @param {object} rawData - Raw data with type and content
     * @returns {Promise<object>} DataPacket with filePath if file was written
     */
    async createPacketWithFile(sourceNodeId, rawData) {
        const packet = this.createPacket(sourceNodeId, rawData);

        // Check if content should be file-backed
        const shouldWriteFile = this.shouldUseFile(rawData);

        if (shouldWriteFile && window.electronAPI?.writeCardFile) {
            try {
                const content = this.getContentForFile(rawData);
                const result = await window.electronAPI.writeCardFile(
                    packet.id,
                    rawData.type,
                    content,
                    rawData.extension || null
                );

                if (result?.success) {
                    packet.filePath = result.filePath;
                    console.log(`[DataCardStore] File written for packet: ${packet.filePath}`);
                }
            } catch (err) {
                console.warn('[DataCardStore] File write failed, using inline:', err.message);
            }
        }

        return packet;
    }

    /**
     * Determine if content should be file-backed
     * @param {object} rawData 
     * @returns {boolean}
     */
    shouldUseFile(rawData) {
        const type = rawData.type;

        // Always file-back these types
        if (['image', 'file', 'svg'].includes(type)) {
            return true;
        }

        // For text, check size (> 10KB = file)
        if (type === 'text') {
            const content = rawData.content || rawData.value || rawData.data?.content || '';
            return content.length > 10 * 1024;
        }

        return false;
    }

    /**
     * Extract content for file writing from rawData
     * @param {object} rawData 
     * @returns {string|Buffer}
     */
    getContentForFile(rawData) {
        const type = rawData.type;

        if (type === 'image') {
            // Return base64 data URL for images
            return rawData.dataUrl || rawData.value || rawData.data?.dataUrl || '';
        } else if (type === 'svg') {
            return rawData.content || rawData.value || rawData.data?.content || '';
        } else if (type === 'text' || type === 'html') {
            return rawData.content || rawData.value || rawData.data?.content || '';
        } else {
            // Binary or unknown
            return rawData.buffer || rawData.content || '';
        }
    }

    /**
     * Add/update a packet from a node's output
     * @param {string} nodeId - Source node ID
     * @param {object} payload - Raw data from node OR full packet if remote
     * @param {string} source - 'local' or 'remote'
     * @param {object} options - { replaceId: string } to replace specific packet
     */
    addPacket(nodeId, payload, source = 'local', options = {}) {
        nodeId = String(nodeId);
        let packet;

        if (source === 'remote') {
            // Use the full packet as received from peer
            packet = payload;
        } else {
            // Create new packet from raw data
            packet = this.createPacket(nodeId, payload);
        }

        // Store as outgoing for source node
        if (!this.outgoingPackets.has(nodeId)) {
            this.outgoingPackets.set(nodeId, []);
        }

        const outgoing = this.outgoingPackets.get(nodeId);

        // Check if we should replace a specific packet by ID
        if (options.replaceId) {
            const existingIndex = outgoing.findIndex(p => p.id === options.replaceId);
            if (existingIndex >= 0) {
                // Preserve the original ID when replacing
                packet.id = options.replaceId;
                outgoing[existingIndex] = packet;
                console.log(`[DataCardStore] Replaced packet ${options.replaceId} from ${nodeId}`);
            } else {
                // ID not found, append as new
                outgoing.push(packet);
                console.log(`[DataCardStore] Added new packet to ${nodeId} (replace ID not found)`);
            }
        } else if (options.liveUpdate) {
            // Live updates replace existing packet of same type (for text nodes, etc.)
            const existingIndex = outgoing.findIndex(p => p.type === packet.type);
            if (existingIndex >= 0) {
                // Preserve existing ID for live updates
                packet.id = outgoing[existingIndex].id;
                outgoing[existingIndex] = packet;
                console.log(`[DataCardStore] Live update replaced ${packet.type} from ${nodeId}`);
            } else {
                outgoing.push(packet);
                console.log(`[DataCardStore] Live update added new ${packet.type} to ${nodeId}`);
            }
        } else {
            // Manual add: Always append as new packet
            outgoing.push(packet);
            console.log(`[DataCardStore] Added packet from ${nodeId} (${source}):`, packet.type);
        }

        // Propagate through chain
        this.propagatePacket(packet, nodeId);

        // Notify UI listeners
        this.notifyListeners(nodeId, packet, 'update');

        // Notify Network (Broadcast) if local
        if (source === 'local' && this.storeUpdateCallback) {
            this.storeUpdateCallback(packet);
        }
    }

    /**
     * Async version of addPacket that auto-creates file-backed storage for large content
     * @param {string} nodeId - Source node ID
     * @param {object} payload - Raw data from node
     * @param {string} source - 'local' or 'remote'
     * @param {object} options - { replaceId: string } to replace specific packet
     * @returns {Promise<object>} The created/updated packet
     */
    async addPacketWithFile(nodeId, payload, source = 'local', options = {}) {
        nodeId = String(nodeId);
        let packet;

        if (source === 'remote') {
            packet = payload;
        } else {
            // Use async version that writes files
            packet = await this.createPacketWithFile(nodeId, payload);
        }

        // Store as outgoing for source node
        if (!this.outgoingPackets.has(nodeId)) {
            this.outgoingPackets.set(nodeId, []);
        }

        const outgoing = this.outgoingPackets.get(nodeId);

        // Same logic as addPacket for replace/liveUpdate
        if (options.replaceId) {
            const existingIndex = outgoing.findIndex(p => p.id === options.replaceId);
            if (existingIndex >= 0) {
                packet.id = options.replaceId;
                outgoing[existingIndex] = packet;
                console.log(`[DataCardStore] Replaced file-backed packet ${options.replaceId}`);
            } else {
                outgoing.push(packet);
            }
        } else if (options.liveUpdate) {
            const existingIndex = outgoing.findIndex(p => p.type === packet.type);
            if (existingIndex >= 0) {
                packet.id = outgoing[existingIndex].id;
                outgoing[existingIndex] = packet;
            } else {
                outgoing.push(packet);
            }
        } else {
            outgoing.push(packet);
            console.log(`[DataCardStore] Added file-backed packet from ${nodeId}:`, packet.type, packet.filePath || '(inline)');
        }

        // Propagate through chain
        this.propagatePacket(packet, nodeId);

        // Notify UI listeners
        this.notifyListeners(nodeId, packet, 'update');

        // Notify Network (Broadcast) if local
        if (source === 'local' && this.storeUpdateCallback) {
            this.storeUpdateCallback(packet);
        }

        return packet;
    }

    /**
     * Register callback for P2P broadcasting
     * @param {Function} callback - (packet) => void
     */
    onStoreUpdate(callback) {
        this.storeUpdateCallback = callback;
    }

    /**
     * Propagate packet through connected node chain
     * @param {object} packet - Data packet to propagate
     * @param {string} sourceNodeId - Origin of the packet
     */
    propagatePacket(packet, sourceNodeId) {
        if (!window.connections || !Array.isArray(window.connections)) {
            // console.warn('[DataCardStore] No connections available');
            return;
        }

        // Find all directly connected targets
        const directTargets = window.connections
            .filter(c => c.source === sourceNodeId)
            .map(c => c.target);

        // BFS through the chain
        const visited = new Set([sourceNodeId]);
        const queue = [...directTargets];

        while (queue.length > 0) {
            const targetId = queue.shift();

            // Prevent self-loops and re-visits
            if (targetId === sourceNodeId || visited.has(targetId)) continue;
            visited.add(targetId);

            // Add packet to this node's incoming
            this.addIncomingPacket(targetId, packet);

            // Find next nodes in chain
            const nextTargets = window.connections
                .filter(c => c.source === targetId)
                .map(c => c.target);

            queue.push(...nextTargets);
        }
    }

    /**
     * Repropagate all outputs from a source to its targets (for new connections)
     * @param {string} sourceNodeId 
     */
    repropagateNodeOutputs(sourceNodeId) {
        const outgoing = this.getOutgoingPackets(sourceNodeId);
        outgoing.forEach(packet => {
            this.propagatePacket(packet, sourceNodeId);
        });
    }

    /**
     * Add packet to a node's incoming store
     * @param {string} nodeId - Target node ID
     * @param {object} packet - Data packet
     */
    addIncomingPacket(nodeId, packet) {
        if (!this.incomingPackets.has(nodeId)) {
            this.incomingPackets.set(nodeId, []);
        }

        const incoming = this.incomingPackets.get(nodeId);

        // Replace existing packet with same ID (live updates replace, new cards append)
        const existingIndex = incoming.findIndex(p => p.id === packet.id);

        if (existingIndex >= 0) {
            // Update existing card
            incoming[existingIndex] = { ...packet, receivedAt: Date.now() };
            console.log(`[DataCardStore] Updated incoming ${packet.id} in ${nodeId}`);
        } else {
            // Append new card
            incoming.push({ ...packet, receivedAt: Date.now() });
            console.log(`[DataCardStore] Added incoming to ${nodeId} from ${packet.sourceNodeId}`);
        }

        // Notify listeners for the target node update
        this.notifyListeners(nodeId, { ...packet, receivedAt: Date.now() }, 'update');
    }

    /**
     * Get all outgoing packets from a node
     * @param {string} nodeId 
     * @returns {Array}
     */
    getOutgoingPackets(nodeId) {
        return this.outgoingPackets.get(String(nodeId)) || [];
    }

    /**
     * Get all incoming packets to a node
     * @param {string} nodeId 
     * @returns {Array}
     */
    getIncomingPackets(nodeId) {
        return this.incomingPackets.get(String(nodeId)) || [];
    }

    /**
     * Subscribe to packet updates
     * @param {Function} callback - (nodeId, packet, eventType) => void
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify all listeners of an update
     * @param {string} nodeId 
     * @param {object} packet 
     * @param {string} eventType 
     */
    notifyListeners(nodeId, packet, eventType) {
        this.listeners.forEach(callback => {
            try {
                callback(nodeId, packet, eventType);
            } catch (e) {
                console.error('[DataCardStore] Listener error:', e);
            }
        });
    }

    /**
     * Clear all packets for a node (when deleted)
     * @param {string} nodeId 
     */
    clearNode(nodeId) {
        this.outgoingPackets.delete(nodeId);
        this.incomingPackets.delete(nodeId);

        // Also clear this node from all incoming stores
        this.incomingPackets.forEach((packets, targetId) => {
            const filtered = packets.filter(p => p.sourceNodeId !== nodeId);
            this.incomingPackets.set(targetId, filtered);
        });

        console.log(`[DataCardStore] Cleared packets for ${nodeId}`);
    }

    /**
     * Replace a packet with new data
     */
    replacePacket(nodeId, packetId, newPacketData) {
        nodeId = String(nodeId);
        if (this.outgoingPackets.has(nodeId)) {
            const packets = this.outgoingPackets.get(nodeId);
            const index = packets.findIndex(p => p.id === packetId);

            if (index !== -1) {
                const oldPacket = packets[index];
                // Merge old packet metadata with new data
                const newPacket = {
                    ...oldPacket,
                    ...newPacketData,
                    // Keep the same ID to preserve references if needed, 
                    // or we could generate new ID if it's a totally different object.
                    // For "Replace", keeping ID is usually better for UX (card stays in place).
                    id: oldPacket.id,
                    timestamp: Date.now()
                };

                packets[index] = newPacket;

                // Notify listeners
                this.notifyListeners(nodeId, newPacket, 'update'); // Use 'update' event

                console.log(`[DataCardStore] Replaced packet ${packetId} in ${nodeId}`);

                // Propagate update to connected nodes
                this.propagatePacket(nodeId, newPacket);

                return newPacket;
            }
        }
        return null;
    }

    /**
     * Remove a specific packet by ID (for delete button)
     * @param {string} nodeId - Node that owns the packet
     * @param {string} packetId - Packet ID to remove
     * @param {string} direction - 'outgoing' or 'incoming'
     */
    removePacket(nodeId, packetId, direction = 'outgoing') {
        const store = direction === 'outgoing' ? this.outgoingPackets : this.incomingPackets;

        if (store.has(nodeId)) {
            const packets = store.get(nodeId);
            const filtered = packets.filter(p => p.id !== packetId);
            store.set(nodeId, filtered);

            console.log(`[DataCardStore] Removed packet ${packetId} from ${nodeId} (${direction})`);
            this.notifyListeners(nodeId, { id: packetId }, 'remove');

            // CASCADE: If removed from outgoing, also remove from all connected incoming stores
            if (direction === 'outgoing') {
                this.cascadeRemovePacket(packetId);
            }
        }
    }

    /**
     * Cascade remove a packet from all incoming stores
     * @param {string} packetId - Packet ID to remove from all incoming stores
     */
    cascadeRemovePacket(packetId) {
        this.incomingPackets.forEach((packets, targetNodeId) => {
            const filtered = packets.filter(p => p.id !== packetId);
            if (filtered.length !== packets.length) {
                this.incomingPackets.set(targetNodeId, filtered);
                this.notifyListeners(targetNodeId, { id: packetId }, 'remove');
                console.log(`[DataCardStore] Cascade removed packet ${packetId} from incoming of ${targetNodeId}`);
            }
        });
    }

    /**
     * Serialize store data for project save
     * @returns {object} Serialized data
     */
    serialize() {
        const data = {
            outgoing: {},
            incoming: {}
        };

        // Serialize outgoing packets
        this.outgoingPackets.forEach((packets, nodeId) => {
            data.outgoing[nodeId] = packets;
        });

        // Serialize incoming packets (optional - can be repropagated on load)
        this.incomingPackets.forEach((packets, nodeId) => {
            data.incoming[nodeId] = packets;
        });

        console.log('[DataCardStore] Serialized:', Object.keys(data.outgoing).length, 'nodes');
        return data;
    }

    /**
     * Deserialize and restore store data from project load
     * @param {object} data - Serialized data from project file
     */
    deserialize(data) {
        if (!data) return;

        // Clear current data
        this.outgoingPackets.clear();
        this.incomingPackets.clear();

        // Restore outgoing packets
        if (data.outgoing) {
            Object.entries(data.outgoing).forEach(([nodeId, packets]) => {
                this.outgoingPackets.set(String(nodeId), packets);
            });
        }

        // Restore incoming packets
        if (data.incoming) {
            Object.entries(data.incoming).forEach(([nodeId, packets]) => {
                this.incomingPackets.set(String(nodeId), packets);
            });
        }

        console.log('[DataCardStore] Deserialized:', this.outgoingPackets.size, 'nodes restored');
    }

    /**
     * Reset entire store (project change)
     */
    reset() {
        this.outgoingPackets.clear();
        this.incomingPackets.clear();
        console.log('[DataCardStore] Store reset');
    }
}

// Global instance
window.dataCardStore = new DataCardStore();
