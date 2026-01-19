/**
 * Node Management
 * Handles creation, editing, dragging, and deletion of nodes on the canvas
 */

// Node global variables
let nodeCounter = 1;
let isDraggingNode = false;
let draggedNode = null;
let nodeStartX, nodeStartY;
let selectedNodes = new Set();
let nodeOffsetX, nodeOffsetY;
let lastDragX, lastDragY; // Track last drag position for smoother movement
let isShiftSelecting = false; // Flag for shift selection
let shiftSelectStart = { x: 0, y: 0 }; // Starting point for shift selection
let shiftSelectRect = null; // Visual rectangle for shift selection
let shiftKeyDown = false; // Track if shift key is currently held down
let selectionActive = false; // Track if selection is active (persists after shift release)
let altKeyDown = false; // Track alt/option key state
let isDuplicating = false; // Track if we're in duplication mode
let duplicatedNodes = []; // Store duplicated nodes
let copiedNodes = []; // Store copied nodes for clipboard operations
let hasDragged = false; // Track if a drag operation actually moved the node

// Standard colors for node strip
const stripColors = [
    '#a9a9a9ff', // Default Darker Gray (was #e0e0e0)
    '#D9FF73', // Lime
    '#FFD166', // Yellow
    '#EF767A', // Salmon
    '#7D80DA', // Lavender
    '#49DCB1', // Teal
    '#FB6480', // Pink
    '#F9C3FF', // Light purple
    '#7FDEFF', // Light blue
    '#FFB865'  // Orange
];

// Expose globally
window.stripColors = stripColors;

// Create initial welcome node when starting a new project
function createInitialNode() {
    // Get the current language for the welcome message
    const currentLang = window.currentLanguage || 'en';

    // Get the welcome content based on language
    const welcomeContent = getWelcomeNodeContent();

    // Canvas dimensions from canvas.js
    const canvasWidth = 100000;
    const canvasHeight = 100000;

    // Position in the center of the canvas
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;

    // Approximate node dimensions to center it visually
    const approxNodeWidth = 300;
    const approxNodeHeight = 250;

    const nodeX = canvasCenterX - (approxNodeWidth / 2);
    const nodeY = canvasCenterY - (approxNodeHeight / 2);

    const newNode = createNode(nodeX, nodeY, welcomeContent);

    console.log('Created welcome node at canvas center:', nodeX, nodeY, 'with language:', currentLang);

    // Center canvas on welcome node
    if (window.centerCanvas) {
        window.centerCanvas();
    }

    // Auto-select the welcome node
    if (newNode) {
        selectNode(newNode, false);
    }
}

// Get welcome node content with random quote from JSON
// Dynamically fetches quotes so new additions to JSON are automatically picked up
let cachedQuotes = null; // Cache quotes for performance

async function loadWelcomeQuotes() {
    if (cachedQuotes) return cachedQuotes;

    try {
        const response = await fetch('node_types/text_node/welcome_quotes.json');
        if (response.ok) {
            const data = await response.json();
            cachedQuotes = data.quotes || [];
            return cachedQuotes;
        }
    } catch (e) {
        console.warn('[Welcome] Could not load quotes:', e);
    }
    return [];
}

function getRandomQuote() {
    // If quotes aren't loaded yet, return null
    if (!cachedQuotes || cachedQuotes.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * cachedQuotes.length);
    return cachedQuotes[randomIndex];
}

function getWelcomeNodeContent() {
    // Try to get a random quote
    const quote = getRandomQuote();

    if (quote) {
        // Format quote as plain text (Text Node uses textarea, not HTML)
        return `"${quote.quote}"\n\n— ${quote.speaker}, ${quote.source}`;
    }

    // Fallback to original welcome content if quotes not loaded
    const html = `
        <h2 style="text-align: center;">${getText('welcomeTitle')}</h2>
        <p>${getText('welcomeIntro')}</p>
        <ul>
            <li>${getText('welcomeFeature1')}</li>
            <li>${getText('welcomeFeature2')}</li>
            <li>${getText('welcomeFeature3')}</li>
            <li>${getText('welcomeFeature4')}</li>
            <li>${getText('welcomeFeature5')}</li>
        </ul>
        <p style="text-align: center;">🎨 ${getText('welcomeColorTip')}</p>
    `;

    return html;
}

// Pre-load quotes when module loads
loadWelcomeQuotes();

// Get placeholder text based on language - REFACTORED
function getPlaceholderText() { // Removed lang parameter
    // Use the global getText function
    return getText('nodePlaceholder');
}

// Create a new node at the specified position using a node type loader
function createNode(x, y, content = null, nodeType = 'default', id = null, stripColor = null, customData = null) {
    const placeholder = getPlaceholderText(); // Get placeholder text
    let isInitialPlaceholder = false;
    // Use global language for placeholder if content is not provided
    if (content === null || content === placeholder) { // Check against placeholder too
        content = placeholder;
        isInitialPlaceholder = true;
    }

    const nodeId = id || `node-${Date.now()}-${nodeCounter++}`;

    // Get the loader function for the specified node type
    const nodeLoader = window.nodeTypeLoaders ? window.nodeTypeLoaders[nodeType] : null;

    if (!nodeLoader) {
        console.error(`Node type loader for '${nodeType}' not found.`);
        // Fallback or error handling: maybe create a default node?
        // For now, let's just return null or throw an error
        return null;
    }

    // Use the loader to create the node's DOM element
    // Pass necessary parameters: id, position, content, initial strip color, and customData
    const effectiveStripColor = stripColor || stripColors[0]; // Use provided color or default
    const node = nodeLoader(nodeId, x, y, content, effectiveStripColor, customData);

    if (!node) {
        console.error(`Node loader for '${nodeType}' failed to create a node element.`);
        return null;
    }

    // Node element should already have id, position, content set by the loader
    // Ensure the base 'node' class is present if the loader didn't add it
    if (!node.classList.contains('node')) {
        node.classList.add('node');
    }

    // Store the new node type on the element (e.g., using a data attribute)
    node.dataset.nodeType = nodeType;

    // Add the node to the canvas content
    document.getElementById('canvas-content').appendChild(node);

    // --- Find required elements for event setup --- 
    // We need to make this more robust if node types have different structures
    // Assumption: Loaders provide elements with standard classes like 'strip', 'content', 'delete', 'pin'
    const strip = node.querySelector('.strip');
    const contentDiv = node.querySelector('.content');
    const leftPin = node.querySelector('.pin.left');
    const rightPin = node.querySelector('.pin.right');

    // Add placeholder class if starting with placeholder
    if (isInitialPlaceholder && contentDiv) {
        contentDiv.classList.add('is-placeholder');
    }

    // Check if all required elements are found
    // Check if critical elements are found (content is most important)
    if (!contentDiv) {
        console.warn(`Node type '${nodeType}' might be missing content element. Event listeners might not work correctly.`);
    }

    // Set up event listeners for the node (assuming standard structure)
    // Pass found elements, even if some are null (setupNodeEvents should handle null checks if necessary)
    setupNodeEvents(node, strip, contentDiv, leftPin, rightPin, nodeType);

    // Make the node resizable
    makeNodeResizable(node);

    // IMPORTANT: Don't make media elements resizable anymore
    // We used to do this, but now we want the whole node to be resizable instead
    if (contentDiv) {
        contentDiv.querySelectorAll('img, iframe').forEach(media => {
            // Don't add the resizable wrapper to media anymore
            // Instead, remove any existing resizable wrappers for clean up
            const wrapper = media.closest('.media-resizable');
            if (wrapper) {
                // Replace the wrapper with just the media element
                wrapper.parentNode.insertBefore(media, wrapper);
                wrapper.remove();
            }

            // Ensure media respects node boundaries
            media.style.maxWidth = '100%';
        });
    }

    // Log node creation for debugging
    if (window.debugMode) {
        console.log(`Node created (type: ${nodeType}) at:`, x, y);
    }

    // Add to action history
    if (window.actionHistory && !window.actionHistory.isPerformingAction) {
        const action = new window.NodeCreateAction(
            node.id,
            { x, y },
            content,
            nodeType, // Include node type in action
            effectiveStripColor // Include color in action
        );
        window.actionHistory.addAction(action);
    }

    // Update viewport visibility for the new node
    if (window.viewportManager) {
        window.viewportManager.scheduleUpdate();
    }

    // Resolve overlaps with existing nodes (push them away with animation)
    // Use requestAnimationFrame to ensure the node is rendered first
    requestAnimationFrame(() => {
        if (window.smartGuides && window.smartGuides.resolveOverlaps) {
            window.smartGuides.resolveOverlaps(node);
        }
    });

    // Broadcast node creation for P2P sync
    if (window.p2pManager && window.p2pManager.connections.size > 0) {
        window.p2pManager.broadcast({
            type: 'node-create',
            nodeId: nodeId,
            x: x,
            y: y,
            content: content,
            nodeType: nodeType,
            stripColor: effectiveStripColor,
            customData: customData
        });
    }

    return node;
}

// NEW: Setup dragging for a specific handle (used by new NodeLoader)
function setupNodeDragging(node, handle) {
    if (!node || !handle) return;

    handle.addEventListener('mousedown', e => {
        e.stopPropagation(); // Prevent canvas panning

        // Select node
        if (!selectedNodes.has(node) && !e.shiftKey) {
            selectNode(node, false);
        } else if (e.shiftKey) {
            selectNode(node, true);
        }

        startNodeDrag(e, node);
    });

    // Allow clicking handle to select without dragging if it was just a click
    handle.addEventListener('click', e => {
        if (!hasDragged) {
            e.stopPropagation();
            if (!e.shiftKey && selectedNodes.size <= 1) {
                // confirm selection
            }
        }
    });
}

function startNodeDrag(e, node) {
    isDraggingNode = true;
    draggedNode = node;
    hasDragged = false;

    const rect = node.getBoundingClientRect();
    nodeOffsetX = e.clientX - rect.left;
    nodeOffsetY = e.clientY - rect.top;

    nodeStartX = parseInt(node.style.left);
    nodeStartY = parseInt(node.style.top);

    lastDragX = e.clientX;
    lastDragY = e.clientY;

    document.addEventListener('mousemove', moveNode);
    document.addEventListener('mouseup', stopNodeDrag);
}

// Make globally available
window.setupNodeDragging = setupNodeDragging;

