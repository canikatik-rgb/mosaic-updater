/**
 * MosaicNode.js
 * The SDK for internal HTML nodes to communicate with the Mosaic Host.
 * Include this script in every node_types/[type]/index.html
 */

class MosaicNode {
    constructor() {
        this.port = null;
        this.data = {};
        this.inputCallback = null;
        this.disconnectCallback = null;
        this.onDataLoaded = (data) => { }; // Default no-op
        this.id = null;

        window.addEventListener('message', (e) => {
            if (e.data.type === 'INIT_PORT') {
                this.port = e.ports[0];
                this.initPortListeners();
                console.log('[MosaicNode] Port initialized');
            }
        });
    }

    /**
     * Send output data to connected nodes
     * @param {object|any} payload - The data to send
     */
    sendOutput(data) {
        if (this.port) {
            // SDP Integration: Auto-wrap raw data
            // We assume SDP.js is loaded globally. If not, we fallback to raw.
            let packet = data;

            if (window.SDP && window.SDP.MosaicData) {
                // If it's not already a MosaicData object (duck typing check), wrap it
                if (!window.SDP.MosaicData.validate(data)) {
                    // Try to infer type or generic JSON
                    console.warn('[MosaicNode] Auto-wrapping raw output to SDP.');
                    packet = window.SDP.MosaicData.wrap(data);
                }

                // Ensure source metadata is set
                if (!packet.metadata.source || packet.metadata.source === 'System') {
                    packet.metadata.source = this.id || 'AnonymousNode';
                }
            }

            console.log('[MosaicNode] Sending via Port:', this.port, 'Packet:', packet);
            try {
                this.port.postMessage({ type: 'MOSAIC_OUTPUT', payload: packet });
                console.log('[MosaicNode] Sent successfully');
            } catch (err) {
                console.error('[MosaicNode] Send Failed:', err);
            }
        } else {
            console.error('[MosaicNode] Port not initialized! Cannot send:', data);
        }
    }


    /**
     * Register a callback for when input data is received
     * @param {function} callback - (payload) => {}
     */
    saveData(data) {
        if (this.port) {
            console.log('[MosaicNode] Saving State:', data);
            this.port.postMessage({ type: 'DATA_UPDATE', payload: data });
        }
    }

    onInput(callback) {
        this.inputCallback = callback;
    }

    /**
     * Internal: Handle incoming messages
     */
    initPortListeners() {
        this.port.onmessage = (e) => {
            const msg = e.data;
            switch (msg.type) {
                case 'INIT_DATA':
                    this.data = msg.payload || {};
                    // Store nodeId
                    if (this.data.nodeId) {
                        this.id = this.data.nodeId;
                    }
                    // Auto-set language if present
                    if (this.data.language) {
                        window.currentLanguage = this.data.language;
                    }
                    this.onDataLoaded(this.data);
                    break;
                case 'LANGUAGE_UPDATE':
                    console.log('[MosaicNode] Language update:', msg.payload);
                    window.currentLanguage = msg.payload;
                    // Auto-call applyTranslations if defined by the node
                    if (typeof window.applyTranslations === 'function') {
                        window.applyTranslations();
                    }
                    break;
                case 'MOSAIC_INPUT':
                    if (this.inputCallback) {
                        // Pass payload AND sourceId
                        this.inputCallback(msg.payload, msg.sourceId);
                    }
                    break;
                case 'MOSAIC_DISCONNECT':
                    if (this.disconnectCallback) {
                        this.disconnectCallback(msg.sourceId);
                    }
                    break;
                case 'MOSAIC_REQUEST_OUTPUT':
                    if (this.requestOutputCallback) {
                        this.requestOutputCallback();
                    } else if (this._cachedOutput) { // Auto-reply with cached output if no specific callback
                        console.log('[MosaicNode] Auto-replying with cached output');
                        this.sendOutput(this._cachedOutput);
                    }
                    break;
                case 'MOSAIC_DEACTIVATED':
                    console.log('[MosaicNode] Node deactivated - editing ended');
                    if (this.deactivateCallback) {
                        this.deactivateCallback();
                    }
                    break;
                case 'MOSAIC_ACTIVATED':
                    console.log('[MosaicNode] Node activated - editing started');
                    if (this.activateCallback) {
                        this.activateCallback();
                    }
                    break;
            }
        };
    }

    // --- Aliases for cleaner API ---
    send(payload) { this.sendOutput(payload); }
    onInput(callback) { this.inputCallback = callback; }
    onDisconnect(callback) { this.disconnectCallback = callback; }
    onDeactivate(callback) { this.deactivateCallback = callback; }
    onActivate(callback) { this.activateCallback = callback; }
    getNodeId() { return this.id; }

    on(event, callback) {
        if (event === 'input') this.onInput(callback);
        if (event === 'disconnect') this.onDisconnect(callback);
        if (event === 'deactivate') this.onDeactivate(callback);
        if (event === 'activate') this.onActivate(callback);
    }
}

window.Mosaic = new MosaicNode();
