/**
 * Main Application
 * Initializes the application and handles global setup
 */

// Global variables
let appInitialized = false;
let debugMode = false;

// Pre-initialize language detection before any components are loaded
// This ensures the language is available when creating the initial node
// detectSystemLanguage();

// Initialize the application
function initApp() {
    if (appInitialized) return;

    // Make debug mode accessible globally
    window.debugMode = debugMode;

    // --- Language Initialization Logic ---
    // Always detect system language and set it on initial load
    const detectedLang = detectSystemLanguage();
    if (window.setLanguage) {
        console.log(`Setting language based on system detection: ${detectedLang}`);
        setLanguage(detectedLang);
    } else {
        // Fallback if setLanguage is not ready yet
        console.warn('setLanguage function not available yet. Defaulting language in main.js.');
        window.currentLanguage = detectedLang;
    }
    // -------------------------------------

    // Initialize Night Mode early so welcome screen respects it
    initNightMode();

    // Initialize UI first to show modal before canvas setup
    initUI(); // This will show the welcome modal

    // Initialize file management early to handle open actions
    initFileManagement();

    // Defer main UI initialization until a project is created/opened
    // initCanvas();
    // initConnections();
    // initNodeManagement();
    // initActionHistory();
    // initNightMode(); // Night mode can be initialized early or deferred
    // initDebugMode(); // Debug mode can be initialized early or deferred
    // fixUIControls(); // UI controls are inside app-container now
    // setupGlobalEvents(); // Global events related to canvas/nodes deferred

    // Mark as initialized (basic setup)
    appInitialized = true;
    console.log('Mosaic base initialized, waiting for project...');

    // No need for initFileManagement here anymore
}