// Set up all event listeners for a node
// Modified to be more resilient to missing elements from custom node types
function setupNodeEvents(node, strip, contentDiv, leftPin, rightPin, nodeType = 'default') {
    // Start Node dragging
    if (node) { // Only add listener if node element exists
        node.addEventListener('mousedown', e => {
            // Check if the event target is one of the interactive elements
            const isInteractiveElement = (leftPin && e.target === leftPin) ||
                (rightPin && e.target === rightPin) ||
                (contentDiv && contentDiv.isContentEditable);

            if (isInteractiveElement) {
                return; // Don't start drag on interactive elements
            }

            // Check if node is locked
            if (node.dataset.locked === 'true') {
                console.log('[Nodes] Node is locked, preventing drag');
                // Still allow selection, just not dragging
                e.stopPropagation();
                handleNodeSelection(e); // Fixed: handleNodeSelection takes event, not node+event
                return;
            }

            e.stopPropagation(); // Prevent canvas panning

            // Multi-selection drag logic
            const isSelected = selectedNodes.has(node);
            const isShift = e.shiftKey || shiftKeyDown;

            if (!isSelected && !isShift) {
                // If clicking an unselected node without shift, select it (clearing others)
                selectNode(node, false);
                // Mark as just selected so click handler doesn't toggle it immediately
                if (isShift) { node.dataset.justSelectedInMousedown = 'true'; }
            } else if (!isSelected && isShift) {
                // If clicking unselected with shift, add to selection
                selectNode(node, true);
                // Mark as just selected so click handler knows we just did this
                node.dataset.justSelectedInMousedown = 'true';
            }
            // If clicking a selected node, DO NOT deselect others yet. 
            // We wait to see if it's a drag or a click.

            isDraggingNode = true;
            draggedNode = node;
            hasDragged = false; // Reset drag flag

            const rect = node.getBoundingClientRect();
            nodeOffsetX = e.clientX - rect.left;
            nodeOffsetY = e.clientY - rect.top;

            nodeStartX = parseFloat(node.style.left) || 0;
            nodeStartY = parseFloat(node.style.top) || 0;

            lastDragX = e.clientX;
            lastDragY = e.clientY;

            if (contentDiv) {
                const images = contentDiv.querySelectorAll('img');
                images.forEach(img => {
                    img.style.pointerEvents = 'none';
                });
            }

            document.addEventListener('mousemove', moveNode);
            document.addEventListener('mouseup', stopNodeDrag);

            // We don't add 'dragging' class immediately to avoid visual glitch on simple click
            // node.classList.add('dragging'); 
        });

        // Add direct click handler for node selection
        node.addEventListener('click', (e) => {
            // If we dragged, don't process click for selection
            if (hasDragged) return;
            handleNodeSelection(e);
        });
    }

    // Strip is now just visual - color changes via Action Bar only
    // No need for double-click listener

    // Content editing and paste handlers
    if (contentDiv) {
        // Setup content editing (only for default nodes or nodes that support it)
        // Canvas and Transform nodes should not be content-editable
        if (nodeType !== 'canvas' && nodeType !== 'transform') {
            setupContentEditing(contentDiv, node);
        } else {
            // For special nodes, ensure content is not editable
            contentDiv.contentEditable = 'false';
            // Add a class to indicate this is a "solid" node (UI styling)
            node.classList.add('node-solid');
        }
        setupContentPasteHandlers(contentDiv);
        // Removed redundant click handler on contentDiv to prevent double-toggling
        // contentDiv.addEventListener('click', handleNodeSelection);

        // Removed MutationObserver for visibility toggle
    }

    // Connection pins
    if (leftPin && rightPin) {
        setupConnectionPins(node, leftPin, rightPin);
    }

    // --- Node Type Switch Button Listener (Placeholder) ---
    if (strip) { // Assuming the button will be inside the strip
        strip.addEventListener('click', e => {
            // Find the closest ancestor which is the switch button itself
            const switchButton = e.target.closest('.node-type-switch');
            if (switchButton) {
                e.stopPropagation();
                console.log("Node type switch button clicked for node:", node.id); // DEBUG LINE
                showNodeTypeSwitcher(node);
            }
        });
    }

    // Helper function for node selection (nested inside setupNodeEvents)
    function handleNodeSelection(e) {
        // Also check if the click was on the switch button or visibility toggle
        const isSwitchButton = e.target.closest('.node-type-switch');
        const isVisibilityToggle = e.target.closest('.node-visibility-toggle');

        const isInteractiveElement = (leftPin && e.target === leftPin) ||
            (rightPin && e.target === rightPin) ||
            (rightPin && e.target === rightPin) ||
            (typeof deleteBtn !== 'undefined' && deleteBtn && e.target === deleteBtn) ||
            (contentDiv && contentDiv.isContentEditable) ||
            isSwitchButton || // Check against switch button
            isVisibilityToggle; // Check against visibility toggle

        if (isInteractiveElement) {
            return;
        }

        e.stopPropagation();
        selectionActive = true;

        const isShift = e.shiftKey || e.ctrlKey || e.metaKey;
        const isSelected = node.classList.contains('selected');

        // Check if this click was part of a drag operation that already handled selection
        if (node.dataset.justSelectedInMousedown === 'true') {
            console.log('[Node Selection] Skipping toggle because node was just selected in mousedown');
            delete node.dataset.justSelectedInMousedown;
            return;
        }

        console.log('[Node Selection]', {
            nodeId: node.id,
            isShift,
            isSelected,
            currentSize: window.selectedNodes.size
        });

        if (isShift) {
            // Shift key: toggle this node in/out of selection
            if (isSelected) {
                // Remove from selection
                deselectNode(node);
            } else {
                // Add to selection
                selectNode(node, true);
            }
        } else {
            // Normal click: select only this node (if not already selected exclusively)
            // If we are here, it means we didn't drag.
            // If it's already selected and we are the ONLY one selected, do nothing.
            // If others are selected, clear them and select this one.
            if (!isSelected || window.selectedNodes.size > 1) {
                selectNode(node, false);
            }
        }
    }
}

// Node movement handler - Updated for alt-key duplication
function moveNode(e) {
    if (!isDraggingNode || !draggedNode) return;

    hasDragged = true; // Mark that we have actually moved

    // Check if this is the first movement with Alt key pressed
    if (altKeyDown && !isDuplicating && selectedNodes.size > 0) {
        // Enter duplication mode
        isDuplicating = true;

        // Duplicate the selected nodes
        duplicatedNodes = duplicateSelectedNodes();

        // Change to the duplicated nodes
        if (duplicatedNodes.length > 0) {
            // Keep track of original selected nodes
            const originalNodes = Array.from(selectedNodes);

            // Clear selected and select duplicates
            clearSelectedNodes();

            // Select the duplicated nodes
            duplicatedNodes.forEach(node => {
                selectNode(node, true);
            });

            // Update the dragged node reference
            if (draggedNode) {
                // Find the corresponding duplicated node
                const index = originalNodes.indexOf(draggedNode);
                if (index >= 0 && index < duplicatedNodes.length) {
                    draggedNode = duplicatedNodes[index];
                }
            }
        }
    }

    // Calculate the delta movement
    const dx = e.clientX - lastDragX;
    const dy = e.clientY - lastDragY;

    // Move all selected nodes (or just the dragged one)
    const nodesToMove = selectedNodes.size > 0 ? selectedNodes : new Set([draggedNode]);

    // === SMART GUIDES INTEGRATION ===
    // Calculate snap offset based on alignment with other nodes
    // Hold SHIFT to temporarily disable snapping for free movement
    let snapOffsetX = 0;
    let snapOffsetY = 0;
    const isShiftPressed = e.shiftKey;

    if (window.smartGuides && window.smartGuides.enabled && !isShiftPressed) {
        const otherNodes = window.smartGuides.getOtherNodes(nodesToMove);

        // First, apply the raw delta to get projected position
        nodesToMove.forEach(node => {
            if (!node.classList.contains('locked-by-other')) {
                const currentX = parseFloat(node.style.left) || 0;
                const currentY = parseFloat(node.style.top) || 0;
                node.style.left = `${currentX + dx / window.canvasScale}px`;
                node.style.top = `${currentY + dy / window.canvasScale}px`;
            }
        });

        // Then calculate snap based on new position
        const snapResult = window.smartGuides.calculateSnap(nodesToMove, otherNodes);
        snapOffsetX = snapResult.snapX;
        snapOffsetY = snapResult.snapY;

        // Apply snap offset to all moved nodes
        if (snapOffsetX !== 0 || snapOffsetY !== 0) {
            nodesToMove.forEach(node => {
                if (!node.classList.contains('locked-by-other')) {
                    const currentX = parseFloat(node.style.left) || 0;
                    const currentY = parseFloat(node.style.top) || 0;
                    node.style.left = `${currentX + snapOffsetX}px`;
                    node.style.top = `${currentY + snapOffsetY}px`;
                }
            });
        }

        // Show or hide guides
        if (snapResult.guides.length > 0) {
            window.smartGuides.showGuides(snapResult.guides);
        } else {
            window.smartGuides.hideGuides();
        }

        // Ensure dragging class is on all nodes
        nodesToMove.forEach(node => {
            if (!node.classList.contains('dragging')) {
                node.classList.add('dragging');
            }
        });
    } else {
        // No smart guides OR Shift pressed - original behavior + hide any visible guides
        if (window.smartGuides) {
            window.smartGuides.hideGuides();
        }

        nodesToMove.forEach(node => {
            if (node.classList.contains('locked-by-other')) {
                console.log('[Nodes] Skipping locked node:', node.id);
                return;
            }

            if (!node.classList.contains('dragging')) {
                node.classList.add('dragging');
            }

            const currentX = parseFloat(node.style.left) || 0;
            const currentY = parseFloat(node.style.top) || 0;
            node.style.left = `${currentX + dx / window.canvasScale}px`;
            node.style.top = `${currentY + dy / window.canvasScale}px`;
        });
    }

    // Update last position for next delta calculation
    lastDragX = e.clientX;
    lastDragY = e.clientY;

    // Update connections
    if (window.updateNodeConnections) {
        window.updateNodeConnections();
    }

    // Update group bounds if any of the moved nodes are in a group
    if (window.getGroupForNode && window.updateGroupBounds) {
        const updatedGroups = new Set();
        nodesToMove.forEach(node => {
            const group = window.getGroupForNode(node.id);
            if (group && !updatedGroups.has(group.id)) {
                window.updateGroupBounds(group);
                updatedGroups.add(group.id);
            }
        });
    }
}

// Throttled connection updates for smoother dragging
let lastConnectionUpdate = 0;
const connectionThrottleTime = 10; // ms

function updateNodeConnectionsThrottled() {
    const now = Date.now();
    if (now - lastConnectionUpdate >= connectionThrottleTime) {
        if (window.updateNodeConnections) {
            window.updateNodeConnections();
        }
        lastConnectionUpdate = now;
    }
}

// Make function available globally
window.updateNodeConnectionsThrottled = updateNodeConnectionsThrottled;

// Stop node dragging and finalize position/duplication
function stopNodeDrag() {
    if (!isDraggingNode) return;

    isDraggingNode = false;

    // Remove dragging class from dragged node and all selected nodes
    if (draggedNode) draggedNode.classList.remove('dragging');
    if (selectedNodes.size > 0) {
        selectedNodes.forEach(node => node.classList.remove('dragging'));
    }

    // Hide smart guides
    if (window.smartGuides) {
        window.smartGuides.hideGuides();
    }

    document.body.style.cursor = ''; // Restore default cursor

    // Add history action for the move/duplication
    let moveAction = null;
    // Ensure createMoveActions is available (it might be in history.js or main.js)
    if (!isDuplicating && window.actionHistory && !window.actionHistory.isPerformingAction && window.createMoveActions) {
        moveAction = window.createMoveActions();
        if (moveAction) {
            window.actionHistory.addAction(moveAction);
        }
    } else if (isDuplicating && window.actionHistory && !window.actionHistory.isPerformingAction && duplicatedNodes.length > 0) {
        // Create actions for the duplicated nodes
        const actions = duplicatedNodes.map(node => {
            const contentDiv = node.querySelector('.content');
            const content = contentDiv ? contentDiv.innerHTML : '';
            const placeholder = getPlaceholderText();
            const finalContent = content === placeholder ? null : content;
            // Color resolution: 1. Dataset (Source of Truth), 2. Icon Wrapper, 3. Strip (Legacy)
            let stripColor = node.dataset.color;
            if (!stripColor) {
                const iconWrapper = node.querySelector('.node-icon-wrapper');
                if (iconWrapper) stripColor = iconWrapper.style.backgroundColor;
                else {
                    const strip = node.querySelector('.strip');
                    if (strip) stripColor = strip.style.backgroundColor;
                }
            }
            const nodeType = node.dataset.nodeType || 'default';

            return new window.NodeCreateAction(
                node.id,
                { x: parseInt(node.style.left), y: parseInt(node.style.top) },
                finalContent,
                nodeType,
                stripColor
            );
        });

        // Create group action
        const groupAction = new window.ActionGroup('duplicateNodes', actions);
        window.actionHistory.addAction(groupAction);
    }

    // Reset duplication state
    isDuplicating = false;
    duplicatedNodes = [];

    // Clean up listeners
    document.removeEventListener('mousemove', moveNode);
    document.removeEventListener('mouseup', stopNodeDrag);

    // Update connections now that drag is complete
    if (window.updateNodeConnections) {
        window.updateNodeConnections();
    }

    // Update viewport visibility
    if (window.viewportManager) {
        window.viewportManager.scheduleUpdate();
    }

    // Update group bounds if any of the moved nodes are in a group
    if (window.getGroupForNode && window.updateGroupBounds) {
        const movedNodes = selectedNodes.size > 0 ? Array.from(selectedNodes) : (draggedNode ? [draggedNode] : []);
        const updatedGroups = new Set();

        movedNodes.forEach(node => {
            const group = window.getGroupForNode(node.id);
            if (group && !updatedGroups.has(group.id)) {
                window.updateGroupBounds(group);
                updatedGroups.add(group.id);
            }
        });
    }

    // Update switcher position one last time
    updateSwitcherPosition();

    // Broadcast node positions for P2P sync (after move completes)
    if (window.p2pManager && window.p2pManager.connections.size > 0 && hasDragged) {
        const movedNodes = selectedNodes.size > 0 ? Array.from(selectedNodes) : (draggedNode ? [draggedNode] : []);
        movedNodes.forEach(node => {
            window.p2pManager.broadcast({
                type: 'node-update',
                nodeId: node.id,
                x: parseFloat(node.style.left) || 0,
                y: parseFloat(node.style.top) || 0
            });
        });
    }

    // Schedule auto-save if changes were made
    if (moveAction || isDuplicating) { // Trigger save if moved or duplicated
        if (window.scheduleAutoSave) window.scheduleAutoSave();
    }

    draggedNode = null;
}

