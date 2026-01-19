/**
 * Canvas Management
 * Handles the infinite canvas with zooming, panning, and grid background
 */

// Global canvas variables
let canvasOffset = { x: 0, y: 0 };
let canvasScale = 1.0;
let isPanning = false;
let isZooming = false;
let startPoint = { x: 0, y: 0 };
let zoomStartScale = 1.0;

// Track key states
let spaceKeyDown = false;
let zKeyDown = false;

// Canvas dimensions - much larger for infinite feel
const canvasWidth = 100000;
const canvasHeight = 100000;

// Initialize canvas behavior
function initCanvas() {
    const canvasWrapper = document.getElementById('canvas-wrapper');

    // Create a structure similar to the old version with separate elements
    createCanvasStructure();

    const canvas = document.getElementById('canvas');
    const canvasContent = document.getElementById('canvas-content');
    const canvasBackground = document.getElementById('canvas-background');

    // Set up dimensions
    canvasContent.style.width = canvasWidth + 'px';
    canvasContent.style.height = canvasHeight + 'px';

    // Set initial canvas position (center of the viewport)
    centerCanvas();

    // Make variables globally accessible
    window.canvasScale = canvasScale;
    window.canvasOffset = canvasOffset;

    // Add debug center marker if in debug mode
    if (window.debugMode) {
        const centerMarker = document.createElement('div');
        centerMarker.id = 'canvas-center-marker';
        centerMarker.style.position = 'absolute';
        centerMarker.style.width = '10px';
        centerMarker.style.height = '10px';
        centerMarker.style.backgroundColor = 'blue';
        centerMarker.style.borderRadius = '50%';
        centerMarker.style.left = '0px';
        centerMarker.style.top = '0px';
        centerMarker.style.transform = 'translate(-5px, -5px)';
        centerMarker.style.zIndex = '999';
        centerMarker.style.pointerEvents = 'none';
        canvasContent.appendChild(centerMarker);
    }

    // --- KEY STATE TRACKING ---
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !spaceKeyDown) {
            spaceKeyDown = true;
            canvas.style.cursor = 'grab';
        }
        if (e.key.toLowerCase() === 'z' && !zKeyDown && !e.metaKey && !e.ctrlKey) {
            zKeyDown = true;
            canvas.style.cursor = 'zoom-in';
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            spaceKeyDown = false;
            if (!isPanning) canvas.style.cursor = 'default';
        }
        if (e.key.toLowerCase() === 'z') {
            zKeyDown = false;
            if (!isZooming) canvas.style.cursor = 'default';
        }
    });

    // ========== MODIFIER KEY FIX ==========
    // Reset key states when window loses focus
    // This fixes the "stuck key" issue when using shortcuts like Shift+Cmd+4
    window.addEventListener('blur', () => {
        spaceKeyDown = false;
        zKeyDown = false;
        canvas.style.cursor = 'default';
        console.log('[Canvas] Window blur: key states reset');
    });

    // --- PANNING: Space + Drag ---
    canvas.addEventListener('mousedown', function (e) {
        // Clear group selections when clicking canvas background
        if (e.target === canvas || e.target === canvasBackground || e.target === canvasContent) {
            if (window.clearGroupSelections) {
                window.clearGroupSelections();
            }
        }

        // Focus mode - disable all canvas interactions
        if (document.body.classList.contains('has-focused-node')) return;

        // Pan with Space + Left Click
        if (spaceKeyDown && e.button === 0) {
            isPanning = true;
            startPoint = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }

        // Zoom with Z + Left Click
        if (zKeyDown && e.button === 0) {
            isZooming = true;
            startPoint = { x: e.clientX, y: e.clientY };
            zoomStartScale = canvasScale;
            canvas.style.cursor = 'zoom-in';
            e.preventDefault();
            return;
        }

        // Normal click on canvas background - no panning, just deselect
        // Nodes handle their own dragging
    });

    // Handle mouse move for panning and zoom-drag
    document.addEventListener('mousemove', function (e) {
        if (isPanning) {
            const dx = e.clientX - startPoint.x;
            const dy = e.clientY - startPoint.y;

            canvasOffset.x += dx;
            canvasOffset.y += dy;

            startPoint = { x: e.clientX, y: e.clientY };
            updateCanvasTransform();
        }

        if (isZooming) {
            // Drag up = zoom in, drag down = zoom out
            const dy = startPoint.y - e.clientY;
            const zoomFactor = 1 + dy * 0.005;
            const newScale = Math.min(Math.max(0.1, zoomStartScale * zoomFactor), 4);

            // Zoom towards center of viewport
            const rect = document.getElementById('canvas-wrapper').getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const canvasCenterX = (centerX - canvasOffset.x) / canvasScale;
            const canvasCenterY = (centerY - canvasOffset.y) / canvasScale;

            canvasOffset.x = centerX - canvasCenterX * newScale;
            canvasOffset.y = centerY - canvasCenterY * newScale;

            canvasScale = newScale;
            updateCanvasTransform();
        }
    });

    // Handle mouse up to stop panning/zooming
    document.addEventListener('mouseup', function () {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = spaceKeyDown ? 'grab' : 'default';
        }
        if (isZooming) {
            isZooming = false;
            canvas.style.cursor = zKeyDown ? 'zoom-in' : 'default';
        }
        document.body.classList.remove('panning');
    });

    // --- SCROLL WHEEL: Pan (default) or Zoom (with Ctrl/Cmd) ---
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Double click on canvas to create a new node
    canvas.addEventListener('dblclick', function (e) {
        if (e.target === canvas || e.target === canvasBackground || e.target === canvasContent) {
            const canvasPos = window.getCanvasPosition(e);
            const newNode = window.createNode(canvasPos.x, canvasPos.y, null, 'text_node'); // Use V2 text node
            if (newNode) {
                window.selectNode(newNode, false);
            }
        }
    });

    // Handle click on canvas to deselect nodes and stickers
    canvas.addEventListener('click', function (e) {
        // Only clear if clicking directly on canvas or background
        if (e.target.id === 'canvas' || e.target.id === 'canvas-background' || e.target.id === 'canvas-content') {
            // Don't clear if we just finished a drag or shift selection
            if (window.hasDragged || window.isShiftSelecting || window.justFinishedShiftSelection) return;

            if (window.clearSelectedNodes) {
                window.clearSelectedNodes();
            }

            // Also clear sticker selection
            if (window.stickerPanel) {
                window.stickerPanel.deselectAllStickers();
            }
        }
    });

    // Reset canvas button
    document.getElementById('reset-canvas').addEventListener('click', resetCanvasView);

    console.log('Canvas initialized with dimensions:', canvasWidth, 'x', canvasHeight);
}