// This function will be called AFTER a project is created or opened
function initializeAppUI() {
    console.log('Initializing main application UI...');

    // Initialize core components
    initCanvas();
    initConnections();

    // Initialize Drawing System after canvas is created
    if (window.drawingSystem && window.drawingSystem.reinitialize) {
        window.drawingSystem.reinitialize();
    }

    // Initialize node management system
    if (window.initNodeManagement) {
        initNodeManagement();
    }

    // Initialize undo/redo history system
    if (window.initActionHistory) {
        initActionHistory();
    }

    // Initialize Viewport Manager for performance optimization
    if (window.viewportManager) {
        window.viewportManager.init();
    }

    // Initialize Action Bar
    if (window.actionBar) {
        window.actionBar.init();
    }

    initNightMode(); // Initialize here if deferred
    initDebugMode(); // Initialize here if deferred

    // Fix UI controls visibility within the app container
    fixUIControls();

    // Set up event delegation for the document (canvas/node related)
    setupGlobalEvents();

    // Re-apply settings background now that canvas is ready
    // This fixes the persistence issue on app restart
    if (window.settingsManager && window.settingsManager.applyBackground) {
        console.log('[initializeAppUI] Re-applying background settings now that canvas is ready');
        window.settingsManager.applyBackground();
    }

    // === IPC Handler for popup window -> URL node conversion ===
    // When webview tries to open a popup, main process intercepts it
    // and sends create-url-node event. We create a node instead.
    if (window.electronAPI && window.electronAPI.onCreateUrlNode) {
        window.electronAPI.onCreateUrlNode((data) => {
            console.log('[Main] Received create-url-node IPC:', data);

            if (data && data.url && window.nodeLoader) {
                // Find the currently focused or selected node to position relative to it
                let sourceNode = null;
                let x = 500, y = 200;
                let sourceX = 0, sourceY = 0, sourceWidth = 500;

                // Check if we're in focus mode
                if (window.actionBar && window.actionBar.currentFocusedNode) {
                    sourceNode = window.actionBar.currentFocusedNode;

                    // In focus mode, the node has fixed positioning, so we need to use
                    // the original canvas position stored in originalNodeState
                    if (window.actionBar.originalNodeState) {
                        sourceX = parseInt(window.actionBar.originalNodeState.left) || 0;
                        sourceY = parseInt(window.actionBar.originalNodeState.top) || 0;
                        sourceWidth = parseInt(window.actionBar.originalNodeState.width) || 500;
                        console.log('[Main] Using originalNodeState for position:', { sourceX, sourceY, sourceWidth });
                    }
                } else if (window.selectedNodes && window.selectedNodes.size > 0) {
                    // Get the first selected node (normal mode)
                    sourceNode = window.selectedNodes.values().next().value;
                    if (sourceNode) {
                        sourceX = parseInt(sourceNode.style.left) || 0;
                        sourceY = parseInt(sourceNode.style.top) || 0;
                        sourceWidth = parseInt(sourceNode.style.width) || 500;
                    }
                }

                if (sourceNode) {
                    // Position to the right of source node
                    x = sourceX + sourceWidth + 100;
                    y = sourceY;
                    console.log('[Main] Positioning new node at:', { x, y });
                }

                // Create title from URL
                let title = 'New Tab';
                try {
                    title = new URL(data.url).hostname || 'New Tab';
                } catch (e) {
                    title = data.url.substring(0, 30);
                }

                // Create the new URL node
                const newNode = window.nodeLoader.createNode('url_node', x, y, {
                    content: data.url,
                    title: title
                });

                console.log('[Main] Created URL node from popup:', newNode?.id);

                // Create connection from source to new node
                if (newNode && sourceNode && window.createConnection) {
                    window.createConnection(sourceNode.id, newNode.id);
                }

                // If in focus mode, switch focus to new node
                if (newNode && window.actionBar && window.actionBar.currentFocusedNode) {
                    setTimeout(() => {
                        window.actionBar.exitFocusMode();
                        if (window.selectNode) window.selectNode(newNode);
                        setTimeout(() => {
                            window.actionBar.enterFocusMode(newNode);
                            window.actionBar.render();
                        }, 100);
                    }, 50);
                }
            }
        });
        console.log('[Main] Registered create-url-node IPC handler');
    }

    // Make the app container visible
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.style.display = 'block';
    }

    // Also make the canvas wrapper visible
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (canvasWrapper) {
        canvasWrapper.style.display = 'block'; // Or 'flex' if needed
    }

    // --- MODIFICATION: Make UI controls container visible --- 
    const uiControlsContainer = document.getElementById('ui-controls-container');
    if (uiControlsContainer) {
        uiControlsContainer.style.display = 'block';
    }
    // --- END MODIFICATION ---

    // --- ADD: Create Drive Status Indicator at the end of UI init ---
    if (window.createDriveStatusIndicator) {
        window.createDriveStatusIndicator();
        // Initial token check when UI becomes visible
        if (window.checkTokenValidity) window.checkTokenValidity();
    } else {
        console.warn("createDriveStatusIndicator not found during UI init.");
    }

    console.log('Mosaic main UI initialized');
}

// Make initializeAppUI globally accessible
window.initializeAppUI = initializeAppUI;

// Detect system language - MODIFIED: returns language code, doesn't set global
function detectSystemLanguage() {
    // Get browser language (e.g. "en-US", "tr-TR")
    const browserLang = navigator.language || navigator.userLanguage;

    // Extract the language code (first 2 characters)
    const langCode = browserLang.substr(0, 2).toLowerCase();

    // Check if we support this language
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'tr'];

    if (supportedLanguages.includes(langCode)) {
        console.log('System language detected:', langCode);
        return langCode; // Return detected language
    } else {
        // Default to English if language not supported
        console.log('Unsupported system language, defaulting to English');
        return 'en'; // Return default
    }
}