// Select a node (with multi-select option)
function selectNode(node, isMultiSelect = false) {
    if (!node) return;

    // Ensure selection is marked as active
    selectionActive = true;

    // Toggle selection if node is already selected and multi-select is active
    if (selectedNodes.has(node) && isMultiSelect) {
        deselectNode(node);
        return;
    }

    if (!isMultiSelect) {
        // Clear previous selection if not multi-selecting
        clearSelectedNodes();
    }

    // Add to selected set
    selectedNodes.add(node);
    node.classList.add('selected');

    // Notify Action Bar
    if (window.actionBar) {
        window.actionBar.update(selectedNodes.size);
    }
    window.dispatchEvent(new CustomEvent('selectionChanged', { detail: { count: selectedNodes.size } }));

    // If node is in content-only mode (invisible), ensure it remains visible while selected
    // We don't remove the content-only-mode class, just ensure it's visible by CSS rules
    // This way when it's deselected, it will go back to content-only mode automatically
}

// Deselect a single node without affecting other selections
function deselectNode(node) {
    if (!node) return;

    // Remove from selected set and remove selected class
    node.classList.remove('selected');
    selectedNodes.delete(node);

    // Notify Action Bar
    if (window.actionBar) {
        console.log('[Nodes] deselectNode: Updating ActionBar to', selectedNodes.size);
        window.actionBar.update(selectedNodes.size);
    }
    window.dispatchEvent(new CustomEvent('selectionChanged', { detail: { count: selectedNodes.size } }));

    // When deselecting, let the node go back to its previous visibility state
    // which is handled by CSS, the content-only-mode class remains if it was there
}

// Get the position in canvas coordinates
function getNodeCanvasPosition(e) {
    // Use the canvas position utility from canvas.js
    if (window.getCanvasPosition) {
        return window.getCanvasPosition(e);
    }

    // Fallback implementation
    return {
        x: (e.clientX - window.canvasOffset.x) / window.canvasScale,
        y: (e.clientY - window.canvasOffset.y) / window.canvasScale
    };
}

// Set up connection pins
function setupConnectionPins(node, leftPin, rightPin) {
    [leftPin, rightPin].forEach(pin => {
        pin.addEventListener('mousedown', e => {
            // Connection starting logic
            e.stopPropagation();
            if (window.startConnection) {
                window.startConnection(e, node, pin);
            }
        });
    });
}

// Delete a node and its connections
function deleteNode(node) {
    if (!node) return;
    let deleted = false; // Flag to check if deletion actually happened

    // Capture node data for the undo operation
    // IMPORTANT: Only add action if NOT already being recorded (e.g. in batch operations)
    if (window.captureNodeData && window.actionHistory) {
        const isPerformingAction = window.actionHistory.isPerformingAction;

        // Only add individual action if we're not in a batch operation
        if (!isPerformingAction) {
            const nodeData = window.captureNodeData(node);
            if (nodeData) {
                // Create a delete action
                const deleteAction = new window.NodeDeleteAction(node.id, nodeData);
                window.actionHistory.addAction(deleteAction);
                console.log('[DeleteNode] Added individual delete action for', node.id);
            }
        } else {
            console.log('[DeleteNode] Skipping history - already in batch operation');
        }
    }

    // Remove connections first
    if (window.removeNodeConnections) {
        window.removeNodeConnections(node);
    }

    // Remove the node from any group it belongs to
    if (window.getGroupForNode && window.removeNodeFromGroup) {
        const group = window.getGroupForNode(node.id);
        if (group) {
            window.removeNodeFromGroup(node.id, group.id);
        }
    }

    // Remove the node from selected nodes if present
    selectedNodes.delete(node);

    // Broadcast node deletion for P2P sync (before DOM removal)
    if (window.p2pManager && window.p2pManager.connections.size > 0) {
        window.p2pManager.broadcast({
            type: 'node-delete',
            nodeId: node.id
        });
    }

    // Remove from DOM
    node.remove();
    deleted = true;

    // Schedule auto-save if a node was deleted
    if (deleted && window.scheduleAutoSave) window.scheduleAutoSave();
}

// Show color palette for changing node strip color
function showColorPalette(strip) {
    // Remove any existing color palette OR node type switcher
    document.querySelectorAll('.color-options, #node-type-switcher').forEach(popup => popup.remove());

    // Create a new color palette
    const colorOptions = document.createElement('div');
    colorOptions.className = 'color-options';

    // Add color swatches
    stripColors.forEach(color => {
        const colorSwatch = document.createElement('div');
        colorSwatch.className = 'color-swatch';
        colorSwatch.style.backgroundColor = color;
        colorSwatch.onclick = () => {
            setStripColor(strip, color);
            colorOptions.remove();
        };
        colorOptions.appendChild(colorSwatch);
    });

    strip.appendChild(colorOptions);

    // Close the color palette when clicking outside
    document.addEventListener('click', function closeColorPalette(e) {
        if (!strip.contains(e.target) || e.target.classList.contains('color-swatch')) {
            colorOptions.remove();
            document.removeEventListener('click', closeColorPalette);
        }
    });
}

// Set the color of a node strip
function setStripColor(strip, color) {
    const originalColor = strip.style.backgroundColor;
    if (originalColor === color) return; // Don't save if color didn't change

    strip.style.backgroundColor = color;

    // Update connections to reflect the color change
    const node = strip.closest('.node');
    if (window.updateNodeConnectionsForNode) {
        updateNodeConnectionsForNode(node);
    }

    // Schedule auto-save
    if (window.scheduleAutoSave) window.scheduleAutoSave();
}

// Setup handlers to ensure pasted content is clean
function setupContentPasteHandlers(contentDiv) {
    // Handle paste events
    contentDiv.addEventListener('paste', e => {
        const clipboardData = e.clipboardData || window.clipboardData;
        const items = clipboardData.items;

        if (!items) return;

        let hasHandledContent = false;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Handle image paste
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                hasHandledContent = true;

                // Check if the content div has placeholder text and remove it first
                if (contentDiv.classList.contains('is-placeholder')) {
                    contentDiv.classList.remove('is-placeholder');
                    contentDiv.innerHTML = ''; // Clear the placeholder text
                }

                const file = item.getAsFile();
                const reader = new FileReader();

                reader.onload = event => {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    img.style.maxWidth = '100%';
                    contentDiv.appendChild(img);

                    // Make the image resizable
                    makeNodeResizable(contentDiv.closest('.node'));

                    // Schedule auto-save since content changed
                    if (window.scheduleAutoSave) window.scheduleAutoSave();
                };

                reader.readAsDataURL(file);
            }

            // Handle HTML paste (iframes, etc.)
            else if (item.type === 'text/html') {
                e.preventDefault();
                hasHandledContent = true;
                const html = clipboardData.getData('text/html');

                // Check if the content div has placeholder text and remove it first
                if (contentDiv.classList.contains('is-placeholder')) {
                    contentDiv.classList.remove('is-placeholder');
                    contentDiv.innerHTML = ''; // Clear the placeholder text
                }

                // Create a temporary div to parse the HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;

                // Process iframes
                const iframes = tempDiv.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    // Ensure iframe has proper attributes
                    iframe.setAttribute('frameborder', '0');
                    iframe.setAttribute('allowfullscreen', 'true');
                    iframe.style.maxWidth = '100%';
                    iframe.style.border = 'none';

                    // Add the iframe to the content
                    contentDiv.appendChild(iframe);

                    // Make the iframe resizable
                    makeNodeResizable(contentDiv.closest('.node'));
                });

                // Process other HTML content
                const otherContent = Array.from(tempDiv.childNodes).filter(node =>
                    node.nodeType === Node.TEXT_NODE ||
                    (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'IFRAME')
                );

                if (otherContent.length > 0) {
                    const contentWrapper = document.createElement('div');
                    contentWrapper.innerHTML = otherContent.map(node =>
                        node.nodeType === Node.TEXT_NODE ? node.textContent : node.outerHTML
                    ).join('');
                    contentDiv.appendChild(contentWrapper);
                }
            }

            // Handle plain text paste
            else if (item.type === 'text/plain' && !hasHandledContent) {
                e.preventDefault();
                hasHandledContent = true;
                const text = clipboardData.getData('text/plain');

                // Check if the content div has placeholder text and remove it first
                if (contentDiv.classList.contains('is-placeholder')) {
                    contentDiv.classList.remove('is-placeholder');
                    contentDiv.innerHTML = ''; // Clear the placeholder text
                }

                // Check if the text contains HTML-like content
                if (text.includes('<') && text.includes('>')) {
                    // Try to parse as HTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = text;

                    // If it contains iframes, handle them
                    const iframes = tempDiv.querySelectorAll('iframe');
                    if (iframes.length > 0) {
                        iframes.forEach(iframe => {
                            iframe.setAttribute('frameborder', '0');
                            iframe.setAttribute('allowfullscreen', 'true');
                            iframe.style.maxWidth = '100%';
                            iframe.style.border = 'none';
                            contentDiv.appendChild(iframe);
                            makeNodeResizable(contentDiv.closest('.node'));
                        });
                    } else {
                        // If no iframes, treat as rich text
                        contentDiv.innerHTML += tempDiv.innerHTML;
                    }
                } else {
                    // Regular text, preserve formatting
                    const p = document.createElement('p');
                    p.textContent = text;
                    contentDiv.appendChild(p);
                }
            }
        }
    });

    // Handle drag and drop
    contentDiv.addEventListener('dragover', e => e.preventDefault());

    contentDiv.addEventListener('drop', e => {
        e.preventDefault();
        const files = e.dataTransfer.files;

        if (files.length > 0) {
            if (files[0].type.startsWith('image/')) {
                // Check if the content div has placeholder text and remove it first
                if (contentDiv.classList.contains('is-placeholder')) {
                    contentDiv.classList.remove('is-placeholder');
                    contentDiv.innerHTML = ''; // Clear the placeholder text
                }

                const reader = new FileReader();

                reader.onload = event => {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    img.style.maxWidth = '100%';
                    contentDiv.appendChild(img);

                    // Make the image resizable
                    makeNodeResizable(contentDiv.closest('.node'));

                    // Schedule auto-save since content changed
                    if (window.scheduleAutoSave) window.scheduleAutoSave();
                };

                reader.readAsDataURL(files[0]);
            }
        }
    });
}

