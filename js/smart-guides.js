/**
 * Smart Guides System
 * Provides Photoshop-style alignment guides and magnetic snapping for node positioning
 */

class SmartGuides {
    constructor() {
        this.threshold = 12; // Snap threshold in pixels
        this.guideContainer = null;
        this.activeGuides = [];
        this.enabled = true;
    }

    /**
     * Initialize the smart guides system
     */
    init() {
        // Create SVG container for guide lines
        // Place it above canvas content but below UI controls (title bar, panels, etc.)
        this.guideContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.guideContainer.id = 'smart-guides-overlay';
        this.guideContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 500;
            overflow: visible;
        `;

        // Add CSS for fade animations
        const style = document.createElement('style');
        style.textContent = `
            #smart-guides-overlay line {
                transition: opacity 0.15s ease-out;
            }
            #smart-guides-overlay line.fade-out {
                opacity: 0 !important;
            }
        `;
        document.head.appendChild(style);

        // Add to body since we use position: fixed
        document.body.appendChild(this.guideContainer);
        console.log('[SmartGuides] Initialized with fixed positioning (z-index: 500)');
    }

    /**
     * Check if a node is visible in the current viewport
     */
    isNodeInViewport(node) {
        const rect = node.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Check if node rectangle intersects with viewport
        // Add some margin for nodes partially visible
        return (
            rect.right > 0 &&
            rect.left < viewportWidth &&
            rect.bottom > 0 &&
            rect.top < viewportHeight
        );
    }

    /**
     * Get all nodes except the currently dragged ones
     * Only returns nodes visible in the current viewport
     */
    getOtherNodes(draggedNodes) {
        const allNodes = document.querySelectorAll('.node');
        const draggedIds = new Set(Array.from(draggedNodes).map(n => n.id));

        return Array.from(allNodes).filter(n => {
            // Exclude dragged nodes
            if (draggedIds.has(n.id)) return false;

            // Only include nodes visible in viewport
            return this.isNodeInViewport(n);
        });
    }

    /**
     * Get node bounds in viewport coordinates (screen coords)
     * Since SVG uses position: fixed, we need viewport-relative coordinates
     */
    getNodeBounds(node) {
        const nodeRect = node.getBoundingClientRect();

        // Use viewport coordinates directly since SVG is position: fixed
        const left = nodeRect.left;
        const top = nodeRect.top;
        const width = nodeRect.width;
        const height = nodeRect.height;

        return {
            left,
            top,
            right: left + width,
            bottom: top + height,
            centerX: left + width / 2,
            centerY: top + height / 2,
            width,
            height
        };
    }

    /**
     * Calculate snap offset and find alignment guides
     * Returns { snapX, snapY, guides[] }
     */
    calculateSnap(draggedNodes, allOtherNodes) {
        if (!this.enabled || draggedNodes.size === 0) {
            return { snapX: 0, snapY: 0, guides: [] };
        }

        const guides = [];
        let snapX = 0;
        let snapY = 0;
        let foundSnapX = false;
        let foundSnapY = false;

        // Get bounds of dragged node(s) - use first one for calculation
        const draggedNode = draggedNodes.values().next().value;
        const draggedBounds = this.getNodeBounds(draggedNode);

        // Check alignment with each other node
        for (const otherNode of allOtherNodes) {
            const otherBounds = this.getNodeBounds(otherNode);

            // === VERTICAL ALIGNMENTS (X-axis snap) ===

            // Left edge to left edge
            if (!foundSnapX && Math.abs(draggedBounds.left - otherBounds.left) < this.threshold) {
                snapX = otherBounds.left - draggedBounds.left;
                foundSnapX = true;
                guides.push({
                    type: 'vertical',
                    x: otherBounds.left,
                    y1: Math.min(draggedBounds.top, otherBounds.top) - 20,
                    y2: Math.max(draggedBounds.bottom, otherBounds.bottom) + 20
                });
            }

            // Right edge to right edge
            if (!foundSnapX && Math.abs(draggedBounds.right - otherBounds.right) < this.threshold) {
                snapX = otherBounds.right - draggedBounds.right;
                foundSnapX = true;
                guides.push({
                    type: 'vertical',
                    x: otherBounds.right,
                    y1: Math.min(draggedBounds.top, otherBounds.top) - 20,
                    y2: Math.max(draggedBounds.bottom, otherBounds.bottom) + 20
                });
            }

            // Left edge to right edge
            if (!foundSnapX && Math.abs(draggedBounds.left - otherBounds.right) < this.threshold) {
                snapX = otherBounds.right - draggedBounds.left;
                foundSnapX = true;
                guides.push({
                    type: 'vertical',
                    x: otherBounds.right,
                    y1: Math.min(draggedBounds.top, otherBounds.top) - 20,
                    y2: Math.max(draggedBounds.bottom, otherBounds.bottom) + 20
                });
            }

            // Right edge to left edge
            if (!foundSnapX && Math.abs(draggedBounds.right - otherBounds.left) < this.threshold) {
                snapX = otherBounds.left - draggedBounds.right;
                foundSnapX = true;
                guides.push({
                    type: 'vertical',
                    x: otherBounds.left,
                    y1: Math.min(draggedBounds.top, otherBounds.top) - 20,
                    y2: Math.max(draggedBounds.bottom, otherBounds.bottom) + 20
                });
            }

            // Center X alignment
            if (!foundSnapX && Math.abs(draggedBounds.centerX - otherBounds.centerX) < this.threshold) {
                snapX = otherBounds.centerX - draggedBounds.centerX;
                foundSnapX = true;
                guides.push({
                    type: 'vertical',
                    x: otherBounds.centerX,
                    y1: Math.min(draggedBounds.top, otherBounds.top) - 20,
                    y2: Math.max(draggedBounds.bottom, otherBounds.bottom) + 20,
                    isCenter: true
                });
            }

            // === HORIZONTAL ALIGNMENTS (Y-axis snap) ===

            // Top edge to top edge
            if (!foundSnapY && Math.abs(draggedBounds.top - otherBounds.top) < this.threshold) {
                snapY = otherBounds.top - draggedBounds.top;
                foundSnapY = true;
                guides.push({
                    type: 'horizontal',
                    y: otherBounds.top,
                    x1: Math.min(draggedBounds.left, otherBounds.left) - 20,
                    x2: Math.max(draggedBounds.right, otherBounds.right) + 20
                });
            }

            // Bottom edge to bottom edge
            if (!foundSnapY && Math.abs(draggedBounds.bottom - otherBounds.bottom) < this.threshold) {
                snapY = otherBounds.bottom - draggedBounds.bottom;
                foundSnapY = true;
                guides.push({
                    type: 'horizontal',
                    y: otherBounds.bottom,
                    x1: Math.min(draggedBounds.left, otherBounds.left) - 20,
                    x2: Math.max(draggedBounds.right, otherBounds.right) + 20
                });
            }

            // Top edge to bottom edge
            if (!foundSnapY && Math.abs(draggedBounds.top - otherBounds.bottom) < this.threshold) {
                snapY = otherBounds.bottom - draggedBounds.top;
                foundSnapY = true;
                guides.push({
                    type: 'horizontal',
                    y: otherBounds.bottom,
                    x1: Math.min(draggedBounds.left, otherBounds.left) - 20,
                    x2: Math.max(draggedBounds.right, otherBounds.right) + 20
                });
            }

            // Bottom edge to top edge
            if (!foundSnapY && Math.abs(draggedBounds.bottom - otherBounds.top) < this.threshold) {
                snapY = otherBounds.top - draggedBounds.bottom;
                foundSnapY = true;
                guides.push({
                    type: 'horizontal',
                    y: otherBounds.top,
                    x1: Math.min(draggedBounds.left, otherBounds.left) - 20,
                    x2: Math.max(draggedBounds.right, otherBounds.right) + 20
                });
            }

            // Center Y alignment
            if (!foundSnapY && Math.abs(draggedBounds.centerY - otherBounds.centerY) < this.threshold) {
                snapY = otherBounds.centerY - draggedBounds.centerY;
                foundSnapY = true;
                guides.push({
                    type: 'horizontal',
                    y: otherBounds.centerY,
                    x1: Math.min(draggedBounds.left, otherBounds.left) - 20,
                    x2: Math.max(draggedBounds.right, otherBounds.right) + 20,
                    isCenter: true
                });
            }

            // Exit early if we found both snaps
            if (foundSnapX && foundSnapY) break;
        }

        return { snapX, snapY, guides };
    }

    /**
     * Show guide lines on the canvas
     */
    showGuides(guides) {
        if (!this.guideContainer) return;

        // Clear existing guides
        this.hideGuides();

        // Coordinates are already in screen space from getBoundingClientRect
        guides.forEach(guide => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');

            if (guide.type === 'vertical') {
                line.setAttribute('x1', guide.x);
                line.setAttribute('y1', guide.y1);
                line.setAttribute('x2', guide.x);
                line.setAttribute('y2', guide.y2);
            } else {
                line.setAttribute('x1', guide.x1);
                line.setAttribute('y1', guide.y);
                line.setAttribute('x2', guide.x2);
                line.setAttribute('y2', guide.y);
            }

            // Style the line - Magenta/Pink for better visibility on both light/dark themes
            line.setAttribute('stroke', guide.isCenter ? '#FF00FF' : '#FF1493');
            line.setAttribute('stroke-width', '1.5');
            line.setAttribute('stroke-dasharray', guide.isCenter ? '6,4' : 'none');

            // Start with opacity 0 for fade-in effect
            line.setAttribute('stroke-opacity', '0');

            this.guideContainer.appendChild(line);
            this.activeGuides.push(line);

            // Trigger fade-in animation
            requestAnimationFrame(() => {
                line.setAttribute('stroke-opacity', '0.85');
            });
        });
    }

    /**
     * Hide all guide lines with fade-out animation
     */
    hideGuides() {
        if (!this.guideContainer) return;

        // Fade out existing guides before removing
        this.activeGuides.forEach(line => {
            line.classList.add('fade-out');
        });

        // Remove after animation completes
        const linesToRemove = [...this.activeGuides];
        setTimeout(() => {
            linesToRemove.forEach(line => line.remove());
        }, 150);

        this.activeGuides = [];
    }

    /**
     * Check and resolve overlaps when a new node is created
     * Pushes existing nodes away from the new node if they overlap
     * @param {HTMLElement} newNode - The newly created node
     * @param {number} padding - Minimum padding between nodes (default 20px)
     */
    resolveOverlaps(newNode, padding = 20) {
        if (!newNode) return;

        const allNodes = document.querySelectorAll('.node');
        const newRect = newNode.getBoundingClientRect();

        // Get canvas scale for proper position calculation
        const scale = window.canvasScale || 1;

        allNodes.forEach(otherNode => {
            if (otherNode === newNode || otherNode.id === newNode.id) return;

            const otherRect = otherNode.getBoundingClientRect();

            // Check for overlap
            const overlapX = Math.max(0, Math.min(newRect.right, otherRect.right) - Math.max(newRect.left, otherRect.left));
            const overlapY = Math.max(0, Math.min(newRect.bottom, otherRect.bottom) - Math.max(newRect.top, otherRect.top));

            if (overlapX > 0 && overlapY > 0) {
                // There is an overlap - determine push direction
                const newCenterX = newRect.left + newRect.width / 2;
                const newCenterY = newRect.top + newRect.height / 2;
                const otherCenterX = otherRect.left + otherRect.width / 2;
                const otherCenterY = otherRect.top + otherRect.height / 2;

                // Calculate required push distance in each direction
                const pushLeft = newRect.left - otherRect.right - padding;
                const pushRight = newRect.right - otherRect.left + padding;
                const pushUp = newRect.top - otherRect.bottom - padding;
                const pushDown = newRect.bottom - otherRect.top + padding;

                // Choose smallest absolute push
                const options = [
                    { axis: 'x', value: pushLeft },
                    { axis: 'x', value: pushRight },
                    { axis: 'y', value: pushUp },
                    { axis: 'y', value: pushDown }
                ];

                // Sort by absolute value and pick smallest
                options.sort((a, b) => Math.abs(a.value) - Math.abs(b.value));
                const bestPush = options[0];

                // Get current canvas position
                const currentX = parseFloat(otherNode.style.left) || 0;
                const currentY = parseFloat(otherNode.style.top) || 0;

                // Apply push with smooth animation
                otherNode.style.transition = 'left 0.25s ease-out, top 0.25s ease-out';

                if (bestPush.axis === 'x') {
                    otherNode.style.left = `${currentX + (bestPush.value / scale)}px`;
                } else {
                    otherNode.style.top = `${currentY + (bestPush.value / scale)}px`;
                }

                // Remove transition after animation
                setTimeout(() => {
                    otherNode.style.transition = '';

                    // Update connections
                    if (window.updateNodeConnections) {
                        window.updateNodeConnections();
                    }
                }, 250);

                console.log(`[SmartGuides] Pushed node ${otherNode.id} by ${bestPush.value.toFixed(0)}px on ${bestPush.axis}-axis`);
            }
        });
    }

    /**
     * Toggle smart guides on/off
     */
    toggle(enabled) {
        this.enabled = enabled !== undefined ? enabled : !this.enabled;
        if (!this.enabled) {
            this.hideGuides();
        }
        console.log('[SmartGuides]', this.enabled ? 'Enabled' : 'Disabled');
    }
}

// Create global instance
window.smartGuides = new SmartGuides();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Delay init to ensure canvas-content exists
    setTimeout(() => {
        if (window.smartGuides) {
            window.smartGuides.init();
        }
    }, 500);
});