// Fix UI controls to ensure they're visible after canvas initialization
// Fix UI controls to ensure they're visible after canvas initialization
function fixUIControls() {
    // Check for existing container
    let uiContainer = document.getElementById('ui-controls-container');

    if (!uiContainer) {
        // Create a UI container to hold all controls with high z-index
        uiContainer = document.createElement('div');
        uiContainer.id = 'ui-controls-container';
        uiContainer.style.position = 'fixed';
        uiContainer.style.top = '0';
        uiContainer.style.left = '0';
        uiContainer.style.width = '100%';
        uiContainer.style.height = '100%';
        uiContainer.style.pointerEvents = 'none';
        uiContainer.style.zIndex = '1500'; // Higher z-index

        // Add UI container to body
        document.body.appendChild(uiContainer);
    }

    // Move all UI controls to the container
    moveControlToContainer('night-mode-toggle', uiContainer);
    moveControlToContainer('fullscreen-toggle', uiContainer);
    moveControlToContainer('language-selector', uiContainer);
    moveControlToContainer('menu-button', uiContainer);

    moveControlToContainer('file-name-display', uiContainer);

    // Check for project tabs and move them too
    let tabs = document.getElementById('project-tabs');

    if (!tabs) {
        console.warn('project-tabs not found in fixUIControls. Attempting to create...');
        if (window.initFileManagement) {
            window.initFileManagement();
            tabs = document.getElementById('project-tabs');
        }
    }

    if (tabs) {
        moveControlToContainer('project-tabs', uiContainer);
        // Force hide file-name-display if tabs exist
        const fileNameDisplay = document.getElementById('file-name-display');
        if (fileNameDisplay) fileNameDisplay.style.display = 'none';
    } else {
        console.error('Failed to create project-tabs even after fallback.');
    }

    moveControlToContainer('dropdown-menu', uiContainer);
    moveControlToContainer('footer-band', uiContainer);

    // Make sure all direct children have pointer events enabled
    const directChildren = uiContainer.children;
    for (let i = 0; i < directChildren.length; i++) {
        directChildren[i].style.pointerEvents = 'auto';
    }
}

// Helper function to move a control to the UI container
function moveControlToContainer(controlId, container) {
    const control = document.getElementById(controlId);
    if (control) {
        // Save original parent to restore if needed
        control._originalParent = control.parentElement;
        container.appendChild(control);
    }
}

// Set up global event listeners
function setupGlobalEvents() {
    // Prevent default browser behavior for certain events
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => e.preventDefault());

    // Double click on canvas is now handled directly in canvas.js

    // Prevent context menu on right-click for canvas
    document.getElementById('canvas').addEventListener('contextmenu', e => {
        if (e.target === document.getElementById('canvas')) {
            e.preventDefault();
        }
    });

    // Handle clicks on links in nodes
    document.addEventListener('click', e => {
        const link = e.target.closest('a');
        if (link && link.closest('.node')) {
            e.preventDefault();
            window.open(link.href, '_blank');
        }
    });

    // Global key handlers
    document.addEventListener('keydown', e => {
        // Delete key on selected nodes
        if ((e.key === 'Delete' || e.key === 'Backspace') &&
            !e.target.matches('input, textarea, [contenteditable=true]')) {
            if (window.selectedNodes && window.selectedNodes.size > 0) {
                e.preventDefault();
                deleteSelectedNodes();
            }
        }

        // Escape key to deselect nodes
        if (e.key === 'Escape') {
            if (window.deselectAllNodes) {
                deselectAllNodes();
            }
        }

        // Toggle debug mode with Ctrl+Shift+D
        if (e.ctrlKey && e.shiftKey && e.key === 'd') {
            e.preventDefault();
            toggleDebugMode();
        }

        // Copy nodes with Ctrl+C / Cmd+C
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' &&
            !e.target.matches('input, textarea, [contenteditable=true]')) {
            e.preventDefault();
            if (window.copySelectedNodes) {
                window.copySelectedNodes();
            }
        }

        // Paste nodes with Ctrl+V / Cmd+V
        if ((e.ctrlKey || e.metaKey) && e.key === 'v' &&
            !e.target.matches('input, textarea, [contenteditable=true]')) {
            e.preventDefault();
            if (window.pasteNodes) {
                window.pasteNodes();
            }
        }
    });
}