// Set up content editing with double-click
function setupContentEditing(contentDiv, node) {
    // Make content not editable by default
    contentDiv.contentEditable = 'false';

    // Store original content for undo/redo
    let originalContent = contentDiv.innerHTML;
    const placeholder = getPlaceholderText(); // Get placeholder text

    // Set up content editing with double-click
    contentDiv.addEventListener('dblclick', e => {
        e.stopPropagation();

        // Check if node is locked by another user
        if (node.classList.contains('locked-by-other')) {
            console.log('[Nodes] Cannot edit - node is locked by another user');
            // Visual feedback - shake the lock avatar
            const lockAvatar = node.querySelector('.node-lock-avatar');
            if (lockAvatar) {
                lockAvatar.style.animation = 'shake 0.3s ease';
                setTimeout(() => lockAvatar.style.animation = '', 300);
            }
            return; // Prevent editing
        }

        // Store the content *before* potential placeholder clearing
        originalContent = contentDiv.innerHTML;

        // Make content editable on double-click
        contentDiv.contentEditable = 'true';
        contentDiv.focus();

        // Add a class to the node to indicate it's in edit mode
        node.classList.add('editing');

        // Broadcast node lock for P2P collaboration
        if (window.p2pManager && window.p2pManager.connections.size > 0) {
            window.p2pManager.lockNode(node.id);
        }

        // Clear content only if it's the placeholder text (using textContent comparison)
        if (contentDiv.textContent.trim() === placeholder.trim()) { // Use textContent and trim for robust check
            contentDiv.innerHTML = ''; // Clear content
            contentDiv.classList.remove('is-placeholder'); // Remove placeholder class
        }

        // Position cursor at end of text
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(contentDiv);
        range.collapse(false); // Collapse to end
        sel.removeAllRanges();
        sel.addRange(range);
    });

    // Handle Tab key to create connected node
    contentDiv.addEventListener('keydown', e => {
        if (e.key === 'Tab' && contentDiv.isContentEditable && contentDiv.contentEditable === 'true') {
            e.preventDefault();

            // Get current node position and color
            const currentNodeX = parseInt(node.style.left) || 0;
            const currentNodeY = parseInt(node.style.top) || 0;
            const currentNodeWidth = node.offsetWidth || 200;
            const currentNodeHeight = node.offsetHeight || 100;

            // Get strip color from current node
            const stripElement = node.querySelector('.strip');
            const stripColor = stripElement ? stripElement.style.backgroundColor : '#67a772';

            // Calculate new node position (to the right, non-overlapping)
            const gap = 150; // Increased gap for better spacing
            const newX = currentNodeX + currentNodeWidth + gap;
            const newY = currentNodeY;

            // Finish editing current node
            contentDiv.blur();

            // Create new node
            const nodeType = node.dataset.nodeType || 'default';
            const newNode = createNode(newX, newY, null, nodeType, null, stripColor);

            if (newNode) {
                // Create connection from current node to new node using IDs
                if (window.createConnection) {
                    // createConnection expects: (sourceNodeId, targetNodeId, sourcePin, targetPin, color)
                    window.createConnection(node.id, newNode.id, 'right', 'left', null);
                }

                // Pan viewport to the new node
                if (window.viewportManager && window.viewportManager.panToNode) {
                    setTimeout(() => {
                        window.viewportManager.panToNode(newNode, true);
                    }, 100);
                }

                // Auto-edit the new node
                setTimeout(() => {
                    const newContentDiv = newNode.querySelector('.content');
                    if (newContentDiv) {
                        // Simulate double-click to enter edit mode
                        const dblClickEvent = new MouseEvent('dblclick', {
                            bubbles: true,
                            cancelable: true
                        });
                        newContentDiv.dispatchEvent(dblClickEvent);
                    }
                }, 200);
            }
        }
    });

    // Handle content changes while editing (input event)
    contentDiv.addEventListener('input', e => {
        // Remove placeholder class as soon as user types something
        if (contentDiv.classList.contains('is-placeholder')) {
            contentDiv.classList.remove('is-placeholder');
        }
        // Future: Add logic for rich text handling if needed

        // Trigger node update
        if (window.nodeSystem) window.nodeSystem.triggerNodeUpdate(node.id);
    });

    contentDiv.addEventListener('blur', () => {
        // Make content not editable when focus is lost
        contentDiv.contentEditable = 'false';

        // Remove the editing class
        node.classList.remove('editing');

        // Broadcast node unlock for P2P collaboration
        if (window.p2pManager && window.p2pManager.connections.size > 0) {
            window.p2pManager.unlockNode(node.id);

            // Also broadcast content update
            window.p2pManager.broadcast({
                type: 'node-update',
                nodeId: node.id,
                content: contentDiv.innerHTML
            });
        }

        // --- REFINED HISTORY & PLACEHOLDER LOGIC ---
        // Capture content *before* potential placeholder restoration
        const contentBeforePlaceholderRestore = contentDiv.innerHTML;

        // Restore placeholder if content is empty
        const isEmpty = contentBeforePlaceholderRestore.trim() === '' || contentBeforePlaceholderRestore === '<br>';
        if (isEmpty) {
            contentDiv.innerHTML = placeholder;
            contentDiv.classList.add('is-placeholder'); // Add placeholder class back
        }

        // Record content change in history if the content *before* placeholder restore
        // is different from the content when editing started (`originalContent` from dblclick).
        const finalContent = contentDiv.innerHTML; // Content after potential placeholder restore
        let contentChanged = originalContent !== contentBeforePlaceholderRestore;

        if (contentChanged && window.actionHistory && !window.actionHistory.isPerformingAction) {
            // Handle case where user edited and left non-empty content
            const action = new window.NodeContentEditAction(
                node.id,
                originalContent,                  // Content when editing began
                contentBeforePlaceholderRestore   // Content just before blur finished (might be empty)
            );
            window.actionHistory.addAction(action);
            originalContent = contentBeforePlaceholderRestore; // Update baseline for next edit
            // Schedule auto-save since content changed and was recorded
            if (window.scheduleAutoSave) window.scheduleAutoSave();
        } else if (isEmpty && originalContent !== placeholder && window.actionHistory && !window.actionHistory.isPerformingAction) {
            // Also record if the user deleted everything, resulting in placeholder restoration
            const action = new window.NodeContentEditAction(
                node.id,
                originalContent,          // Original non-placeholder text
                placeholder              // Final content is placeholder
            );
        }
        // --- END REFINEMENT ---

        // Trigger final update on blur
        if (window.nodeSystem) window.nodeSystem.triggerNodeUpdate(node.id);
    });
}

// Make node resizable by adding a resize handle to it
function makeNodeResizable(node) {
    // Create resize handle if it doesn't exist already
    if (!node.querySelector('.node-resize-handle')) {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'node-resize-handle';

        // Create SVG arc for resize handle - Vision Pro style
        const svgNamespace = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNamespace, "svg");
        svg.setAttribute("width", "28");
        svg.setAttribute("height", "28");
        svg.setAttribute("viewBox", "0 0 28 28");

        // Create a curved path for a more elegant resize handle
        const path = document.createElementNS(svgNamespace, "path");
        path.setAttribute("d", "M 1 27 A 26 26 0 0 0 27 1");
        path.setAttribute("stroke", "#4CAF50");
        path.setAttribute("stroke-width", "3");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");

        svg.appendChild(path);
        resizeHandle.appendChild(svg);

        node.appendChild(resizeHandle);

        // Add CSS styling for the Vision Pro style handle
        const styleId = 'node-resize-handle-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .node-resize-handle {
                    position: absolute;
                    bottom: -1rem;
                    right: -1rem;
                    width: 28px;
                    height: 28px;
                    cursor: nwse-resize;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    z-index: 10;
                    border-radius: 0 0 8px 0;
                }
                
                .node:hover .node-resize-handle {
                    opacity: 0.7;
                }
                
                .node-resize-handle:hover {
                    opacity: 1 !important;
                }
                
                /* Add a special class for when the node is being resized */
                .node.resizing {
                    transition: none !important;
                }
                
                /* Make sure content doesn't overflow during resize */
                .node .content {
                    overflow: auto;
                    max-width: 100%;
                    max-height: calc(100% - 30px); /* Account for strip height */
                }
                
                /* Disable media-resizable class */
                .media-resizable {
                    position: relative;
                    display: inline-block;
                }
                
                /* Hide all resize handles for media elements */
                .media-resize-handle {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Add event listener to start resize on mousedown
        resizeHandle.addEventListener('mousedown', e => {
            startNodeResize(e, node);
        });
    }
}

// Start node resize operation
function startNodeResize(e, node) {
    e.stopPropagation();
    e.preventDefault();

    // Add resizing class to disable transitions during resize
    node.classList.add('resizing');

    // Disable propagation to avoid drag-to-select while resizing
    document.body.classList.add('resizing-node');

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = node.offsetWidth;
    const startHeight = node.offsetHeight;
    const startLeft = parseInt(node.style.left) || 0;
    const startTop = parseInt(node.style.top) || 0;

    // Cache the content element for performance
    const contentDiv = node.querySelector('.content');

    // Get all media elements inside the node
    const mediaElements = contentDiv ? contentDiv.querySelectorAll('img, iframe') : [];

    // Store original media dimensions for aspect ratio preservation
    const mediaInfo = Array.from(mediaElements).map(media => ({
        element: media,
        aspectRatio: media.naturalWidth && media.naturalHeight ?
            media.naturalWidth / media.naturalHeight :
            media.width / media.height,
        originalWidth: media.width,
        originalHeight: media.height
    }));

    function resize(e) {
        // Calculate the new size based on mouse movement
        let newWidth = startWidth + (e.clientX - startX) / window.canvasScale;
        let newHeight = startHeight + (e.clientY - startY) / window.canvasScale;

        // Get default node dimensions from CSS or use reasonable defaults
        const defaultWidth = 150;
        const defaultHeight = 100;

        // Enforce minimum sizes
        newWidth = Math.max(newWidth, defaultWidth);
        newHeight = Math.max(newHeight, defaultHeight);

        // Apply the new size
        node.style.width = `${newWidth}px`;

        // When resizing horizontally, adjust media elements width first
        if (mediaInfo.length > 0) {
            mediaInfo.forEach(info => {
                const maxContentWidth = newWidth - 20; // Account for padding

                // Adjust media width to fit within the node
                if (info.originalWidth > maxContentWidth) {
                    // Calculate new width/height maintaining aspect ratio
                    const newMediaWidth = Math.min(maxContentWidth, info.originalWidth);
                    const newMediaHeight = newMediaWidth / info.aspectRatio;

                    // Apply new dimensions
                    info.element.style.width = `${newMediaWidth}px`;
                    info.element.style.height = `${newMediaHeight}px`;
                }
            });
        }

        // Calculate appropriate height based on content (Legacy Only)
        // App Nodes should be fully resizable without content constraints
        if (contentDiv && !node.classList.contains('app-node')) {
            // Temporarily remove any height constraint to measure real height
            contentDiv.style.height = 'auto';

            // Get the scrollHeight which represents all content
            const contentHeight = contentDiv.scrollHeight;

            // Add padding for the strip height (usually 30px)
            const stripHeight = 30;
            const paddingBottom = 10;

            // Calculate minimum required height
            const minRequiredHeight = contentHeight + stripHeight + paddingBottom;

            // Use the larger of: user-dragged height or content-required height
            newHeight = Math.max(newHeight, minRequiredHeight);
        }

        // Apply final height
        node.style.height = `${newHeight}px`;

        // Ensure content remains inside the node
        // Ensure content remains inside the node
        if (contentDiv && !node.classList.contains('app-node')) {
            contentDiv.style.maxHeight = `${newHeight - 40}px`; // Account for strip height and padding
        }

        // Update connections if node has any
        if (window.updateNodeConnectionsForNode) {
            window.updateNodeConnectionsForNode(node);
        }
    }

    function stopResize() {
        isResizing = false;
        // Remove the resizing class to re-enable transitions
        node.classList.remove('resizing');

        document.body.classList.remove('resizing-node');
        window.removeEventListener('mousemove', resize);
        window.removeEventListener('mouseup', stopResize);

        // Restore iframe interaction
        document.querySelectorAll('iframe').forEach(iframe => iframe.style.pointerEvents = '');

        // Schedule auto-save after resizing
        if (window.scheduleAutoSave) {
            window.scheduleAutoSave();
        }
    }

    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResize);
}

// Initialize shift-selection functionality
function initShiftSelection() {
    const canvas = document.getElementById('canvas');

    // Create selection rectangle element if it doesn't exist
    if (!shiftSelectRect) {
        shiftSelectRect = document.createElement('div');
        shiftSelectRect.className = 'shift-select-rect';
        shiftSelectRect.style.position = 'absolute';
        shiftSelectRect.style.border = '2px dashed #007bff';
        shiftSelectRect.style.backgroundColor = 'rgba(0, 123, 255, 0.15)'; // More visible blue background
        shiftSelectRect.style.display = 'none';
        shiftSelectRect.style.pointerEvents = 'none';
        shiftSelectRect.style.zIndex = '100';
        document.getElementById('canvas-content').appendChild(shiftSelectRect);
    }

    // Add event listeners for shift+mousedown on canvas to start selection
    canvas.addEventListener('mousedown', e => {
        // Only start selection if shift key is pressed and clicked directly on canvas
        if ((e.shiftKey || shiftKeyDown) &&
            (e.target === canvas || e.target.id === 'canvas-background' || e.target.id === 'canvas-content')) {
            e.preventDefault();
            e.stopPropagation();

            console.log('Starting shift selection');

            isShiftSelecting = true;
            const pos = window.getCanvasPosition(e);
            shiftSelectStart = pos;

            // Position and show selection rectangle
            shiftSelectRect.style.left = `${pos.x}px`;
            shiftSelectRect.style.top = `${pos.y}px`;
            shiftSelectRect.style.width = '0px';
            shiftSelectRect.style.height = '0px';
            shiftSelectRect.style.display = 'block';

            document.addEventListener('mousemove', updateShiftSelection);
            document.addEventListener('mouseup', endShiftSelection);
        }
    });
}

