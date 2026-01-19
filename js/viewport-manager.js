/**
 * Viewport Manager
 * Handles performance optimization by culling off-screen nodes and managing image memory.
 */

class ViewportManager {
    constructor() {
        this.isVisible = true;
        this.updateScheduled = false;
        this.buffer = 500; // Pixel buffer around viewport to prevent pop-in
        this.lastTransform = { x: 0, y: 0, scale: 1 };

        // Bind methods
        this.update = this.update.bind(this);
        this.handleScroll = this.handleScroll.bind(this);

        // Performance metrics
        this.visibleNodeCount = 0;
        this.totalNodeCount = 0;
    }

    init() {
        console.log('ViewportManager initialized');
        // Initial update
        this.update();
    }

    /**
     * Schedule an update (throttled/debounced via requestAnimationFrame)
     */
    scheduleUpdate() {
        if (!this.updateScheduled) {
            this.updateScheduled = true;
            requestAnimationFrame(this.update);
        }
    }

    /**
     * Main update loop
     */
    update() {
        this.updateScheduled = false;

        // Get current canvas state
        const canvasOffset = window.canvasOffset || { x: 0, y: 0 };
        const canvasScale = window.canvasScale || 1;

        // Check if transform actually changed significantly to warrant a full update
        // We update if scale changed or if position changed by more than a small amount
        const transformChanged =
            Math.abs(canvasScale - this.lastTransform.scale) > 0.001 ||
            Math.abs(canvasOffset.x - this.lastTransform.x) > 10 ||
            Math.abs(canvasOffset.y - this.lastTransform.y) > 10;

        // Always update if it's the first run or forced
        // But for now, let's just run it. Optimization of the optimizer can come later if needed.

        this.lastTransform = { ...canvasOffset, scale: canvasScale };

        // Calculate viewport bounds in CANVAS coordinates
        // We add a buffer to ensure nodes don't pop in visibly
        const wrapper = document.getElementById('canvas-wrapper');
        if (!wrapper) return;

        const viewportWidth = wrapper.clientWidth;
        const viewportHeight = wrapper.clientHeight;

        // Convert viewport bounds to canvas coordinates
        // x = (screenX - offsetX) / scale
        const minX = (-canvasOffset.x - this.buffer) / canvasScale;
        const minY = (-canvasOffset.y - this.buffer) / canvasScale;
        const maxX = (viewportWidth - canvasOffset.x + this.buffer) / canvasScale;
        const maxY = (viewportHeight - canvasOffset.y + this.buffer) / canvasScale;

        // Get all nodes
        const nodes = document.getElementsByClassName('node');
        this.totalNodeCount = nodes.length;
        this.visibleNodeCount = 0;

        // Iterate and toggle visibility
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            // Skip if node is currently being dragged (always keep visible)
            if (node.classList.contains('dragging')) {
                this.setNodeVisibility(node, true);
                this.visibleNodeCount++;
                continue;
            }

            // Get node position
            // Using style.left/top is faster than getBoundingClientRect for many nodes
            // assuming standard positioning
            const x = parseFloat(node.style.left) || 0;
            const y = parseFloat(node.style.top) || 0;

            // Estimate node size if not cached (or use a safe default)
            // We could cache this, but for now let's assume a safe max size
            // Most nodes are < 500px width/height
            const width = node.offsetWidth || 300;
            const height = node.offsetHeight || 200;

            // Check intersection
            const isVisible = (
                x + width >= minX &&
                x <= maxX &&
                y + height >= minY &&
                y <= maxY
            );

            this.setNodeVisibility(node, isVisible);

            if (isVisible) {
                this.visibleNodeCount++;
            }
        }

        // Update connections visibility based on node visibility
        this.updateConnectionsVisibility();