// Initialize night mode based on system preference
function initNightMode() {
    // Check system preference for dark mode
    const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    console.log('[initNightMode] System prefers dark mode:', prefersDarkMode);

    if (prefersDarkMode) {
        document.body.classList.add('night-mode');
        console.log('[initNightMode] Applied night mode based on system preference');
    }

    // Listen for changes in color scheme preference
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            console.log('[initNightMode] System preference changed:', e.matches ? 'dark' : 'light');
            if (e.matches) {
                document.body.classList.add('night-mode');
            } else {
                document.body.classList.remove('night-mode');
            }

            // Update connections to reflect the new color scheme
            if (window.updateNodeConnections) {
                updateNodeConnections();
            }
        });
    }
}

// Run night mode check IMMEDIATELY (before DOMContentLoaded)
// This ensures the dashboard shows in the correct mode
(function earlyNightModeCheck() {
    const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDarkMode && document.body) {
        document.body.classList.add('night-mode');
        console.log('[earlyNightModeCheck] Applied night mode immediately');
    } else if (prefersDarkMode) {
        // If body not ready, add class to html element which persists
        document.documentElement.classList.add('night-mode');
        console.log('[earlyNightModeCheck] Applied night mode to html element');
    }
})();

// Delete all selected nodes
function deleteSelectedNodes() {
    if (!selectedNodes || selectedNodes.size === 0) return;

    // Create array of nodes to delete (copy to avoid modification during iteration)
    const nodesToDelete = Array.from(selectedNodes);

    // Batch actions for undo/redo
    const deletionActions = [];

    // Capture all node data BEFORE deletion
    nodesToDelete.forEach(node => {
        if (window.captureNodeData && window.NodeDeleteAction) {
            const nodeData = window.captureNodeData(node);
            deletionActions.push(new window.NodeDeleteAction(node.id, nodeData));
        }
    });

    // Add batch action to history BEFORE deleting
    if (deletionActions.length > 0 && window.actionHistory && window.ActionGroup) {
        const batchAction = new window.ActionGroup('multiNodeDelete', deletionActions);
        window.actionHistory.addAction(batchAction);
        console.log(`[DeleteNodes] Added batch deletion action for ${deletionActions.length} nodes`);
    }

    // Set flag to prevent deleteNode from adding individual actions
    if (window.actionHistory) {
        window.actionHistory.isPerformingAction = true;
    }

    // Now perform the actual deletions
    nodesToDelete.forEach(node => {
        if (window.deleteNode) {
            window.deleteNode(node);
        }
    });

    // Unset flag
    if (window.actionHistory) {
        window.actionHistory.isPerformingAction = false;
    }

    // Clear selection
    clearSelectedNodes();
}

// Clear selected nodes
function clearSelectedNodes() {
    // Fallback implementation
    document.querySelectorAll('.node.selected').forEach(node => {
        node.classList.remove('selected');
    });

    if (window.selectedNodes) {
        window.selectedNodes.clear();
    }
}

// Deselect all nodes
function deselectAllNodes() {
    if (window.clearSelectedNodes) {
        window.clearSelectedNodes();
    } else {
        console.warn('clearSelectedNodes not found, falling back to manual node deselection');
        clearSelectedNodes();
    }
}