// Update the selection rectangle as mouse moves
function updateShiftSelection(e) {
    if (!isShiftSelecting) return;

    const currentPos = window.getCanvasPosition(e);

    // Calculate top-left corner and dimensions
    const left = Math.min(shiftSelectStart.x, currentPos.x);
    const top = Math.min(shiftSelectStart.y, currentPos.y);
    const width = Math.abs(currentPos.x - shiftSelectStart.x);
    const height = Math.abs(currentPos.y - shiftSelectStart.y);

    // Update selection rectangle
    shiftSelectRect.style.left = `${left}px`;
    shiftSelectRect.style.top = `${top}px`;
    shiftSelectRect.style.width = `${width}px`;
    shiftSelectRect.style.height = `${height}px`;
}

// End shift selection and select nodes within the rectangle
function endShiftSelection(e) {
    if (!isShiftSelecting) return;

    const currentPos = window.getCanvasPosition(e);

    // Calculate the selection box coordinates
    const selectLeft = Math.min(shiftSelectStart.x, currentPos.x);
    const selectTop = Math.min(shiftSelectStart.y, currentPos.y);
    const selectRight = Math.max(shiftSelectStart.x, currentPos.x);
    const selectBottom = Math.max(shiftSelectStart.y, currentPos.y);

    console.log('Shift selection box:', selectLeft, selectTop, selectRight, selectBottom);

    // Mark selection as active
    selectionActive = true;

    // Check which nodes are within the selection rectangle
    const nodes = document.querySelectorAll('.node');
    let nodesSelected = 0;

    nodes.forEach(node => {
        const nodeLeft = parseInt(node.style.left);
        const nodeTop = parseInt(node.style.top);
        const nodeRight = nodeLeft + node.offsetWidth;
        const nodeBottom = nodeTop + node.offsetHeight;

        // More forgiving intersection check - node is selected if it intersects with selection rectangle
        if (!(nodeRight < selectLeft ||
            nodeLeft > selectRight ||
            nodeBottom < selectTop ||
            nodeTop > selectBottom)) {
            // Add to multi-selection with shift key
            selectNode(node, true);
            nodesSelected++;
        }
    });

    console.log(`Selected ${nodesSelected} nodes with shift selection`);

    // Hide selection rectangle and clean up
    shiftSelectRect.style.display = 'none';
    isShiftSelecting = false;

    // Remove event listeners
    document.removeEventListener('mousemove', updateShiftSelection);
    document.removeEventListener('mouseup', endShiftSelection);

    // Set a flag to prevent the click event (which fires after mouseup) from clearing the selection
    window.justFinishedShiftSelection = true;
    setTimeout(() => {
        window.justFinishedShiftSelection = false;
    }, 100);
}

// Initialize node management system
function initNodeManagement() {
    console.log('Initializing node management system');

    // Add delegated event listener for node resizing
    const canvasContent = document.getElementById('canvas-content');



    // Capture node data for saving
    window.captureNodeData = function (node) {
        const strip = node.querySelector('.strip');
        const contentDiv = node.querySelector('.content');

        // Base data
        // Try to get title from DOM first (most up to date if editing), then dataset
        const titleEl = node.querySelector('.node-title');
        const currentTitle = titleEl ? titleEl.innerText.trim() : (node.dataset.nodeTitle || null);

        const data = {
            id: node.id,
            x: parseFloat(node.style.left),
            y: parseFloat(node.style.top),
            // Legacy content (innerHTML) - might be empty for App Nodes but harmless
            content: contentDiv ? contentDiv.innerHTML : '',
            stripColor: strip ? strip.style.backgroundColor : (window.stripColors ? window.stripColors[0] : '#c2f8cb'),
            // Important: Helper for identifying App Nodes vs Legacy
            type: node.dataset.type || 'default',
            contentOnly: node.classList.contains('content-only-mode'),
            width: node.style.width,
            height: node.style.height,
            // User-customized properties (CRITICAL for persistence)
            color: node.dataset.color || null,           // Icon wrapper background color
            nodeTitle: currentTitle,                     // Custom user-defined title
            locked: node.dataset.locked === 'true'       // Lock state
        };

        // Capture App Node State (The "Revolution" part)
        if (node.dataset.savedState) {
            try {
                data.appState = JSON.parse(node.dataset.savedState);
            } catch (e) {
                console.warn('Failed to parse savedState for node', node.id);
                data.appState = {};
            }
        }

        // Custom data serialization (Legacy support)
        if (typeof node.serialize === 'function') {
            data.customData = node.serialize();
        }

        return data;
    };
    if (canvasContent) {
        canvasContent.addEventListener('mousedown', (e) => {
            const handle = e.target.closest('.node-resize-handle');
            if (handle) {
                e.preventDefault();
                e.stopPropagation();
                const node = handle.closest('.node');
                if (node) {
                    startNodeResize(e, node);
                }
            }
        }, true); // Use capture phase
    } else {
        console.error("Canvas content element not found for resize delegation.");
    }

    // Initialize shift selection
    initShiftSelection();

    // Add handlers for shift key state
    document.addEventListener('keydown', e => {
        if (e.key === 'Shift') {
            shiftKeyDown = true;

            // Change cursor to crosshair when shift is pressed
            const canvas = document.getElementById('canvas');
            if (canvas) {
                canvas.style.cursor = 'crosshair';
            }
        }

        // Track Alt/Option key for duplication
        if (e.key === 'Alt' || e.key === 'Option') {
            altKeyDown = true;

            // Only if we have a node selected, change cursor to indicate duplication
            if (selectedNodes.size > 0) {
                document.body.style.cursor = 'copy';
            }
        }

        // F key for Focus Mode toggle (single node only)
        if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            // Don't trigger if typing in input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            if (selectedNodes.size === 1 && window.actionBar) {
                const node = Array.from(selectedNodes)[0];
                window.actionBar.toggleFocusMode(node);
                e.preventDefault();
            }
        }
    });

    document.addEventListener('keyup', e => {
        if (e.key === 'Shift') {
            shiftKeyDown = false;

            // Restore default cursor when shift is released
            const canvas = document.getElementById('canvas');
            if (canvas) {
                canvas.style.cursor = '';
            }
        }

        // Track Alt/Option key release
        if (e.key === 'Alt' || e.key === 'Option') {
            altKeyDown = false;

            // Restore default cursor
            document.body.style.cursor = '';
        }
    });

    // ========== MODIFIER KEY FIX (AGGRESSIVE) ==========
    // Reset modifier states when window loses focus OR regains focus
    // This fixes the "stuck key" issue when using Shift+Cmd+4 (screenshot) etc.

    function resetAllModifierStates() {
        shiftKeyDown = false;
        altKeyDown = false;
        const canvas = document.getElementById('canvas');
        if (canvas) canvas.style.cursor = '';
        document.body.style.cursor = '';
    }

    window.addEventListener('blur', () => {
        resetAllModifierStates();
        console.log('[Nodes] Window blur: modifier keys reset');
    });

    window.addEventListener('focus', () => {
        // AGGRESSIVE: Always reset on focus gain
        resetAllModifierStates();
        console.log('[Nodes] Window focus: modifier keys reset');
    });

    document.addEventListener('visibilitychange', () => {
        // Reset on any visibility change
        resetAllModifierStates();
        console.log('[Nodes] Visibility change: modifier keys reset');
    });

    // FALLBACK: Also reset on first mousedown after regaining focus
    let needsModifierReset = false;
    window.addEventListener('blur', () => { needsModifierReset = true; });
    document.addEventListener('mousedown', () => {
        if (needsModifierReset) {
            resetAllModifierStates();
            needsModifierReset = false;
            console.log('[Nodes] First mousedown after blur: modifier keys reset');
        }
    }, true); // Use capture phase

    // Track canvas panning separately from clicking
    let isPanning = false;
    const canvas = document.getElementById('canvas');

    canvas.addEventListener('mousedown', e => {
        // Only consider it panning if clicking directly on canvas (not on nodes)
        if ((e.target.id === 'canvas' ||
            e.target.id === 'canvas-background' ||
            e.target.id === 'canvas-content') &&
            !e.shiftKey) {
            isPanning = false; // Start with false, will become true if mouse moves

            // Set up panning detection
            const startX = e.clientX;
            const startY = e.clientY;

            const panningThreshold = 5; // px threshold to consider it panning

            function detectPanning(moveEvent) {
                const dx = Math.abs(moveEvent.clientX - startX);
                const dy = Math.abs(moveEvent.clientY - startY);

                // If moved more than threshold, it's panning
                if (dx > panningThreshold || dy > panningThreshold) {
                    isPanning = true;
                }
            }

            function cleanupPanDetection() {
                document.removeEventListener('mousemove', detectPanning);
                document.removeEventListener('mouseup', handlePanEnd);
            }

            function handlePanEnd(upEvent) {
                cleanupPanDetection();

                // If it was a simple click (not panning) and no shift key
                if (!isPanning &&
                    !shiftKeyDown &&
                    !upEvent.shiftKey &&
                    selectionActive &&
                    (upEvent.target.id === 'canvas' ||
                        upEvent.target.id === 'canvas-background' ||
                        upEvent.target.id === 'canvas-content')) {
                    // Clear selection on simple click
                    clearSelectedNodes();
                    selectionActive = false;
                }
            }

            document.addEventListener('mousemove', detectPanning);
            document.addEventListener('mouseup', handlePanEnd);
        }
    });

    // Add CSS for selection rectangle and other node styles
    const style = document.createElement('style');
    style.textContent = `
        .shift-select-rect {
            position: absolute;
            border: 2px dashed #007bff;
            background-color: rgba(0, 123, 255, 0.15);
            pointer-events: none;
            z-index: 100;
        }
        
        .node.dragging {
            opacity: 0.8;
        }
        
        .node.selected {
            box-shadow: 0 0 0 2px #007bff, 0 0 10px rgba(0, 123, 255, 0.5);
        }
        
        .node .content {
            user-select: none; /* Prevent text selection unless in edit mode */
        }
        
        .node .content[contenteditable="true"] {
            user-select: text; /* Enable text selection when editing */
        }
        
        .node.copy-flash {
            animation: copy-flash-animation 0.2s ease-in-out;
        }
        
        @keyframes copy-flash-animation {
            0% { box-shadow: 0 0 0 2px #007bff, 0 0 10px rgba(0, 123, 255, 0.5); }
            50% { box-shadow: 0 0 0 2px #00ff00, 0 0 20px rgba(0, 255, 0, 0.7); }
            100% { box-shadow: 0 0 0 2px #007bff, 0 0 10px rgba(0, 123, 255, 0.5); }
        }
    `;
    document.head.appendChild(style);

    console.log('Node management system initialized with improved selection behavior');

    // --- Patch deleteNode for Timer Cleanup (and potentially other types) ---
    // This ensures the patch happens after deleteNode is defined.
    if (window.deleteNode && !window.deleteNode.__cleanupPatched) {
        const originalDeleteNode = window.deleteNode;
        window.deleteNode = function (nodeToDelete) {
            console.log('Patched deleteNode called for', nodeToDelete?.id);
            // Call cleanup function if it exists on the node instance
            if (nodeToDelete && typeof nodeToDelete.cleanupTimer === 'function') {
                nodeToDelete.cleanupTimer();
            }
            // Add similar checks for other node types needing cleanup here...
            // if (nodeToDelete && typeof nodeToDelete.cleanupOtherType === 'function') { ... }

            // Call the original deleteNode function
            originalDeleteNode.apply(this, arguments);
        };
        window.deleteNode.__cleanupPatched = true; // Mark as patched
        console.log('window.deleteNode patched for node cleanup.');
    } else if (!window.deleteNode) {
        console.error('window.deleteNode not found during init, cannot patch for cleanup.');
    } else if (window.deleteNode.__cleanupPatched) {
        console.log('window.deleteNode already patched for cleanup.');
    }

    // Fix existing nodes: add resize handles and remove media resize functionality
    upgradeExistingNodes();
}