// Handle wheel events - Pan by default, Zoom with Ctrl/Cmd
function handleWheel(e) {
    // CRITICAL: In Focus Mode, let wheel events propagate to webview
    // Do NOT call e.preventDefault() - this allows webview to receive the event
    if (document.body.classList.contains('has-focused-node')) {
        // Don't block the event, let it reach the webview
        return;
    }

    e.preventDefault();

    const rect = document.getElementById('canvas-wrapper').getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Ctrl/Cmd + Scroll = Zoom (pinch gesture on Mac trackpad)
    if (e.ctrlKey || e.metaKey) {
        // Increased sensitivity from 0.003 to 0.01 for faster zoom
        const zoomFactor = 1 - e.deltaY * 0.01;
        const newScale = Math.min(Math.max(0.1, canvasScale * zoomFactor), 4);

        // Calculate mouse position relative to canvas
        const mouseCanvasX = (mouseX - canvasOffset.x) / canvasScale;
        const mouseCanvasY = (mouseY - canvasOffset.y) / canvasScale;

        // Update offset to keep point under mouse fixed
        canvasOffset.x = mouseX - mouseCanvasX * newScale;
        canvasOffset.y = mouseY - mouseCanvasY * newScale;

        canvasScale = newScale;
    } else {
        // Normal scroll = Pan (2-finger scroll on Mac trackpad)
        canvasOffset.x -= e.deltaX;
        canvasOffset.y -= e.deltaY;
    }

    updateCanvasTransform();
}

// Create canvas structure like the old version
function createCanvasStructure() {
    const wrapper = document.getElementById('canvas-wrapper');

    // Clear existing content
    wrapper.innerHTML = '';

    // Create the background element (for the grid)
    const canvasBackground = document.createElement('div');
    canvasBackground.id = 'canvas-background';
    canvasBackground.style.position = 'absolute';
    canvasBackground.style.top = '0';
    canvasBackground.style.left = '0';
    canvasBackground.style.width = '400%';
    canvasBackground.style.height = '400%';
    canvasBackground.style.background = 'radial-gradient(var(--grid-color) 1px, transparent 1px), radial-gradient(var(--grid-color) 1px, transparent 1px)';
    canvasBackground.style.backgroundSize = '20px 20px';
    canvasBackground.style.backgroundPosition = '0 0, 10px 10px';
    canvasBackground.style.transformOrigin = '0 0';

    // Create the content element (for nodes)
    const canvasContent = document.createElement('div');
    canvasContent.id = 'canvas-content';
    canvasContent.style.position = 'absolute';
    canvasContent.style.top = '0';
    canvasContent.style.left = '0';
    canvasContent.style.width = '1000%';
    canvasContent.style.height = '1000%';
    canvasContent.style.transformOrigin = '0 0';

    // Create the main canvas container
    const canvas = document.createElement('div');
    canvas.id = 'canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.overflow = 'hidden';
    canvas.style.cursor = 'default'; // Changed from 'grab' - pan now requires Space key

    // Append elements
    canvas.appendChild(canvasBackground);
    canvas.appendChild(canvasContent);
    wrapper.appendChild(canvas);
}