// Toggle debug mode
function toggleDebugMode() {
    debugMode = !debugMode;
    window.debugMode = debugMode;

    if (debugMode) {
        console.log('Debug mode enabled');
        console.log('Canvas state:', {
            scale: window.canvasScale,
            offset: window.canvasOffset,
            elementCount: document.querySelectorAll('.node').length
        });

        // Add visual indicator
        const debugIndicator = document.createElement('div');
        debugIndicator.id = 'debug-indicator';
        debugIndicator.style.position = 'fixed';
        debugIndicator.style.bottom = '10px';
        debugIndicator.style.left = '10px';
        debugIndicator.style.padding = '5px 10px';
        debugIndicator.style.background = 'rgba(255, 0, 0, 0.7)';
        debugIndicator.style.color = 'white';
        debugIndicator.style.borderRadius = '5px';
        debugIndicator.style.fontSize = '12px';
        debugIndicator.style.zIndex = '2000';
        debugIndicator.textContent = 'DEBUG MODE';
        document.body.appendChild(debugIndicator);

        // Add cursor position indicator
        const canvas = document.getElementById('canvas');
        const cursorMarker = document.createElement('div');
        cursorMarker.id = 'cursor-marker';
        cursorMarker.style.position = 'absolute';
        cursorMarker.style.width = '10px';
        cursorMarker.style.height = '10px';
        cursorMarker.style.borderRadius = '50%';
        cursorMarker.style.backgroundColor = 'red';
        cursorMarker.style.transform = 'translate(-5px, -5px)';
        cursorMarker.style.zIndex = '1000';
        cursorMarker.style.pointerEvents = 'none';
        canvas.appendChild(cursorMarker);

        // Track cursor movement
        canvas.addEventListener('mousemove', updateCursorMarker);
    } else {
        console.log('Debug mode disabled');

        // Remove debug elements
        const indicator = document.getElementById('debug-indicator');
        if (indicator) indicator.remove();

        const cursorMarker = document.getElementById('cursor-marker');
        if (cursorMarker) cursorMarker.remove();

        // Remove event listener
        document.getElementById('canvas').removeEventListener('mousemove', updateCursorMarker);
    }
}

// Update the cursor marker position
function updateCursorMarker(e) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();

    // Calculate the position in the canvas coordinate system
    const x = (e.clientX - rect.left - window.canvasOffset.x) / window.canvasScale;
    const y = (e.clientY - rect.top - window.canvasOffset.y) / window.canvasScale;

    const cursorMarker = document.getElementById('cursor-marker');
    if (cursorMarker) {
        cursorMarker.style.left = `${x}px`;
        cursorMarker.style.top = `${y}px`;
    }

    // Add debug info near the cursor
    const debugInfo = document.getElementById('debug-coords') || document.createElement('div');
    debugInfo.id = 'debug-coords';
    debugInfo.style.position = 'fixed';
    debugInfo.style.top = `${e.clientY + 20}px`;
    debugInfo.style.left = `${e.clientX + 20}px`;
    debugInfo.style.backgroundColor = 'rgba(0,0,0,0.7)';
    debugInfo.style.color = 'white';
    debugInfo.style.padding = '5px';
    debugInfo.style.borderRadius = '3px';
    debugInfo.style.fontSize = '12px';
    debugInfo.style.zIndex = '2000';
    debugInfo.style.pointerEvents = 'none';
    debugInfo.textContent = `Canvas: (${Math.round(x)}, ${Math.round(y)})`;

    if (!document.getElementById('debug-coords')) {
        document.body.appendChild(debugInfo);
    }
}

// Initialize debug mode
function initDebugMode() {
    if (!debugMode) return;
    // Global debug mode flag
    window.debugMode = debugMode;

    // We already have a keydown event handler for debug mode in setupGlobalEvents()
    // So we don't need to add another listener here

    console.log('Debug mode initialized. Press Ctrl+Shift+D to toggle.');
}

// Start the application after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);

// Expose functions to global scope
window.initApp = initApp;
window.deleteSelectedNodes = deleteSelectedNodes;
window.clearSelectedNodes = clearSelectedNodes;
window.initDebugMode = initDebugMode;
window.deselectAllNodes = deselectAllNodes;