        // Debug info
        if (window.debugMode) {
            this.updateDebugInfo();
        }
    }

    /**
     * Toggle node visibility and handle image resources
     */
    setNodeVisibility(node, isVisible) {
        // We use a specific class for hiding to avoid interfering with other display states
        // or we can use direct style manipulation for performance

        const wasVisible = !node.classList.contains('viewport-hidden');

        if (isVisible && !wasVisible) {
            // Show node
            node.classList.remove('viewport-hidden');
            // Restore images
            this.toggleImages(node, true);
        } else if (!isVisible && wasVisible) {
            // Hide node
            node.classList.add('viewport-hidden');
            // Unload images
            this.toggleImages(node, false);
        }
    }

    /**
     * Manage image memory by swapping src with data-src
     */
    toggleImages(node, load) {
        const images = node.getElementsByTagName('img');
        for (let img of images) {
            if (load) {
                // Restore src from data-src if it exists
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    delete img.dataset.src;
                }
            } else {
                // Save src to data-src and clear src to free memory
                // Only do this for base64 images or large images to save memory
                // For now, we do it for all to be safe, but we could filter
                if (img.src && !img.dataset.src) {
                    img.dataset.src = img.src;
                    // Use a tiny transparent pixel or empty string
                    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                }
            }
        }
    }

    /**
     * Update connections visibility
     * A connection is visible only if BOTH start and end nodes are visible
     * OR if it's currently being created/dragged
     */
    updateConnectionsVisibility() {
        // This might be expensive to query all connections every frame
        // But we can optimize by only checking connections attached to toggled nodes
        // For now, let's iterate all connection paths

        const connections = document.querySelectorAll('.connection');

        for (let conn of connections) {
            const startNodeId = conn.dataset.startNode;
            const endNodeId = conn.dataset.endNode;

            const startNode = document.getElementById(startNodeId);
            const endNode = document.getElementById(endNodeId);

            if (!startNode || !endNode) continue;

            const startVisible = !startNode.classList.contains('viewport-hidden');
            const endVisible = !endNode.classList.contains('viewport-hidden');

            // If either node is hidden, hide the connection
            // Exception: If we want to show connections going off-screen, we'd check if *either* is visible
            // But for max performance, hiding if *either* is hidden is better (less SVG to draw)
            // However, UX-wise, seeing a line go off-screen is nice.
            // Let's stick to: Show if AT LEAST ONE node is visible.

            const isVisible = startVisible || endVisible;

            if (isVisible) {
                conn.style.display = '';
            } else {
                conn.style.display = 'none';
            }
        }
    }

    handleScroll() {
        this.scheduleUpdate();
    }

    updateDebugInfo() {
        let debugEl = document.getElementById('viewport-debug');
        if (!debugEl) {
            debugEl = document.createElement('div');
            debugEl.id = 'viewport-debug';
            debugEl.style.position = 'fixed';
            debugEl.style.top = '50px';
            debugEl.style.right = '10px';
            debugEl.style.background = 'rgba(0,0,0,0.7)';
            debugEl.style.color = '#0f0';
            debugEl.style.padding = '5px';
            debugEl.style.pointerEvents = 'none';
            debugEl.style.zIndex = '9999';
            document.body.appendChild(debugEl);
        }

        debugEl.innerHTML = `
            Nodes: ${this.visibleNodeCount} / ${this.totalNodeCount}<br>
            Culling: ${Math.round((1 - this.visibleNodeCount / this.totalNodeCount) * 100)}%
        `;
    }

    /**
     * Pan the viewport to center on a specific node
     * @param {HTMLElement} node - The node to pan to
     * @param {boolean} animate - Whether to animate the transition
     */
    panToNode(node, animate = true) {
        console.log('[ViewportManager] panToNode called', { node, animate });

        if (!node) {
            console.error('[ViewportManager] panToNode: node is null');
            return;
        }

        const canvas = document.getElementById('canvas');
        if (!canvas) {
            console.error('[ViewportManager] panToNode: canvas not found');
            return;
        }

        // Get node position and dimensions
        const nodeX = parseInt(node.style.left) || 0;
        const nodeY = parseInt(node.style.top) || 0;
        const nodeWidth = node.offsetWidth;
        const nodeHeight = node.offsetHeight;

        console.log('[ViewportManager] Node position:', { nodeX, nodeY, nodeWidth, nodeHeight });

        // Calculate center of node in canvas coordinates
        const nodeCenterX = nodeX + nodeWidth / 2;
        const nodeCenterY = nodeY + nodeHeight / 2;

        console.log('[ViewportManager] Node center:', { nodeCenterX, nodeCenterY });

        // Calculate target offset to center this point in viewport
        // Viewport center = (CanvasCoord * Scale) + Offset
        // Offset = Viewport Center - (CanvasCoord * Scale)

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scale = window.canvasScale || 1;

        console.log('[ViewportManager] Viewport:', { viewportWidth, viewportHeight, scale });

        const targetOffsetX = (viewportWidth / 2) - (nodeCenterX * scale);
        const targetOffsetY = (viewportHeight / 2) - (nodeCenterY * scale);

        console.log('[ViewportManager] Target offset:', { targetOffsetX, targetOffsetY });
        console.log('[ViewportManager] Current offset:', window.canvasOffset);

        if (!animate) {
            console.log('[ViewportManager] Applying offset without animation');
            window.canvasOffset.x = targetOffsetX;
            window.canvasOffset.y = targetOffsetY;
            window.updateCanvasTransform();
            this.scheduleUpdate();
            return;
        }

        // Animation loop
        const startOffsetX = window.canvasOffset.x;
        const startOffsetY = window.canvasOffset.y;

        const startTime = performance.now();
        const duration = 500; // ms

        console.log('[ViewportManager] Starting animation');

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);

            const currentX = startOffsetX + (targetOffsetX - startOffsetX) * ease;
            const currentY = startOffsetY + (targetOffsetY - startOffsetY) * ease;

            window.canvasOffset.x = currentX;
            window.canvasOffset.y = currentY;

            if (window.updateCanvasTransform) {
                window.updateCanvasTransform();
            }

            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            } else {
                console.log('[ViewportManager] Animation complete');
                this.scheduleUpdate();
            }
        };

        requestAnimationFrame(animateScroll);
    }

    /**
     * Pan the viewport to center on a specific group
     * @param {Object} group - The group object to pan to
     */
    panToGroup(group) {
        if (!group || !group.bounds) return;

        const canvas = document.getElementById('canvas');
        if (!canvas) return;

        // Group bounds are in canvas coordinates
        const groupX = group.bounds.x;
        const groupY = group.bounds.y;
        const groupWidth = group.bounds.width;
        const groupHeight = group.bounds.height;

        // Calculate center
        const centerX = groupX + groupWidth / 2;
        const centerY = groupY + groupHeight / 2;

        // Calculate target offset
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scale = window.canvasScale || 1;

        const targetOffsetX = (viewportWidth / 2) - (centerX * scale);
        const targetOffsetY = (viewportHeight / 2) - (centerY * scale);

        // Get current position for animation
        const startOffsetX = window.canvasOffset.x;
        const startOffsetY = window.canvasOffset.y;

        // Animate to target position
        const startTime = performance.now();
        const duration = 500; // ms

        console.log('[ViewportManager] Starting animation from', { startOffsetX, startOffsetY }, 'to', { targetOffsetX, targetOffsetY });

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);

            const currentX = startOffsetX + (targetOffsetX - startOffsetX) * ease;
            const currentY = startOffsetY + (targetOffsetY - startOffsetY) * ease;

            window.canvasOffset.x = currentX;
            window.canvasOffset.y = currentY;

            // Assuming updateCanvasTransform exists globally (it usually does in this codebase)
            if (window.updateCanvasTransform) {
                window.updateCanvasTransform();
            } else {
                // Fallback if function not found
                console.warn('[ViewportManager] updateCanvasTransform not found!');
                canvas.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
                document.body.style.backgroundPosition = `${currentX}px ${currentY}px`;
            }

            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            } else {
                console.log('[ViewportManager] Animation complete');
                this.scheduleUpdate();
            }
        };

        requestAnimationFrame(animateScroll);
    }

    /**
     * Pan the viewport to center on a specific position
     * @param {number} x - X coordinate in canvas space
     * @param {number} y - Y coordinate in canvas space
     * @param {boolean} animate - Whether to animate the transition
     */
    panToPosition(x, y, animate = true) {
        const canvas = document.getElementById('canvas');
        if (!canvas) return;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scale = window.canvasScale || 1;

        const targetOffsetX = (viewportWidth / 2) - (x * scale);
        const targetOffsetY = (viewportHeight / 2) - (y * scale);

        if (!animate) {
            window.canvasOffset.x = targetOffsetX;
            window.canvasOffset.y = targetOffsetY;
            window.updateCanvasTransform();
            this.scheduleUpdate();
            return;
        }

        // Animation loop
        const startOffsetX = window.canvasOffset.x;
        const startOffsetY = window.canvasOffset.y;
        const startTime = performance.now();
        const duration = 500; // ms

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);

            const currentX = startOffsetX + (targetOffsetX - startOffsetX) * ease;
            const currentY = startOffsetY + (targetOffsetY - startOffsetY) * ease;

            window.canvasOffset.x = currentX;
            window.canvasOffset.y = currentY;

            if (window.updateCanvasTransform) {
                window.updateCanvasTransform();
            } else {
                canvas.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
                document.body.style.backgroundPosition = `${currentX}px ${currentY}px`;
            }

            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            } else {
                this.scheduleUpdate();
            }
        };

        requestAnimationFrame(animateScroll);
    }
}

// Create global instance
window.viewportManager = new ViewportManager();