// Center the canvas
function centerCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');

    // Calculate the offset needed to place the canvas center
    // at the center of the viewport.
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    const viewportCenterX = wrapper.clientWidth / 2;
    const viewportCenterY = wrapper.clientHeight / 2;

    // Position the canvas center at the viewport center
    canvasOffset.x = viewportCenterX - canvasCenterX * canvasScale;
    canvasOffset.y = viewportCenterY - canvasCenterY * canvasScale;

    updateCanvasTransform();
}

// Update the canvas transformation
function updateCanvasTransform() {
    const canvasContent = document.getElementById('canvas-content');
    const canvasBackground = document.getElementById('canvas-background');

    // In focus mode, disable transform so position:fixed works on nodes
    // This is critical - we can't move nodes in DOM (causes iframe reload)
    if (document.body.classList.contains('has-focused-node')) {
        canvasContent.style.transform = 'none';
        canvasBackground.style.transform = 'none';
    } else {
        // Transform content with nodes
        canvasContent.style.transform = `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`;
        // Transform background grid with offset modulo grid size for infinite effect
        canvasBackground.style.transform = `translate(${canvasOffset.x % (20 * canvasScale)}px, ${canvasOffset.y % (20 * canvasScale)}px) scale(${canvasScale})`;
    }

    // Update global variables - always sync TO window (window is a mirror of local state)
    window.canvasScale = canvasScale;
    window.canvasOffset = canvasOffset;
    window.isZooming = isZooming;

    // Update connections if function exists
    if (window.updateNodeConnections) {
        window.updateNodeConnections();
    }

    // Update viewport visibility
    if (window.viewportManager) {
        window.viewportManager.scheduleUpdate();
    }

    // Update custom background parallax if applicable (but not during zoom)
    if (window.updateCustomBackgroundParallax && !isZooming) {
        window.updateCustomBackgroundParallax();
    }
}

// Reset canvas to default view with animation
function resetCanvasView() {
    // Save current state
    const startScale = canvasScale;
    const startOffsetX = canvasOffset.x;
    const startOffsetY = canvasOffset.y;

    // Calculate target state
    const targetScale = 1.0;

    // Calculate center position (same as in centerCanvas)
    const wrapper = document.getElementById('canvas-wrapper');
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    const viewportCenterX = wrapper.clientWidth / 2;
    const viewportCenterY = wrapper.clientHeight / 2;

    // Target offset when scale is 1.0
    const targetOffsetX = viewportCenterX - canvasCenterX * targetScale;
    const targetOffsetY = viewportCenterY - canvasCenterY * targetScale;

    // Animate the transition
    const duration = 800; // Animation duration in ms
    const startTime = performance.now();

    function animateReset(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1); // Value between 0 and 1

        // Easing function for smooth animation (easeOutQuad)
        const eased = 1 - (1 - progress) * (1 - progress);

        // Interpolate between start and target values
        canvasScale = startScale + (targetScale - startScale) * eased;
        canvasOffset.x = startOffsetX + (targetOffsetX - startOffsetX) * eased;
        canvasOffset.y = startOffsetY + (targetOffsetY - startOffsetY) * eased;

        // Update the canvas transform
        updateCanvasTransform();

        // Continue animation if not complete
        if (progress < 1) {
            requestAnimationFrame(animateReset);
        }
    }

    requestAnimationFrame(animateReset);
}

// Get canvas position for a mouse event
function getCanvasPosition(e) {
    // Get the canvas wrapper's bounding rectangle to account for sidebar/header offsets
    const wrapper = document.getElementById('canvas-wrapper');
    const rect = wrapper ? wrapper.getBoundingClientRect() : { left: 0, top: 0 };

    // Calculate mouse position relative to wrapper, then convert to canvas coordinates
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    return {
        x: (mouseX - canvasOffset.x) / canvasScale,
        y: (mouseY - canvasOffset.y) / canvasScale
    };
}

// Deselect all nodes
function deselectAllNodes() {
    const selectedNodes = document.querySelectorAll('.node.selected');
    selectedNodes.forEach(node => {
        node.classList.remove('selected');
    });

    // Clear the selected nodes set
    if (window.selectedNodes) {
        window.selectedNodes.clear();
    }
}

// Check if a node is visible in the viewport
function isNodeVisible(node) {
    const canvasRect = document.getElementById('canvas-wrapper').getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();

    return (
        nodeRect.right >= canvasRect.left &&
        nodeRect.left <= canvasRect.right &&
        nodeRect.bottom >= canvasRect.top &&
        nodeRect.top <= canvasRect.bottom
    );
}

// Export functions to global scope
window.initCanvas = initCanvas;
window.getCanvasPosition = getCanvasPosition;
window.updateCanvasTransform = updateCanvasTransform;
window.deselectAllNodes = deselectAllNodes;
window.resetCanvasView = resetCanvasView;
window.centerCanvas = centerCanvas;
window.isNodeVisible = isNodeVisible;