// Upgrade existing nodes to the new resize model
function upgradeExistingNodes() {
    console.log('Upgrading existing nodes to new resize model and adding visibility toggle');

    // Add resize handles to all existing nodes
    const nodes = document.querySelectorAll('.node');
    console.log(`Found ${nodes.length} nodes to upgrade with resize handles`);

    nodes.forEach(node => {
        // Add resize handle if missing
        if (!node.querySelector('.node-resize-handle')) {
            makeNodeResizable(node);
            console.log(`Added resize handle to node: ${node.id}`);
        }

        // Add visibility toggle if missing
        const strip = node.querySelector('.strip');
        const contentDiv = node.querySelector('.content');

        if (strip && !strip.querySelector('.node-visibility-toggle')) {
            const visibilityToggle = document.createElement('div');
            visibilityToggle.className = 'node-visibility-toggle';
            visibilityToggle.innerHTML = '<i class="fas fa-eye"></i>';
            visibilityToggle.title = 'Toggle node visibility';

            // Initial state check
            updateVisibilityToggleState(visibilityToggle, contentDiv);

            // Add click handler
            visibilityToggle.addEventListener('click', e => {
                e.stopPropagation();
                toggleNodeVisibility(node, visibilityToggle);
            });

            // Insert after node type switch (or at beginning if no switch)
            const typeSwitch = strip.querySelector('.node-type-switch');
            if (typeSwitch) {
                strip.insertBefore(visibilityToggle, typeSwitch.nextSibling);
            } else {
                strip.insertBefore(visibilityToggle, strip.firstChild);
            }

            console.log(`Added visibility toggle to node: ${node.id}`);
        }
    });

    // Remove old media resize functionality
    const mediaWrappers = document.querySelectorAll('.media-resizable');
    console.log(`Found ${mediaWrappers.length} media wrappers to remove`);

    mediaWrappers.forEach(wrapper => {
        const media = wrapper.querySelector('img, iframe');
        if (media && wrapper.parentNode) {
            // Move the media element out of the wrapper
            wrapper.parentNode.insertBefore(media, wrapper);
            wrapper.remove();

            // Set maxWidth to ensure media scales with node
            media.style.maxWidth = '100%';
        }
    });

    console.log('Node resize upgrade complete');
}

// Deprecated functions for backward compatibility
function makeMediaResizable(media) {
    // Simply find the parent node and make it resizable instead
    const node = media.closest('.node');
    if (node) {
        makeNodeResizable(node);
    }
}

function setupResizableWrapper(media) {
    // For backward compatibility - do nothing
    return;
}

function addResizeHandles(wrapper, media) {
    // For backward compatibility - do nothing
    return;
}

function startMediaResize(e, media, corner) {
    // For backward compatibility - do nothing
    return;
}

// Clear all selected nodes
function clearSelectedNodes() {
    console.log('[Nodes] clearSelectedNodes called. Current count:', selectedNodes.size);
    selectedNodes.forEach(node => {
        node.classList.remove('selected');

        // Clear any search highlights
        if (node.dataset.hasHighlight) {
            const highlights = node.querySelectorAll('.search-highlight');
            highlights.forEach(highlight => {
                const text = highlight.textContent;
                highlight.replaceWith(document.createTextNode(text));
            });
            delete node.dataset.hasHighlight;
        }
    });
    selectedNodes.clear();

    // Notify Action Bar
    if (window.actionBar) {
        console.log('[Nodes] Updating ActionBar to 0');
        window.actionBar.update(0);
    }
    window.dispatchEvent(new CustomEvent('selectionChanged', { detail: { count: 0 } }));
}

// Export functions to global scope
window.createNode = createNode;
window.createInitialNode = createInitialNode;
window.selectNode = selectNode;
window.deselectNode = deselectNode;
window.deleteNode = deleteNode;
window.setStripColor = setStripColor;
window.selectedNodes = selectedNodes;
window.clearSelectedNodes = clearSelectedNodes;
window.initNodeManagement = initNodeManagement; // Export for initialization
window.copySelectedNodes = copySelectedNodes; // Export copy function
window.pasteNodes = pasteNodes; // Export paste function

// Copy selected nodes to clipboard
function copySelectedNodes() {
    console.log('Copy nodes function called');

    if (selectedNodes.size === 0) {
        console.log('No nodes selected to copy');
        return false;
    }

    console.log(`Copying ${selectedNodes.size} selected nodes`);

    // Clear previous copied nodes
    copiedNodes = [];

    // Calculate center point of selection to preserve relative positioning
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    // First pass - find boundaries
    selectedNodes.forEach(node => {
        const x = parseInt(node.style.left) || 0;
        const y = parseInt(node.style.top) || 0;
        const width = node.offsetWidth || 0;
        const height = node.offsetHeight || 0;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
    });

    // Calculate selection center
    const selectionCenterX = minX + (maxX - minX) / 2;
    const selectionCenterY = minY + (maxY - minY) / 2;

    console.log('Selection boundaries:', { minX, minY, maxX, maxY });
    console.log('Selection center:', { selectionCenterX, selectionCenterY });

    // Create a map of original node IDs to their index in the copiedNodes array
    const nodeIdToIndexMap = new Map();

    // Store connections between selected nodes
    let internalConnections = [];

    // Process each selected node
    let index = 0;
    selectedNodes.forEach(node => {
        // Extract node properties
        const x = parseInt(node.style.left) || 0;
        const y = parseInt(node.style.top) || 0;

        // Calculate offset from selection center
        const offsetX = x - selectionCenterX;
        const offsetY = y - selectionCenterY;

        const contentDiv = node.querySelector('.content');
        let content = contentDiv ? contentDiv.innerHTML : '';

        // Get node type
        const nodeType = node.dataset.nodeType || 'default';

        // Special handling for checklist nodes
        if (nodeType === 'checklist' && node.getContentData) {
            // Use the node's method to get structured data if available
            content = node.getContentData();
            console.log('Copying checklist data:', content);
        } else {
            // Check if it's placeholder text for other node types
            const placeholder = getPlaceholderText();
            content = content === placeholder ? null : content;
        }

        // Get strip color
        const strip = node.querySelector('.strip');
        const stripColor = strip ? strip.style.backgroundColor : null;

        console.log(`Copying node ${index} (ID: ${node.id}):`, {
            position: { x, y },
            offset: { offsetX, offsetY },
            nodeType,
            hasContent: !!content
        });

        // Store the index in our map for connection tracking
        nodeIdToIndexMap.set(node.id, index);
        index++;

        // Create a copy of the node data (not the DOM element)
        copiedNodes.push({
            content: content,
            nodeType: nodeType,
            stripColor: stripColor,
            offsetX: offsetX,
            offsetY: offsetY,
            originalId: node.id // Store original ID for connection mapping
        });
    });

    // After all nodes are processed, collect connections between them
    if (window.getNodeConnections) {
        // Get all connections
        const allConnections = window.getNodeConnections();

        // Filter connections where both ends are in our selected nodes
        allConnections.forEach(conn => {
            const sourceIndex = nodeIdToIndexMap.get(conn.source);
            const targetIndex = nodeIdToIndexMap.get(conn.target);

            // Only keep connections where both ends are in our selected set
            if (sourceIndex !== undefined && targetIndex !== undefined) {
                internalConnections.push({
                    sourceIndex: sourceIndex,
                    targetIndex: targetIndex,
                    color: conn.color
                });
                console.log(`Saving internal connection from ${sourceIndex} to ${targetIndex}`);
            }
        });
    }

    // Store the internal connections with the copied nodes
    if (internalConnections.length > 0) {
        console.log(`Copied ${internalConnections.length} internal connections`);
        // Store connections with the copiedNodes
        window.copiedConnections = internalConnections;
    } else {
        window.copiedConnections = [];
    }

    console.log(`Copied ${copiedNodes.length} nodes to clipboard`);

    // Flash the selected nodes to indicate they've been copied
    selectedNodes.forEach(node => {
        // Add a temporary flash effect
        node.classList.add('copy-flash');
        setTimeout(() => {
            node.classList.remove('copy-flash');
        }, 200);
    });

    return true;
}

// Paste copied nodes to the current viewport center
function pasteNodes() {
    console.log('Paste nodes function called');
    console.log('Copied nodes:', copiedNodes);

    if (copiedNodes.length === 0) {
        console.log('No nodes to paste - clipboard is empty');
        return false;
    }

    // Get current viewport center coordinates
    const canvas = document.getElementById('canvas');
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    console.log('Canvas offset:', window.canvasOffset);
    console.log('Canvas scale:', window.canvasScale);
    console.log('Viewport dimensions:', viewportWidth, viewportHeight);

    // Viewport merkezi hesaplama
    const viewportCenterX = -window.canvasOffset.x / window.canvasScale + viewportWidth / (2 * window.canvasScale);
    const viewportCenterY = -window.canvasOffset.y / window.canvasScale + viewportHeight / (2 * window.canvasScale);

    console.log('Viewport center calculated as:', viewportCenterX, viewportCenterY);

    // Clear current selection
    clearSelectedNodes();

    // Create a group action for history
    const actions = [];
    const createdNodes = [];

    // Create new nodes from the copied data
    copiedNodes.forEach((nodeData, index) => {
        // Calculate position using stored offsets to maintain relative positioning
        const x = viewportCenterX + (nodeData.offsetX || 0);
        const y = viewportCenterY + (nodeData.offsetY || 0);

        const nodeType = nodeData.nodeType || 'default';
        const content = nodeData.content;

        console.log(`Creating node ${index} at position:`, x, y);
        console.log(`Node type: ${nodeType}, Has content:`, !!content);

        // For checklist nodes, log the content for debugging
        if (nodeType === 'checklist' && content) {
            console.log('Pasting checklist with data:', content);
        }

        // Temporarily disable history for each node creation
        const wasPerformingAction = window.actionHistory ? window.actionHistory.isPerformingAction : false;
        if (window.actionHistory) window.actionHistory.isPerformingAction = true;

        // Create the new node
        const newNode = createNode(
            x,
            y,
            content,
            nodeType,
            null, // Generate new ID
            nodeData.stripColor
        );

        // Restore history state
        if (window.actionHistory) window.actionHistory.isPerformingAction = wasPerformingAction;

        if (newNode) {
            console.log(`Node ${index} created successfully with ID:`, newNode.id);
            // Select the new node
            selectNode(newNode, true);
            createdNodes.push(newNode);

            // Create an action for the history
            actions.push(new window.NodeCreateAction(
                newNode.id,
                { x, y },
                content,
                nodeType,
                nodeData.stripColor
            ));
        } else {
            console.error(`Failed to create node ${index}`);
        }
    });

    // Recreate connections between pasted nodes
    if (window.copiedConnections && window.copiedConnections.length > 0 && window.createConnection) {
        console.log(`Recreating ${window.copiedConnections.length} connections between pasted nodes`);

        window.copiedConnections.forEach(connData => {
            if (connData.sourceIndex < createdNodes.length && connData.targetIndex < createdNodes.length) {
                const sourceNode = createdNodes[connData.sourceIndex];
                const targetNode = createdNodes[connData.targetIndex];

                if (sourceNode && targetNode) {
                    console.log(`Creating connection from ${sourceNode.id} to ${targetNode.id}`);

                    // Find pins
                    const sourceRightPin = sourceNode.querySelector('.pin.right');
                    const targetLeftPin = targetNode.querySelector('.pin.left');

                    if (sourceRightPin && targetLeftPin) {
                        // Create the connection with the original color if available
                        window.createConnection(sourceNode.id, targetNode.id, sourceRightPin, targetLeftPin, connData.color);
                    } else {
                        console.warn('Could not find pins for connection');
                    }
                }
            }
        });
    }

    // Add the group action to history
    if (actions.length > 0 && window.actionHistory && !window.actionHistory.isPerformingAction) {
        const groupAction = new window.ActionGroup('pasteNodes', actions);
        window.actionHistory.addAction(groupAction);
    }

    // Schedule auto-save
    if (createdNodes.length > 0 && window.scheduleAutoSave) {
        window.scheduleAutoSave();
    }

    console.log(`Pasted ${createdNodes.length} nodes at viewport center`);
    return true;
}

