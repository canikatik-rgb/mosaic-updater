/**
 * NodeLoader.js
 * Responsible for loading external HTML-based nodes into the canvas.
 * Refactored to match Legacy Node structure (Strip, Pins, Resize).
 */

class NodeLoader {
    constructor() {
        this.nodeTypeCache = new Map();
        this.baseUrl = 'node_types/';
    }

    /**
     * Creates a new node instance on the canvas.
     * @param {string} type - The directory name of the node type
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {object} data - Initial data
     * @param {string} id - Optional explicit ID
     */
    createNode(type, x, y, data = {}, id = null) {
        const nodeId = id || 'node-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

        // 1. Create Container (Standard .node class for consistency)
        const container = document.createElement('div');
        container.classList.add('node', 'app-node'); // 'app-node' for specific overrides
        container.id = nodeId;
        container.style.left = x + 'px';
        container.style.top = y + 'px';
        container.dataset.type = type;

        // Set default dimensions - URL nodes need more height for web content
        const isUrlNode = (type === 'url_node');
        const defaultWidth = isUrlNode ? 700 : 400;
        const defaultHeight = isUrlNode ? 550 : 300;

        container.style.width = (data.width || defaultWidth) + 'px';
        container.style.height = (data.height || defaultHeight) + 'px';

        // --- NEW HEADER STRUCTURE ---
        const header = document.createElement('div');
        header.classList.add('node-header');

        // Icon Wrapper
        const iconWrapper = document.createElement('div');
        iconWrapper.classList.add('node-icon-wrapper');
        // Set background color from data or metadata default (using stripColors for now as fallback)
        const nodeColor = (data && data.color) ? data.color : (window.stripColors ? window.stripColors[0] : '#c2f8cb');
        iconWrapper.style.backgroundColor = nodeColor;

        // Icon
        const icon = document.createElement('i');
        icon.classList.add('fas'); // FontAwesome solid
        // Determine icon class from registry or type
        let iconClass = 'fa-cube'; // Default
        if (window.appNodeRegistry) {
            const meta = window.appNodeRegistry.find(n => n.type === type);
            if (meta && meta.icon) iconClass = meta.icon;
        }
        icon.classList.add(iconClass);
        iconWrapper.appendChild(icon);
        header.appendChild(iconWrapper);

        // Title
        const title = document.createElement('div');
        title.classList.add('node-title');
        title.contentEditable = 'true';

        // Get node name from registry
        let defaultTitle = 'New Node';
        if (window.appNodeRegistry) {
            const meta = window.appNodeRegistry.find(n => n.id === type || n.type === type);
            if (meta && meta.name) {
                const lang = window.currentLanguage || 'en';
                defaultTitle = meta.name[lang] || meta.name['en'] || meta.name[Object.keys(meta.name)[0]] || 'New Node';
            }
        }

        title.innerText = (data && data.title) ? data.title : defaultTitle;

        // Save title on blur
        title.addEventListener('blur', () => {
            const newTitle = title.innerText.trim();
            if (newTitle) {
                container.dataset.nodeTitle = newTitle;
                // Auto-save
                if (window.scheduleAutoSave) window.scheduleAutoSave();
            }
        });

        // Prevent enter key from creating new line
        title.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                title.blur(); // Exit edit mode  
            }
        });

        header.appendChild(title);

        // Minimize Button (Replaces Three Dots)
        const minimizeBtn = document.createElement('div');
        minimizeBtn.classList.add('node-menu-btn'); // Reuse class for styling
        minimizeBtn.innerHTML = '<i class="fas fa-minus"></i>';
        minimizeBtn.title = 'Minimize';

        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const content = container.querySelector('.content');
            const isMinimized = container.classList.toggle('minimized');

            if (isMinimized) {
                // Minimize Action

                // 1. Store current height before hiding
                // Use computed style or inline style fallback
                const currentHeight = container.style.height || container.offsetHeight + 'px';
                container.dataset.prevHeight = currentHeight;

                // 2. Hide Content completely to stop rendering cost
                content.style.display = 'none';

                // 3. Force Container Height to Header only (40px)
                container.style.height = '40px';
                container.style.minHeight = '40px'; // Override any CSS min-height

                // 4. Disable Resizing
                container.style.resize = 'none';

                minimizeBtn.innerHTML = '<i class="far fa-window-maximize"></i>';
                minimizeBtn.title = 'Maximize';

            } else {
                // Restore Action

                // 1. Restore Content
                // CRITICAL FIX: Reset display to empty to respect CSS 'display: flex' class
                // Setting 'block' broke the internal flex layout for the iframe.
                content.style.display = '';

                // 2. Restore Height
                let prevHeight = container.dataset.prevHeight;
                if (!prevHeight || prevHeight === '40px' || prevHeight === 'auto') {
                    // Fallback if invalid
                    prevHeight = (data && data.height) ? data.height + 'px' : '400px';
                }
                container.style.height = prevHeight;
                container.style.minHeight = ''; // Remove override

                // Remove manual height override as Flexbox should handle it now
                content.style.height = '';

                // 3. Re-enable Resize
                container.style.resize = 'both';

                // 4. Update Icon
                minimizeBtn.innerHTML = '<i class="fas fa-minus"></i>';
                minimizeBtn.title = 'Minimize';

                // 5. Post-Restore Fixes
                // Trigger resize to fix any iframe layout glitches
                if (container.querySelector('iframe')) {
                    window.dispatchEvent(new Event('resize'));
                    // Also try to tickle the iframe itself if possible
                    // const frame = container.querySelector('iframe');
                    // if(frame.contentWindow) frame.contentWindow.dispatchEvent(new Event('resize'));
                }
            }
        });

        header.appendChild(minimizeBtn);

        container.appendChild(header);

        // --- CRITICAL FIX: Synchronous State Persistence ---
        if (data) {
            container.dataset.savedState = JSON.stringify(data);
        }

        // 3. Create Content Wrapper
        const content = document.createElement('div');
        content.classList.add('content', 'app-content');

        // --- Click Shield & Edit Overlay ---
        // The shield now acts as the hover overlay container too
        const shield = document.createElement('div');
        shield.classList.add('node-shield');

        // "Click to Edit" Button/Overlay
        const editOverlay = document.createElement('div');
        editOverlay.classList.add('node-edit-overlay');
        editOverlay.innerHTML = '<span>Düzenlemek İçin Tıkla</span>';
        shield.appendChild(editOverlay);

        content.appendChild(shield);

        // --- Iframe OR Webview Container OR Shadow DOM ---
        // CRITICAL FIX: The 'url_node' uses a nested <webview> tag.
        // Electron DOES NOT support <webview> tags inside <iframe> tags.
        // We must inject the URL Node's HTML directly into the main DOM using Shadow DOM.

        let nodeFrame;

        if (isUrlNode) {
            // Shadow DOM Host
            nodeFrame = document.createElement('div');
            nodeFrame.classList.add('node-iframe');
            nodeFrame.style.display = 'flex';
            nodeFrame.style.flexDirection = 'column';
            nodeFrame.style.background = '#fff';

            // CRITICAL FIX: Stop Drag Propagation
            // Because this is a div (not an iframe), clicks bubble up to the draggable container.
            // We must stop propagation for interactions to work.
            nodeFrame.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            // Also stop wheel/scroll propagation if needed, but focus is key
            nodeFrame.addEventListener('pointerdown', (e) => e.stopPropagation());

            // FETCH & INJECT
            fetch(`${this.baseUrl}${type}/index.html`)
                .then(response => response.text())
                .then(html => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    const shadow = nodeFrame.attachShadow({ mode: 'open' });

                    // 1. Inject Styles
                    const styleElements = doc.querySelectorAll('style');
                    styleElements.forEach(style => shadow.appendChild(style.cloneNode(true)));

                    // 2. Inject Body
                    const bodyContent = doc.body.innerHTML;
                    const wrapper = document.createElement('div');
                    wrapper.style.width = '100%';
                    wrapper.style.height = '100%';
                    wrapper.style.display = 'flex';
                    wrapper.style.flexDirection = 'column';
                    wrapper.innerHTML = bodyContent;

                    // --- FORCE USER AGENT SPOOF ON WEBVIEW ---
                    const webviewEl = wrapper.querySelector('webview');
                    if (webviewEl) {
                        // Hardcoded Spoof to match Main Process logic (Chrome 146)
                        const spoofUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
                        webviewEl.setAttribute('useragent', spoofUA);

                        // CRITICAL: Enable Plugins for Widevine DRM
                        webviewEl.setAttribute('plugins', '');

                        // Use persistent partition for DRM license storage
                        webviewEl.setAttribute('partition', 'persist:webview');

                        // Set webpreferences for DRM
                        webviewEl.setAttribute('webpreferences', 'plugins=true, contextIsolation=false');

                        // Optional: Allow popups/media checks
                        webviewEl.setAttribute('allowpopups', '');

                        console.log('[NodeLoader] Webview configured for DRM:', {
                            plugins: true,
                            partition: 'persist:webview',
                            useragent: spoofUA.substring(0, 50) + '...'
                        });
                    }

                    shadow.appendChild(wrapper);

                    // 3. Shim & Run Scripts
                    // FIX: MosaicNode is not available in main process, so we mock it.
                    const scopedMosaic = {
                        id: nodeId,
                        getNodeId: () => nodeId,
                        send: function (payload) {
                            // Will be overridden or used by bindShadowNodePoints
                            if (this.sendOutput) this.sendOutput(payload);
                        },
                        saveData: null,
                        onDataLoaded: null
                    };

                    // Bind communication immediately
                    this.bindShadowNodePoints(scopedMosaic, nodeId, data);

                    const scripts = doc.querySelectorAll('script');
                    scripts.forEach(script => {
                        if (script.src) {
                            if (script.src.includes('MosaicNode.js')) return;
                            const newScript = document.createElement('script');
                            newScript.setAttribute('defer', ''); // wait for main script
                            newScript.src = script.src;
                            shadow.appendChild(newScript);
                        } else {
                            // Inline Script: Defines 'window.initUrlNode'
                            try {
                                const func = new Function(script.textContent);
                                func();
                            } catch (e) {
                                console.error('Error defining init function:', e);
                            }
                        }
                    });

                    // Call the init function
                    setTimeout(() => {
                        if (window.initUrlNode) {
                            try {
                                console.log('[NodeLoader] Initializing URL Node with Shadow Scope');
                                const instance = window.initUrlNode(shadow, scopedMosaic);

                                // Trigger Data Load
                                if (instance && instance.loadData) {
                                    instance.loadData(data);
                                } else if (scopedMosaic.onDataLoaded) {
                                    scopedMosaic.onDataLoaded(data);
                                }
                            } catch (e) {
                                console.error('[NodeLoader] Failed to init URL Node:', e);
                            }
                        } else {
                            console.error('[NodeLoader] window.initUrlNode is not defined!');
                        }
                    }, 50);
                });

        } else {
            // Standard Iframe for other nodes
            nodeFrame = document.createElement('iframe');
            nodeFrame.classList.add('node-iframe');
            nodeFrame.src = `${this.baseUrl}${type}/index.html`;
            nodeFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');

            nodeFrame.onload = () => {
                this.initNodeCommunication(nodeFrame, nodeId, data);
            };
        }

        content.appendChild(nodeFrame);
        container.appendChild(content);

        // 4. Create Standard Pins
        this.createStandardPins(container);

        // 5. Append to Canvas Content
        const canvasContent = document.getElementById('canvas-content');
        if (canvasContent) {
            canvasContent.appendChild(container);
        } else {
            console.error("NodeLoader: canvas-content not found!");
            document.getElementById('canvas').appendChild(container);
        }

        // 6. Setup Interactions (Legacy-style)
        this.setupInteractions(container, shield, header); // Pass header for drag

        // 7. Make Resizable using Legacy Logic
        if (window.makeNodeResizable) {
            window.makeNodeResizable(container);
        }

        return container;
    }

    createStandardPins(container) {
        // Create standard pins exactly like legacy nodes
        const leftPin = document.createElement('div');
        leftPin.classList.add('pin', 'left');
        container.appendChild(leftPin);

        const rightPin = document.createElement('div');
        rightPin.classList.add('pin', 'right');
        container.appendChild(rightPin);

        // Attach listeners using global legacy function if available
        // logic is usually in setupNodeEvents, we will call that.
    }

    setupInteractions(node, shield, header) {
        // const strip = node.querySelector('.strip'); // REPLACED by header
        const content = node.querySelector('.content');
        const leftPin = node.querySelector('.pin.left');
        const rightPin = node.querySelector('.pin.right');

        // Use the global setupNodeEvents to get standard behavior (Drag, Select, Delete via Action Bar)
        if (window.setupNodeEvents) {
            // Passing 'header' as the handle mainly for dragging
            window.setupNodeEvents(node, header, content, leftPin, rightPin, node.dataset.type);
        }

        // --- Shield Logic regarding Overlay ---
        // CHANGE: Only activate via the edit button click OR double-click
        // Clicking anywhere else on shield should NOT activate (allows dragging without accidental edit)

        const editButton = shield.querySelector('.node-edit-overlay');

        // Method 1: Click the "Düzenlemek İçin Tıkla" button
        if (editButton) {
            editButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent canvas drag/selection
                this.activateNode(node);
            });
        }

        // Method 2: Double-click anywhere on shield
        shield.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.activateNode(node);
        });

        // 2. Global click outside -> Deactivate App
        // This is handled partly by the 'selected' check, but we need strict "click outside"
        // We'll attach a one-time listener when activated.
    }

    activateNode(node) {
        // Prevent duplicate activation
        if (node.classList.contains('active-app')) {
            console.log('App Node already active:', node.id);
            return;
        }

        node.classList.add('active-app');
        const shield = node.querySelector('.node-shield');
        shield.style.pointerEvents = 'none'; // Let clicks pass to iframe

        console.log('App Node Activated:', node.id);

        // Notify iframe/webview that it's now active
        // Use class selector to support both iframe and webview
        const frame = node.querySelector('.node-iframe');
        // Check for port instead of contentWindow (webview doesn't have contentWindow accessible same way)
        if (frame && node._port) {
            node._port.postMessage({ type: 'MOSAIC_ACTIVATED' });
        }

        // Remove any existing deactivate handler
        if (node._deactivateHandler) {
            document.removeEventListener('mousedown', node._deactivateHandler);
            node._deactivateHandler = null;
        }

        // Create new deactivate handler
        const self = this;
        node._deactivateHandler = (e) => {
            // If click is NOT inside this node
            if (!node.contains(e.target)) {
                console.log('Click outside detected, deactivating:', node.id);
                self.deactivateNode(node);
            }
        };

        // Add listener after a small delay to avoid catching current click
        setTimeout(() => {
            document.addEventListener('mousedown', node._deactivateHandler);
            console.log('Deactivate listener added for:', node.id);
        }, 50);
    }

    deactivateNode(node) {
        // Prevent duplicate deactivation
        if (!node.classList.contains('active-app')) {
            console.log('App Node already inactive:', node.id);
            return;
        }

        node.classList.remove('active-app');
        const shield = node.querySelector('.node-shield');
        shield.style.pointerEvents = 'auto'; // Block iframe again
        console.log('App Node Deactivated:', node.id);

        // Remove the deactivate handler
        if (node._deactivateHandler) {
            document.removeEventListener('mousedown', node._deactivateHandler);
            node._deactivateHandler = null;
            console.log('Deactivate listener removed for:', node.id);
        }

        // Notify iframe that editing has ended
        if (node._framePort) {
            console.log('Sending MOSAIC_DEACTIVATED to:', node.id);
            node._framePort.postMessage({ type: 'MOSAIC_DEACTIVATED' });
        }
    }

    bindShadowNodePoints(scopedMosaic, nodeId, initialData) {
        // This acts as a bridge between the Main NodeSystem and the Shadow DOM Node
        // It replays the logic of 'initNodeCommunication' but without MessagePorts.

        const node = document.getElementById(nodeId);
        if (node && initialData) {
            node.dataset.savedState = JSON.stringify(initialData);
        }

        // Intercept 'sendOutput' / 'saveData' from the scoped Mosaic instance
        // The script calls scopedMosaic.send({ ... })
        // We override the postMessage simulation

        scopedMosaic.sendOutput = (payload) => {
            console.log(`[NodeLoader] Direct Output from ${nodeId}:`, payload);

            // 1. Store on DOM element
            const outputNode = document.getElementById(nodeId);
            if (outputNode) {
                outputNode._lastOutput = payload;
                outputNode._hasOutput = true;
            }

            // 2. Add to DataCardStore for focus panel display
            if (window.dataCardStore) {
                window.dataCardStore.addPacket(nodeId, payload, 'local', { liveUpdate: true });
            }

            // 3. Notify System
            if (window.nodeSystem && window.nodeSystem.onNodeOutput) {
                window.nodeSystem.onNodeOutput(nodeId, payload);
            }

            // 4. FORCE PROPAGATION (Fix for shimmed nodes)
            // Legacy nodes rely on 'MOSAIC_OUTPUT' message handler which calls triggerNodeUpdate & deliverInputToNode
            // We must manually trigger that here since we bypassed the message port.

            // A. Trigger System Update
            if (window.nodeSystem && window.nodeSystem.triggerNodeUpdate) {
                window.nodeSystem.triggerNodeUpdate(nodeId);
            }

            // B. Relay to Connected Nodes
            if (window.connections && Array.isArray(window.connections)) {
                const targets = window.connections
                    .filter(conn => conn.source === nodeId)
                    .map(conn => conn.target);

                console.log(`[NodeLoader] Direct Relay to ${targets.length} targets:`, targets);

                targets.forEach(targetId => {
                    this.deliverInputToNode(targetId, payload, nodeId);
                });
            }
        };

        scopedMosaic.saveData = (data) => {
            console.log(`[NodeLoader] Direct Save State for ${nodeId}:`, data);
            const node = document.getElementById(nodeId);
            if (node) node.dataset.savedState = JSON.stringify(data);
        };

        // Initialize Bridge with Node System for INPUTS
        if (window.nodeSystem) {
            window.nodeSystem.registerNode(nodeId, {
                getOutput: () => {
                    // Logic similar to initNodeCommunication but simpler
                    const node = document.getElementById(nodeId);
                    return node ? node._lastOutput : null;
                    // No async request needed since we share memory/thread
                },
                onInputUpdate: (targetId, data, sourceId) => {
                    // Directly call the callback on the scoped instance
                    if (scopedMosaic.inputCallback) {
                        scopedMosaic.inputCallback(data, sourceId);
                    }
                },
                onInputDisconnect: (targetId, sourceId) => {
                    if (scopedMosaic.disconnectCallback) {
                        scopedMosaic.disconnectCallback(sourceId);
                    }
                }
            });

            // REMOVED: Don't force sync on node init - let live data flow start naturally
            // Saved DataCardStore data is already loaded, no need to re-propagate
            // setTimeout(() => {
            //     window.nodeSystem.updateNodeInputs(nodeId);
            // }, 100);
        }
    }

    initNodeCommunication(nodeFrame, nodeId, initialData) {
        // Detect if we are dealing with a <webview> or <iframe>
        const isWebview = nodeFrame.tagName === 'WEBVIEW';

        // For iframes, we need contentWindow. For webviews, we use the element itself.
        const win = isWebview ? null : nodeFrame.contentWindow;

        if (!isWebview && !win) return;

        const channel = new MessageChannel();
        const port1 = channel.port1;
        const port2 = channel.port2;

        if (isWebview) {
            // Webview postMessage API
            // Note: targetOrigin is required, '*' works. Transferables are the 3rd argument.
            try {
                nodeFrame.postMessage({ type: 'INIT_PORT' }, '*', [port2]);
            } catch (e) {
                console.error('[NodeLoader] Failed to post message to webview:', e);
            }
        } else {
            // Iframe postMessage API
            win.postMessage({ type: 'INIT_PORT' }, '*', [port2]);
        }

        // Keep port alive and debuggable
        // Initialize savedState on the DOM element so it's ready for saving immediately
        const node = document.getElementById(nodeId);
        if (node && initialData) {
            node.dataset.savedState = JSON.stringify(initialData);
        }

        window.activePorts = window.activePorts || [];
        window.activePorts.push({ id: nodeId, port: port1 });

        // Store port on DOM element for external access (e.g. broadcasting)
        const nodeEl = document.getElementById(nodeId);
        if (nodeEl) {
            nodeEl._framePort = port1;
        }

        // Initialize Bridge with Node System
        if (window.nodeSystem) {
            window.nodeSystem.registerNode(nodeId, {
                getOutput: () => {
                    // If the node hasn't sent data yet, we might not have it.
                    // Request a fresh update for future (async) but return cache for now.
                    const node = document.getElementById(nodeId);
                    if (!node) {
                        return null; // Node might be deleted/detached
                    }

                    // Request fresh data ONLY if we don't have it
                    if (port1 && !node._lastOutput) {
                        console.log('[NodeLoader] Requesting fresh output from:', nodeId);
                        port1.postMessage({ type: 'MOSAIC_REQUEST_OUTPUT' });
                    }

                    return node._lastOutput || null;
                },
                onInputUpdate: (targetId, data, sourceId) => {
                    // Send Input to Iframe with Source ID to distinguish inputs
                    port1.postMessage({
                        type: 'MOSAIC_INPUT',
                        payload: data,
                        sourceId: sourceId
                    });
                },
                onInputDisconnect: (targetId, sourceId) => {
                    port1.postMessage({
                        type: 'MOSAIC_DISCONNECT',
                        sourceId: sourceId
                    });
                }
            });
        } else {
            console.error('[NodeLoader] CRITICAL: window.nodeSystem is undefined! Node communication will be limited.');
        }

        // REMOVED: Don't force sync on node init - let live data flow start naturally
        // Saved DataCardStore data is already loaded, connections will propagate on user interaction
        // setTimeout(() => {
        //     if (window.nodeSystem && window.nodeSystem.updateNodeInputs) {
        //         console.log(`[NodeLoader] Force-syncing inputs for ${nodeId} (Delayed 1000ms)`);
        //         window.nodeSystem.updateNodeInputs(nodeId);
        //     }
        // }, 1000);

        port1.onmessage = (e) => {
            const msg = e.data;
            console.log('[NodeLoader] RAW PORT MESSAGE:', msg); // DEBUG
            switch (msg.type) {
                case 'RESIZE':
                    this.handleResize(nodeId, msg.width, msg.height);
                    break;
                case 'DATA_UPDATE':
                    const node = document.getElementById(nodeId);
                    if (node) node.dataset.savedState = JSON.stringify(msg.payload);
                    break;
                case 'MOSAIC_OUTPUT':
                    console.log(`[NodeLoader] Output from ${nodeId}:`, msg.payload);

                    // 1. Store on DOM element
                    const outputNode = document.getElementById(nodeId);
                    if (outputNode) {
                        outputNode._lastOutput = msg.payload;
                        outputNode._hasOutput = true;
                    }

                    // 2. Add to DataCardStore for focus panel display
                    if (window.dataCardStore) {
                        window.dataCardStore.addPacket(nodeId, msg.payload, 'local', { liveUpdate: true });
                    }

                    // 3. Trigger System Update (for legacy compatibility)
                    if (window.nodeSystem) {
                        window.nodeSystem.triggerNodeUpdate(nodeId);
                    }

                    // 4. RELAY TO CONNECTED NODES
                    // Find targets from global connections array
                    if (window.connections && Array.isArray(window.connections)) {
                        const targets = window.connections
                            .filter(conn => conn.source === nodeId)
                            .map(conn => conn.target);

                        console.log(`[NodeLoader] Relaying to ${targets.length} targets:`, targets);

                        targets.forEach(targetId => {
                            this.deliverInputToNode(targetId, msg.payload, nodeId);
                        });
                    } else {
                        console.warn('[NodeLoader] window.connections not available');
                    }
                    break;
            }
        };

        port1.postMessage({
            type: 'INIT_DATA',
            payload: {
                ...initialData,
                nodeId: nodeId,
                language: window.currentLanguage || 'en'
            }
        });
    }

    deliverInputToNode(targetId, data, sourceId) {
        console.log(`[NodeLoader] Delivering input to ${targetId} from ${sourceId}`, data);

        const targetNode = document.getElementById(targetId);
        if (!targetNode) {
            console.warn(`[NodeLoader] Target node ${targetId} not found`);
            return;
        }

        // Get source node title
        let sourceTitle = 'Connected Node';
        const sourceNode = document.getElementById(sourceId);
        if (sourceNode) {
            const titleEl = sourceNode.querySelector('.node-title');
            if (titleEl) {
                sourceTitle = titleEl.innerText.trim() || 'Connected Node';
            }
        }

        // Add sourceId and sourceTitle to data
        const payload = {
            ...data,
            sourceId: sourceId,
            sourceTitle: sourceTitle
        };

        // Check if V2 node (has _framePort)
        if (targetNode._framePort) {
            console.log(`[NodeLoader] Sending to V2 node ${targetId} via MessagePort`);
            targetNode._framePort.postMessage({
                type: 'MOSAIC_INPUT',
                payload: payload,
                sourceId: sourceId
            });
        }
        // Legacy node support
        else if (window.nodeSystem && window.nodeSystem.deliverInput) {
            console.log(`[NodeLoader] Sending to legacy node ${targetId} via nodeSystem`);
            window.nodeSystem.deliverInput(targetId, payload, sourceId);
        }
        else {
            console.warn(`[NodeLoader] No delivery method found for ${targetId}`);
        }
    }

    handleResize(nodeId, width, height) {
        const node = document.getElementById(nodeId);
        if (node) {
            // Update node dimensions
            node.style.width = width + 'px';
            const content = node.querySelector('.content');
            if (content) content.style.height = height + 'px';
        }
    }

    broadcastLanguage(lang) {
        console.log(`[NodeLoader] Broadcasting language update: ${lang}`);
        const nodes = document.querySelectorAll('.app-node');
        nodes.forEach(node => {
            if (node._framePort) {
                node._framePort.postMessage({
                    type: 'LANGUAGE_UPDATE',
                    payload: lang
                });
            }
        });
    }
}

// Global instance
window.nodeLoader = new NodeLoader();