// Duplicate selected nodes
function duplicateSelectedNodes() {
    if (selectedNodes.size === 0) return [];

    const duplicates = [];

    // Create a small offset for the duplicates
    const offsetX = 20 / window.canvasScale;
    const offsetY = 20 / window.canvasScale;

    // Create a map of original node IDs to their index in the duplicates array
    const nodeIdToIndexMap = new Map();

    // Store connections between selected nodes
    let internalConnections = [];

    // Process each selected node
    let index = 0;
    selectedNodes.forEach(node => {
        // Store the index in our map for connection tracking
        nodeIdToIndexMap.set(node.id, index);
        index++;

        // Clone the entire DOM node
        const clonedNode = node.cloneNode(true);

        // Generate new ID
        const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        clonedNode.id = newId;

        // Update position with offset
        const x = parseFloat(node.style.left) || 0;
        const y = parseFloat(node.style.top) || 0;
        clonedNode.style.left = `${x + offsetX}px`;
        clonedNode.style.top = `${y + offsetY}px`;

        // Remove selected state from clone
        clonedNode.classList.remove('selected', 'dragging');

        // Add to canvas
        const canvasContent = document.getElementById('canvas-content');
        canvasContent.appendChild(clonedNode);

        // Re-setup event listeners for the cloned node
        const strip = clonedNode.querySelector('.strip');
        const contentDiv = clonedNode.querySelector('.content');
        const leftPin = clonedNode.querySelector('.pin.left');
        const rightPin = clonedNode.querySelector('.pin.right');
        const nodeType = clonedNode.dataset.nodeType || 'default';

        // Setup standard node events
        setupNodeEvents(clonedNode, strip, contentDiv, leftPin, rightPin, nodeType);

        // For iframe-based nodes, use NodeLoader to properly recreate with state
        const iframe = clonedNode.querySelector('iframe');
        if (iframe && window.nodeLoader) {
            const savedState = clonedNode.dataset.savedState;
            const nodeType = clonedNode.dataset.nodeType || clonedNode.dataset.type;

            // Remove the cloned node (we'll create a proper one)
            clonedNode.remove();
            duplicates.pop(); // Remove from duplicates array

            // Parse saved state for initial data
            let initialData = {};
            if (savedState) {
                try {
                    initialData = JSON.parse(savedState);
                } catch (e) {
                    console.error('Error parsing savedState:', e);
                }
            }

            // Also copy title and color
            const titleEl = node.querySelector('.node-title');
            if (titleEl) initialData.title = titleEl.innerText;
            initialData.color = node.dataset.color;

            // Use NodeLoader to create a proper node with state
            const properNode = window.nodeLoader.createNode(
                nodeType,
                x + offsetX,
                y + offsetY,
                initialData,
                newId
            );

            if (properNode) {
                duplicates.push(properNode);
                // Re-setup standard node events
                const strip = properNode.querySelector('.strip');
                const contentDiv = properNode.querySelector('.content');
                const leftPin = properNode.querySelector('.pin.left');
                const rightPin = properNode.querySelector('.pin.right');
                setupNodeEvents(properNode, strip, contentDiv, leftPin, rightPin, nodeType);
            }
        } else {
            duplicates.push(clonedNode);
        }
    });

    // After all nodes are processed, collect connections between them
    if (window.getNodeConnections) {
        // Get all connections
        const allConnections = window.getNodeConnections();

        // Filter connections where both ends are in our selected nodes
        allConnections.forEach(conn => {
            const sourceIndex = nodeIdToIndexMap.get(conn.source);
            const targetIndex = nodeIdToIndexMap.get(conn.target);

            // Only keep connections where both ends are in our selected set
            if (sourceIndex !== undefined && targetIndex !== undefined) {
                internalConnections.push({
                    sourceIndex: sourceIndex,
                    targetIndex: targetIndex,
                    color: conn.color
                });
                console.log(`Found internal connection from ${sourceIndex} to ${targetIndex} for duplication`);
            }
        });
    }

    // Recreate connections between duplicated nodes
    if (internalConnections.length > 0 && window.createConnection) {
        console.log(`Recreating ${internalConnections.length} connections between duplicated nodes`);

        internalConnections.forEach(connData => {
            if (connData.sourceIndex < duplicates.length && connData.targetIndex < duplicates.length) {
                const sourceNode = duplicates[connData.sourceIndex];
                const targetNode = duplicates[connData.targetIndex];

                if (sourceNode && targetNode) {
                    console.log(`Creating connection from ${sourceNode.id} to ${targetNode.id}`);

                    // Find pins
                    const sourceRightPin = sourceNode.querySelector('.pin.right');
                    const targetLeftPin = targetNode.querySelector('.pin.left');

                    if (sourceRightPin && targetLeftPin) {
                        // Create the connection with the original color if available
                        window.createConnection(sourceNode.id, targetNode.id, sourceRightPin, targetLeftPin, connData.color);
                    } else {
                        console.warn('Could not find pins for connection');
                    }
                }
            }
        });
    }

    return duplicates;
}

// Function to display the node type switcher UI
function showNodeTypeSwitcher(node) {
    // Remove any existing switcher OR color palette first
    const existingPopups = document.querySelectorAll('#node-type-switcher, .color-options');
    if (existingPopups) {
        existingPopups.forEach(popup => popup.remove());
    }

    console.log("Showing node type switcher for node:", node.id);

    // 1. Get available types from window.nodeTypeLoaders
    const availableTypes = window.nodeTypeLoaders ? Object.keys(window.nodeTypeLoaders) : [];
    console.log("Available types:", availableTypes);

    if (availableTypes.length <= 1) {
        console.log("Only one node type available.");
        return;
    }

    // 2. Create the switcher dropdown container
    const switcher = document.createElement('div');
    switcher.id = 'node-type-switcher'; // ID for easy removal/styling
    switcher.className = 'node-type-options'; // Class for styling (similar to language options)
    switcher.style.position = 'absolute'; // Position relative to canvas-content
    switcher.style.zIndex = '110'; // Above nodes and selection rect
    switcher.dataset.nodeId = node.id; // Store associated node ID

    // 3. Populate with available types
    const currentType = node.dataset.nodeType || 'default';
    const currentLang = window.currentLanguage || 'en'; // Get current language

    // Define icons for node types
    const typeIcons = {
        default: 'fa-file-alt',
        checklist: 'fa-check-square',
        timer: 'fa-clock'
        // Add other types here
    };

    availableTypes.forEach(type => {
        const loader = window.nodeTypeLoaders[type];
        let typeName = type.charAt(0).toUpperCase() + type.slice(1); // Default name

        // Try to get localized name from the loader function itself
        if (loader && typeof loader.getTexts === 'function') {
            const texts = loader.getTexts();
            typeName = texts.nodeName?.[currentLang] || texts.nodeName?.['en'] || typeName;
        } else {
            console.warn(`Node type loader for '${type}' does not expose getTexts() for localized name.`);
        }

        const option = document.createElement('div');
        option.className = 'node-type-option';
        option.dataset.type = type;
        // option.textContent = typeName; // Use icon instead of text

        // Add icon to option
        const iconClass = typeIcons[type] || 'fa-question-circle'; // Default icon if not defined
        const iconElement = document.createElement('i');
        iconElement.className = `fas ${iconClass}`;
        option.appendChild(iconElement);
        option.title = typeName; // Set tooltip to the type name

        if (type === currentType) {
            option.classList.add('active');
        }

        option.addEventListener('click', (e) => {
            e.stopPropagation();
            if (type !== currentType) {
                changeNodeType(node, type);
            }
            switcher.remove();
        });
        switcher.appendChild(option);
    });

    // 4. Position the switcher relative to the node
    // Append to canvas-content for absolute positioning relative to canvas items
    const canvasContent = document.getElementById('canvas-content');
    canvasContent.appendChild(switcher);

    // Get node position *within* canvas-content
    const nodeTop = parseFloat(node.style.top) || 0;
    const nodeLeft = parseFloat(node.style.left) || 0;
    // Get node height to position below the strip reliably
    const nodeHeight = node.offsetHeight; // Or a fixed value like 30-40px if offsetHeight is problematic

    // Position the switcher ABOVE the node, centered horizontally relative to the node
    switcher.style.bottom = `calc(100% - ${nodeTop}px + 5px)`; // Position relative to canvas bottom, then offset by node top
    switcher.style.left = `${nodeLeft + (node.offsetWidth / 2)}px`;
    switcher.style.transform = 'translateX(-50%)'; // Center the switcher horizontally

    // 5. Add event listener to close when clicking outside
    setTimeout(() => { // Use setTimeout to avoid immediate trigger by the opening click
        document.addEventListener('click', closeSwitcherOnClickOutside, { once: true });
    }, 0);

    function closeSwitcherOnClickOutside(event) {
        if (!switcher.contains(event.target)) {
            switcher.remove();
        }
    }
}

// Helper function to update switcher position if it's open
function updateSwitcherPosition() {
    const switcher = document.getElementById('node-type-switcher');
    // Need the node the switcher is associated with. 
    // We can store this on the switcher element when it's created.
    const nodeId = switcher?.dataset.nodeId;
    const node = nodeId ? document.getElementById(nodeId) : null;

    if (switcher && node) {
        const nodeTop = parseFloat(node.style.top) || 0;
        const nodeLeft = parseFloat(node.style.left) || 0;
        switcher.style.bottom = `calc(100% - ${nodeTop}px + 5px)`;
        switcher.style.left = `${nodeLeft + (node.offsetWidth / 2)}px`;
        // transform: translateX(-50%) is handled by CSS
    }
}

// Function to change the type of an existing node
async function changeNodeType(node, newNodeType) {
    console.log(`Changing node ${node.id} to type ${newNodeType}`);

    if (!node) {
        console.error("Target node not provided.");
        return;
    }

    const nodeLoader = window.nodeTypeLoaders ? window.nodeTypeLoaders[newNodeType] : null;
    if (!nodeLoader) {
        console.error(`Node type loader for '${newNodeType}' not found.`);
        alert(`Error: Could not load node type '${newNodeType}'.`);
        return;
    }

    // --- Gather data from the old node --- 
    const oldNodeId = node.id;
    const oldX = parseInt(node.style.left);
    const oldY = parseInt(node.style.top);
    const oldContentDiv = node.querySelector('.content');
    const oldStrip = node.querySelector('.strip');
    const oldStripColor = oldStrip ? oldStrip.style.backgroundColor : stripColors[0];
    const oldNodeType = node.dataset.nodeType || 'default';

    // --- Content Conversion Logic --- 
    let contentForNewNode = null;
    const oldNodeContent = oldContentDiv ? oldContentDiv.innerHTML : '';

    if (newNodeType === 'default') {
        // Converting TO Default
        if (oldNodeType === 'checklist') {
            let itemsHTML = '';
            try {
                const jsonData = node.getContentData ? node.getContentData() : oldNodeContent;
                const parsedData = JSON.parse(jsonData);
                if (parsedData && Array.isArray(parsedData.items) && parsedData.items.length > 0) {
                    // Check if all items are effectively empty (or just placeholder text)
                    const allEmpty = parsedData.items.every(item => !item.text || item.text.trim() === '' || item.text === (getText('checklistAddItem') || 'New Task'));
                    if (!allEmpty) {
                        itemsHTML = '<ul>' + parsedData.items.map(item =>
                            `<li>${item.checked ? '<s>' : ''}${item.text}${item.checked ? '</s>' : ''}</li>`
                        ).join('') + '</ul>';
                    }
                }
            } catch (e) { console.warn("Could not parse checklist JSON during conversion:", e); }
            contentForNewNode = itemsHTML || getPlaceholderText(); // Use placeholder if itemsHTML is empty
            console.log("Converted checklist to default:", contentForNewNode);
        } else if (oldNodeType === 'timer') {
            // --- MODIFIED ---
            contentForNewNode = getPlaceholderText(); // Use placeholder when converting from timer
            // --- END MODIFICATION ---
            console.log("Converted timer to default: Using placeholder");
        } else {
            // Other type to default: pass original content, set to null if empty/placeholder
            const placeholder = getPlaceholderText();
            contentForNewNode = (oldNodeContent && oldNodeContent !== placeholder) ? oldNodeContent : null;
            console.log("Converted other type to default:", contentForNewNode);
        }
    } else if (newNodeType === 'checklist' && oldNodeType === 'default') {
        // Converting FROM Default TO Checklist
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = oldNodeContent;
        const placeholder = getPlaceholderText();
        const initialText = (tempDiv.textContent === placeholder || tempDiv.innerHTML.trim() === placeholder || oldNodeContent.trim() === '') ? (getText('checklistAddItem') || 'New Task') : tempDiv.textContent.trim();
        contentForNewNode = JSON.stringify({ items: [{ text: initialText, checked: false }] });
        console.log("Converted default content to checklist JSON:", contentForNewNode);
    } else {
        // Other conversions or same type: pass original content structure if possible
        if (node.getContentData) {
            contentForNewNode = node.getContentData();
        } else {
            contentForNewNode = oldNodeContent;
        }
        // Ensure content is not strictly null (use empty string if needed by loader)
        if (contentForNewNode === null || contentForNewNode === undefined) {
            contentForNewNode = '';
        }
        console.log(`Passing content for ${oldNodeType} to ${newNodeType}:`, contentForNewNode);
    }

    // --- Create the new node element (without adding to DOM yet) --- 
    // Use null for content if it should trigger placeholder
    const finalContentForLoader = contentForNewNode;
    const newNodeElement = nodeLoader(oldNodeId, oldX, oldY, finalContentForLoader, oldStripColor);

    if (!newNodeElement) {
        console.error(`Node loader for '${newNodeType}' failed to create a node element.`);
        alert(`Error: Failed to create node of type '${newNodeType}'.`);
        return;
    }

    // --- Replace the old node with the new one in the DOM --- 
    const parent = node.parentNode;
    if (parent) {
        parent.replaceChild(newNodeElement, node);
    } else {
        console.error("Could not find parent to replace node.");
        return; // Stop if we can't replace
    }

    // Store the new node type on the element (e.g., using a data attribute)
    newNodeElement.dataset.nodeType = newNodeType;

    // --- Re-setup event listeners and update connections --- 
    // Find required elements in the new node structure
    const newStrip = newNodeElement.querySelector('.strip');
    const newContentDiv = newNodeElement.querySelector('.content');
    const newDeleteBtn = newNodeElement.querySelector('.delete');
    const newLeftPin = newNodeElement.querySelector('.pin.left');
    const newRightPin = newNodeElement.querySelector('.pin.right');

    // Re-run setupNodeEvents for the new element
    setupNodeEvents(newNodeElement, newStrip, newContentDiv, newDeleteBtn, newLeftPin, newRightPin);

    // Update connections for the node
    if (window.updateNodeConnectionsForNode) {
        window.updateNodeConnectionsForNode(newNodeElement);
    }

    // Restore connections
    if (window.restoreNodeConnections) {
        window.restoreNodeConnections(oldNodeId, newNodeElement.id);
    }

    // Add resize handle to the new node
    makeNodeResizable(newNodeElement);

    // Add visibility toggle to the new node
    if (newStrip && !newStrip.querySelector('.node-visibility-toggle')) {
        const visibilityToggle = document.createElement('div');
        visibilityToggle.className = 'node-visibility-toggle';
        visibilityToggle.innerHTML = '<i class="fas fa-eye"></i>';
        visibilityToggle.title = 'Toggle node visibility';

        // Initial state check
        updateVisibilityToggleState(visibilityToggle, newContentDiv);

        // Add click handler
        visibilityToggle.addEventListener('click', e => {
            e.stopPropagation();
            toggleNodeVisibility(newNodeElement, visibilityToggle);
        });

        // Insert after node type switch
        const typeSwitch = newStrip.querySelector('.node-type-switch');
        if (typeSwitch) {
            newStrip.insertBefore(visibilityToggle, typeSwitch.nextSibling);
        } else {
            newStrip.insertBefore(visibilityToggle, newStrip.firstChild);
        }
    }

    // Check if old node was in content-only mode
    if (node.classList.contains('content-only-mode')) {
        newNodeElement.classList.add('content-only-mode');
        const newToggle = newNodeElement.querySelector('.node-visibility-toggle');
        if (newToggle) {
            const icon = newToggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
                newToggle.title = 'Show node frame';
            }
        }
    }

    // Add to action history
    if (window.actionHistory && !window.actionHistory.isPerformingAction) {
        // We need to implement NodeChangeTypeAction properly first
        /*
        const action = new window.NodeChangeTypeAction(
            oldNodeId, 
            oldNodeType, 
            newNodeType,
            oldContent, // Might need format conversion here too for storing
            contentForNewNode // Content in the new format
        );
        window.actionHistory.addAction(action);
        */
        console.warn('NodeChangeTypeAction not fully implemented for undo/redo.');
    }

    console.log(`Node ${oldNodeId} successfully changed to type ${newNodeType}`);
    // Schedule auto-save after successful type change
    if (window.scheduleAutoSave) window.scheduleAutoSave();
}

// Make functions accessible globally if needed
window.showNodeTypeSwitcher = showNodeTypeSwitcher;
window.changeNodeType = changeNodeType;

// Update the visibility toggle button state based on content
function updateVisibilityToggleState(toggleButton, contentDiv) {
    if (!toggleButton || !contentDiv) return;

    // Get the icon inside the button
    const icon = toggleButton.querySelector('i');
    if (!icon) return;

    // Check if content is empty
    let isEmpty = true;

    // Check text content (trim to ignore whitespace)
    if (contentDiv.textContent.trim() !== '') {
        isEmpty = false;
    }

    // Check for images or iframes
    if (contentDiv.querySelector('img, iframe')) {
        isEmpty = false;
    }

    // Check for other content types (like videos, etc.)
    if (contentDiv.innerHTML.trim() !== '' &&
        contentDiv.innerHTML.trim() !== contentDiv.textContent.trim()) {
        isEmpty = false;
    }

    // Check for placeholder content
    const placeholder = getPlaceholderText();
    if (contentDiv.classList.contains('is-placeholder') ||
        contentDiv.textContent.trim() === placeholder) {
        isEmpty = true;
    }

    // Update button state
    if (isEmpty) {
        toggleButton.classList.add('disabled');
        toggleButton.title = 'Add content to enable visibility toggle';
    } else {
        toggleButton.classList.remove('disabled');
        toggleButton.title = 'Toggle node visibility';
    }
}

// Toggle node visibility
function toggleNodeVisibility(node, toggleButton) {
    if (!node || (toggleButton && toggleButton.classList.contains('disabled'))) return;

    // Skip toggling if the node is selected
    if (node.classList.contains('selected')) {
        console.log('Node is selected, skipping visibility toggle');
        return;
    }

    // Toggle the visibility class
    node.classList.toggle('content-only-mode');

    // Update the icon
    if (icon) {
        if (node.classList.contains('content-only-mode')) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
            toggleButton.title = 'Show node frame';
        } else {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
            toggleButton.title = 'Hide node frame';
        }
    }
}

// =====================================================
// P2P Remote Event Handlers
// =====================================================

// Flag to prevent loops when applying remote changes
window._applyingRemoteChange = false;

/**
 * Handle incoming P2P node operations
 */
function initP2PNodeHandlers() {
    if (!window.p2pManager) {
        // Retry after a short delay if p2pManager not ready
        setTimeout(initP2PNodeHandlers, 500);
        return;
    }

    window.p2pManager.on((event, data) => {
        // Skip if we're the source of this event
        if (window._applyingRemoteChange) return;

        switch (event) {
            case 'node-create':
                handleRemoteNodeCreate(data);
                break;
            case 'node-delete':
                handleRemoteNodeDelete(data);
                break;
            case 'node-update':
                handleRemoteNodeUpdate(data);
                break;
            case 'node-locked':
                handleRemoteNodeLock(data);
                break;
            case 'node-unlocked':
                handleRemoteNodeUnlock(data);
                break;
        }
    });

    console.log('[Nodes] P2P handlers initialized');
}

function handleRemoteNodeCreate(data) {
    const { nodeId, x, y, content, nodeType, stripColor, customData } = data;

    // Check if node already exists
    if (document.getElementById(nodeId)) {
        console.log('[P2P] Node already exists:', nodeId);
        return;
    }

    window._applyingRemoteChange = true;
    try {
        createNode(x, y, content, nodeType || 'default', nodeId, stripColor, customData);
        console.log('[P2P] Created remote node:', nodeId);
    } finally {
        window._applyingRemoteChange = false;
    }
}

function handleRemoteNodeDelete(data) {
    const { nodeId } = data;
    const node = document.getElementById(nodeId);

    if (!node) {
        console.log('[P2P] Node not found for delete:', nodeId);
        return;
    }

    window._applyingRemoteChange = true;
    try {
        // Simple removal without broadcasting back
        if (window.removeNodeConnections) {
            window.removeNodeConnections(node);
        }
        selectedNodes.delete(node);
        node.remove();
        console.log('[P2P] Deleted remote node:', nodeId);
    } finally {
        window._applyingRemoteChange = false;
    }
}

function handleRemoteNodeUpdate(data) {
    const { nodeId, x, y, width, height, content } = data;
    const node = document.getElementById(nodeId);

    if (!node) {
        console.log('[P2P] Node not found for update:', nodeId);
        return;
    }

    window._applyingRemoteChange = true;
    try {
        // Update position
        if (x !== undefined) node.style.left = `${x}px`;
        if (y !== undefined) node.style.top = `${y}px`;

        // Update size if provided
        if (width !== undefined) node.style.width = `${width}px`;
        if (height !== undefined) node.style.height = `${height}px`;

        // Update content if provided
        if (content !== undefined) {
            const contentDiv = node.querySelector('.content');
            if (contentDiv) {
                contentDiv.innerHTML = content;
            }
        }

        // Update connections
        if (window.updateNodeConnections) {
            window.updateNodeConnections();
        }

        console.log('[P2P] Updated remote node:', nodeId);
    } finally {
        window._applyingRemoteChange = false;
    }
}

// Initialize P2P handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initP2PNodeHandlers, 1000);
});

/**
 * Handle remote node lock - show visual indicator
 */
function handleRemoteNodeLock(data) {
    const { nodeId, userId } = data;
    const node = document.getElementById(nodeId);

    if (!node) return;

    // Generate color for the user
    let color = '#f97316'; // Default orange
    if (window.cursorSync) {
        color = window.cursorSync.generateColor(userId);
    }

    // Add locked class with color
    node.classList.add('locked-by-other');
    node.style.setProperty('--lock-color', color);
    node.dataset.lockedBy = userId;

    // Add lock avatar indicator
    let lockAvatar = node.querySelector('.node-lock-avatar');
    if (!lockAvatar) {
        lockAvatar = document.createElement('div');
        lockAvatar.className = 'node-lock-avatar';
        node.appendChild(lockAvatar);
    }

    // Get first letter of user name or use lock icon
    const userName = window.p2pManager?.getConnectedUserName?.(userId) || '?';
    lockAvatar.textContent = userName.charAt(0).toUpperCase();
    lockAvatar.style.setProperty('--lock-color', color);
    lockAvatar.style.borderColor = color;
    lockAvatar.style.color = color;

    console.log('[P2P] Node locked by remote user:', nodeId, userId);
}

/**
 * Handle remote node unlock - remove visual indicator
 */
function handleRemoteNodeUnlock(data) {
    const { nodeId } = data;
    const node = document.getElementById(nodeId);

    if (!node) return;

    // Remove locked class
    node.classList.remove('locked-by-other');
    node.style.removeProperty('--lock-color');
    delete node.dataset.lockedBy;

    // Remove lock avatar indicator
    const lockAvatar = node.querySelector('.node-lock-avatar');
    if (lockAvatar) {
        lockAvatar.remove();
    }

    console.log('[P2P] Node unlocked:', nodeId);
}