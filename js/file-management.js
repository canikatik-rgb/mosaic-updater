/**
 * File Management
 * Handles saving, loading, and exporting mindmaps
 */

// Project management
let currentProjectName = 'Untitled';
let projects = [];  // Array to store all open projects
let activeProjectIndex = -1;  // Index of the active project

// Project object structure
class Project {
    constructor(name = 'Untitled', nodes = [], connections = []) {
        this.id = Date.now() + '-' + Math.floor(Math.random() * 10000);
        this.name = name;
        this.nodes = nodes;
        this.connections = connections;
        this.groups = []; // Initialize groups array
        this.stickers = []; // Initialize stickers array
        this.drawings = []; // Initialize drawings array
        this.canvasOffset = { x: 0, y: 0 };
        this.canvasScale = 1;
        this.nightMode = false; // Track night mode preference

        // Storage type tracking
        this.filePath = null;           // Local file path (if saved locally)
        this.cloudId = null;            // Supabase project ID (if synced to cloud)
        this.storageType = 'local';     // 'local' | 'cloud' | 'shared'
        this.sharedBy = null;           // Owner info for shared projects (display name)
    }
}

// Initialize file management
function initFileManagement() {
    console.log('[initFileManagement] Initializing...');

    // Check for Electron API and initialize integration
    if (window.electronAPI) {
        console.log('[initFileManagement] Electron API detected. Initializing desktop integration.');
        initElectronIntegration();
    }

    // Custom title bar is now used instead of tabs
    // It's auto-initialized via custom-titlebar.js
    console.log('[initFileManagement] Using custom title bar (frameless window mode).');

    // Do NOT create a default project here. Wait for user action.
    // if (projects.length === 0) {
    //     createNewProject('Untitled');
    // }
}

// --- Electron Integration ---
async function initElectronIntegration() {
    // Show dashboard immediately if on welcome screen
    const driveDashboard = document.getElementById('drive-dashboard');
    if (driveDashboard) {
        driveDashboard.style.display = 'block';

        // Update Title
        const title = driveDashboard.querySelector('.drive-title');
        if (title) title.textContent = 'Local Projects';

        // Update Buttons
        const newBtn = document.getElementById('drive-new-project-btn');
        if (newBtn) {
            newBtn.innerHTML = '<i class="fas fa-plus-circle"></i> New Local Project';
            newBtn.disabled = false;
            newBtn.onclick = () => {
                const welcomeModal = document.getElementById('welcome-modal');
                const newProjectModal = document.getElementById('new-project-modal');
                if (welcomeModal) hideModal(welcomeModal);
                if (newProjectModal) {
                    document.getElementById('project-name').value = '';
                    showModal(newProjectModal);
                    setTimeout(() => document.getElementById('project-name').focus(), 100);
                }
            };
        }

        const uploadBtn = document.getElementById('drive-upload-btn');
        if (uploadBtn) {
            uploadBtn.innerHTML = '<i class="fas fa-folder-open"></i> Open From Disk';
            uploadBtn.disabled = false;
            uploadBtn.onclick = () => openProject(); // Redirect to our openProject which will handle Electron
        }

        const signOutBtn = document.getElementById('sign-out-btn');
        if (signOutBtn) signOutBtn.style.display = 'none'; // No sign out for local

        // Load Content
        refreshLocalDashboard();
    }

    // Listen for file association - when a .mosaic file is opened from OS
    if (window.electronAPI && window.electronAPI.onOpenFilePath) {
        window.electronAPI.onOpenFilePath((filePath) => {
            console.log('[FileManagement] Received file from OS file association:', filePath);
            openProjectElectron(filePath);
        });
    }
}

async function refreshLocalDashboard() {
    const fileListDiv = document.getElementById('drive-file-list');
    if (!fileListDiv) return;

    fileListDiv.innerHTML = '<p class="drive-loading">Loading local projects...</p>';

    try {
        const files = await window.electronAPI.listLocalFiles();

        fileListDiv.innerHTML = ''; // Clear loading

        if (files.length === 0) {
            fileListDiv.innerHTML = '<p class="drive-empty">No projects found in Documents/MosaicProjects.</p>';
            return;
        }

        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'drive-file-item';
            // fileItem.dataset.filePath = file.path; 
            const iconSrc = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-hdd-fill" viewBox="0 0 16 16"><path d="M0 10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-1zm4.5-5a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7zM3 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3z"/></svg>';

            fileItem.innerHTML = `
                <img src="${iconSrc}" alt="File icon" class="drive-file-icon">
                <span class="drive-file-name">${file.name.replace('.mosaic', '')}</span>
                <span class="drive-file-modified">${new Date(file.mtime).toLocaleDateString()}</span>
            `;
            fileItem.addEventListener('click', () => {
                openProject(file.path);
            });
            fileListDiv.appendChild(fileItem);
        });

    } catch (err) {
        console.error('Error loading local dashboard:', err);
        fileListDiv.innerHTML = '<p class="drive-empty">Error loading local files.</p>';
    }
}


// Create the project tabs container
function createProjectTabsContainer() {
    const tabsContainer = document.createElement('div');
    tabsContainer.id = 'project-tabs';
    tabsContainer.className = 'project-tabs';

    // Insert before the file name display
    const fileNameDisplay = document.getElementById('file-name-display');
    if (fileNameDisplay) {
        console.log('[createProjectTabsContainer] Found file-name-display. Inserting tabs before it.');
        fileNameDisplay.parentNode.insertBefore(tabsContainer, fileNameDisplay);
        // Hide the original file name display as we'll now use tabs
        fileNameDisplay.style.display = 'none';
    } else {
        console.warn('[createProjectTabsContainer] file-name-display NOT found. Inserting at body start.');
        // If no file name display, add to the start of body
        document.body.insertBefore(tabsContainer, document.body.firstChild);
    }

    return tabsContainer;
}

// Convert a display name to a safe filename
function getSafeFilename(displayName) {
    return displayName
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || 'untitled';
}
window.getSafeFilename = getSafeFilename;

// Expose project data and state management globally
window.projects = projects;
window.getActiveProjectIndex = () => activeProjectIndex;
window.setActiveProjectIndex = (index) => { activeProjectIndex = index; }; // Add setter if needed elsewhere
window.saveProjectState = saveProjectState;
window.Project = Project; // Expose Project class if needed externally

// Set the current project name
function setProjectName(name) {
    // Update the current project
    currentProjectName = name || 'Untitled';

    // If there are active projects, update the current one
    if (activeProjectIndex >= 0 && projects[activeProjectIndex]) {
        projects[activeProjectIndex].name = currentProjectName;
    }

    // Update the custom title bar (frameless window mode)
    if (window.updateTitleBarProjectName) {
        window.updateTitleBarProjectName(currentProjectName);
    }
}

// Create a new project (Single Project Mode)
function createNewProject(name = 'Untitled', skipConfirmation = false) {
    console.log(`[createNewProject] Called with name: '${name}', skipConfirmation: ${skipConfirmation}`);

    // Check if this is the initial 'Untitled' project being named
    const isRenamingInitial = projects.length === 1 && projects[0].name === 'Untitled' && activeProjectIndex === 0;

    // LOCAL CREATION LOGIC
    if (isRenamingInitial) {
        console.log("[createNewProject] Renaming initial local project.");
        projects[0].name = name;
        currentProjectName = name;
        updateProjectTabs();
        if (document.querySelectorAll('.node').length === 0) {
            createInitialNode();
        }
        if (window.resetCanvasView) setTimeout(() => window.resetCanvasView(), 100);
        if (window.initializeAppUI) window.initializeAppUI();
        return projects[0];
    } else {
        // SINGLE PROJECT MODE: Check if there's already an open project
        if (projects.length > 0 && activeProjectIndex >= 0 && !skipConfirmation) {
            const currentProject = projects[activeProjectIndex];
            const confirmed = confirm(
                `You have an active project: "${currentProject.name}"\n\n` +
                `Close the current project and create a new one?\n\n` +
                `(Any unsaved changes will be lost)`
            );

            if (!confirmed) {
                console.log("[createNewProject] User cancelled - keeping current project");
                return null;
            }

            // Close all existing projects first
            console.log("[createNewProject] Closing existing projects for single-project mode");
            projects.length = 0;
            activeProjectIndex = -1;
        }

        console.log("[createNewProject] Creating new local project.");
        const newLocalProject = new Project(name);
        projects.push(newLocalProject);
        const newIndex = projects.length - 1;

        // Ensure UI is initialized *before* switching which might create nodes
        if (window.initializeAppUI) window.initializeAppUI();

        // Switch to the new project - this will create initial node if project is empty
        switchToProject(newIndex);

        updateProjectTabs();
        if (window.resetCanvasView) setTimeout(() => window.resetCanvasView(), 100);
        return newLocalProject;
    }
}

// Save the current state of a project
function saveProjectState(projectIndex) {
    if (projectIndex < 0 || projectIndex >= projects.length) return;

    const project = projects[projectIndex];

    // Save canvas state (use window properties if available as they're more current)
    project.canvasOffset = {
        x: (window.canvasOffset ? window.canvasOffset.x : canvasOffset.x),
        y: (window.canvasOffset ? window.canvasOffset.y : canvasOffset.y)
    };
    project.canvasScale = window.canvasScale || canvasScale;

    console.log('Saving project state with canvas:', project.canvasOffset, project.canvasScale);
    // --- ADD Detailed Logging ---
    console.log(`[saveProjectState] Capturing state for project: '${project.name}' (ID: ${project.id}, DriveID: ${project.driveFileId})`);

    // Save nodes (using captureNodeData for consistency)
    project.nodes = []; // Clear existing nodes before saving
    document.querySelectorAll('.node').forEach(nodeEl => {
        if (window.captureNodeData) {
            const nodeData = window.captureNodeData(nodeEl);
            if (nodeData) {
                // Remove connections from node data as they are saved separately
                delete nodeData.connections;
                project.nodes.push(nodeData);
            }
        } else { // Fallback if captureNodeData is not available
            const strip = nodeEl.querySelector('.strip');
            const contentDiv = nodeEl.querySelector('.content');
            const nodeType = nodeEl.dataset.nodeType || 'default';
            // Look up metadata for caching
            let cachedTitle = '';
            let cachedIcon = '';
            if (window.appNodeRegistry) {
                const meta = window.appNodeRegistry.find(m => m.id === nodeType);
                if (meta) {
                    cachedTitle = (meta.name && meta.name.en) ? meta.name.en : meta.name; // Simple fallback
                    cachedIcon = meta.icon; // Assuming icon is stored
                }
            }

            project.nodes.push({
                id: nodeEl.id,
                x: parseFloat(nodeEl.style.left),
                y: parseFloat(nodeEl.style.top),
                content: contentDiv ? contentDiv.innerHTML : '',
                stripColor: strip ? strip.style.backgroundColor : (window.stripColors ? window.stripColors[0] : '#c2f8cb'),
                nodeType: nodeType,
                cachedTitle: cachedTitle, // Persist title
                cachedIcon: cachedIcon,   // Persist icon
                contentOnly: nodeEl.classList.contains('content-only-mode'), // Save content-only state
                // V2 App Node State Persistence
                appState: nodeEl.dataset.savedState ? JSON.parse(nodeEl.dataset.savedState) : {},
                // Capture dimensions for App Nodes (and resized legacy nodes)
                width: nodeEl.style.width,
                height: nodeEl.querySelector('.content')?.style.height,
                // Apply cachedTitle to dataset.nodeTitle on new node
                nodeTitle: nodeEl.dataset.nodeTitle || null,
                nodeTitle: nodeEl.dataset.nodeTitle || null,
                nodeIcon: nodeEl.dataset.nodeIcon || null,
                locked: nodeEl.dataset.locked === 'true' // Save locked state
            });
        }
    });
    // Log node details
    const firstNodePos = project.nodes[0]?.position ? `(${project.nodes[0].position.x}, ${project.nodes[0].position.y})` : (project.nodes[0] ? `(${project.nodes[0].x}, ${project.nodes[0].y})` : 'N/A');
    console.log(`[saveProjectState] Captured ${project.nodes.length} nodes. First node position: ${firstNodePos}`);

    // Save connections
    project.connections = [];
    document.querySelectorAll('.connection').forEach(connPath => {
        const conn = connPath.closest('.connection-container')?.querySelector('.connection');
        if (conn?.dataset) {
            project.connections.push({
                startNode: conn.dataset.startNode,
                endNode: conn.dataset.endNode,
                startPin: conn.dataset.startPin,
                endPin: conn.dataset.endPin,
                connectionType: conn.dataset.connectionType || 'curved',
                connectionColor: conn.dataset.connectionColor || null
            });
        }
    });
    // Log connection count
    console.log(`[saveProjectState] Captured ${project.connections.length} connections.`);

    // Save groups
    project.groups = [];
    if (window.groups && window.groups.size > 0) {
        window.groups.forEach((group, groupId) => {
            project.groups.push({
                id: group.id,
                name: group.name,
                color: group.color,
                nodeIds: [...group.nodeIds], // Copy array
                nodeIds: [...group.nodeIds], // Copy array
                bounds: { ...group.bounds }, // Copy bounds object
                locked: group.locked === true // Save group locked state
            });
        });
        console.log(`[saveProjectState] Captured ${project.groups.length} groups.`);
    } else {
        console.log(`[saveProjectState] No groups to save.`);
    }

    // Save stickers
    project.stickers = [];
    document.querySelectorAll('.canvas-sticker').forEach(sticker => {
        project.stickers.push({
            src: sticker.querySelector('img')?.src || '',
            x: parseFloat(sticker.style.left),
            y: parseFloat(sticker.style.top),
            width: sticker.style.width,
            height: sticker.style.height
        });
    });
    console.log(`[saveProjectState] Captured ${project.stickers.length} stickers.`);

    // Save drawings
    if (window.drawingSystem) {
        project.drawings = window.drawingSystem.getDrawingsData();
        console.log(`[saveProjectState] Captured ${project.drawings ? project.drawings.length : 0} drawings.`);
    } else {
        project.drawings = [];
    }

    // Save DataCardStore (I/O panel data)
    if (window.dataCardStore) {
        project.dataCardStore = window.dataCardStore.serialize();
        console.log(`[saveProjectState] Saved DataCardStore data.`);
    }

    // Night mode is no longer saved per-project - use system/user preference instead

    console.log(`Saved state for project ${project.name}: ${project.nodes.length} nodes, ${project.connections.length} connections`);
}

// Switch to a specific project
function switchToProject(index) {
    if (index < 0 || !window.projects || index >= window.projects.length) return;

    console.log(`[switchToProject] Attempting to switch to project index: ${index}`);

    // Hide dashboard if visible
    if (window.dashboardManager) {
        window.dashboardManager.hide();
    }

    // Initialize the main UI if it hasn't been initialized yet
    const appContainer = document.getElementById('app-container');
    if (appContainer && appContainer.style.display === 'none') {
        console.log("[switchToProject] Initializing UI...");

        // Start background fade-in
        document.body.classList.add('app-active');

        if (window.initializeAppUI) {
            window.initializeAppUI();
        } else {
            console.error("[switchToProject] initializeAppUI function not found!");
        }
    }

    // Set flag to prevent auto-saves during restoration
    window.isRestoringProject = true;
    console.log('[switchToProject] Starting restoration. Auto-save disabled.');

    try {
        // Save current project state before switching (if not the one we're switching to)
        if (activeProjectIndex >= 0 && activeProjectIndex !== index) {
            saveProjectState(activeProjectIndex);
        }

        activeProjectIndex = index;
        const project = window.projects[index];

        // Update UI
        document.getElementById('project-name').value = project.name;
        updateProjectTabs();

        // Clear the current mindmap
        clearMindMap();

        // Restore canvas state
        // Use default values carefully if project data is missing
        const targetOffset = project.canvasOffset || { x: document.getElementById('canvas-wrapper').clientWidth / 2, y: document.getElementById('canvas-wrapper').clientHeight / 2 };
        const targetScale = (project.canvasScale && project.canvasScale > 0) ? project.canvasScale : 1;

        console.log(`[switchToProject] Project '${project.name}': Restoring offset=`, targetOffset, `scale=`, targetScale);

        canvasOffset.x = targetOffset.x;
        canvasOffset.y = targetOffset.y;
        canvasScale = targetScale;

        // Update the canvas transform and global variables
        updateCanvasTransform();

        // Connect to Multiplayer Channel
        if (window.multiplayer && project.id) {
            window.multiplayer.connect(project.id);
        } else if (window.multiplayer) {
            // Disconnect if no project ID (e.g. fresh local file)
            window.multiplayer.disconnect();
        }

        console.log(`Switching to project '${project.name}' with state:`, project);

        // Load nodes first
        if (Array.isArray(project.nodes) && project.nodes.length > 0) {
            project.nodes.forEach(nodeData => {
                // Ensure position values are numbers, reliably accessing the position object
                const x = (typeof nodeData.position?.x === 'number') ? nodeData.position.x : (typeof nodeData.x === 'number' ? nodeData.x : 0);
                const y = (typeof nodeData.position?.y === 'number') ? nodeData.position.y : (typeof nodeData.y === 'number' ? nodeData.y : 0);

                // Get other node data
                const nodeType = nodeData.nodeType || nodeData.type || 'default';
                // CRITICAL FIX: Custom color (color) must take precedence over legacy stripColor (which defaults to green)
                const stripColor = nodeData.color || nodeData.stripColor;
                const content = nodeData.content || (window.getPlaceholderText ? window.getPlaceholderText() : 'Double Click...');
                const nodeId = nodeData.id;

                if (!nodeId) {
                    console.warn("Skipping node load because ID is missing:", nodeData);
                    return; // Skip node if ID is missing
                }

                // --- APP NODE CHECK ---
                // If it has a specific type (not default/text) OR has appState, use NodeLoader
                // LEGACY COMPATIBILITY: Also treat 'default' and 'text' nodes as text_node app nodes
                const hasAppState = nodeData.appState && Object.keys(nodeData.appState).length > 0;
                const isSpecialType = nodeData.type && nodeData.type !== 'default' && nodeData.type !== 'text' && nodeData.type !== 'image';
                const isLegacyTextNode = (nodeData.type === 'default' || nodeData.type === 'text' || !nodeData.type);

                const isAppNode = hasAppState || isSpecialType || isLegacyTextNode;

                if (isAppNode && window.nodeLoader) {
                    // Determine type for loading
                    let type = nodeData.type || 'text_node';

                    // LEGACY: Convert old 'default' and 'text' types to 'text_node'
                    if (type === 'default' || type === 'text') {
                        type = 'text_node';
                    }

                    // Prepare app state data
                    let appStateData = nodeData.appState || {};

                    // LEGACY: If no appState but has content, migrate it
                    if (!nodeData.appState && nodeData.content) {
                        // Check if content contains base64 images
                        const hasBase64Image = nodeData.content.includes('data:image/') ||
                            nodeData.content.includes('<img') && nodeData.content.includes('src=');

                        if (hasBase64Image && type === 'text_node') {
                            // Keep as HTML node temporarily for image display
                            // Parse and preserve the HTML with images
                            appStateData = {
                                content: nodeData.content, // Keep full HTML
                                hasLegacyImages: true
                            };
                            console.log('[Legacy] Text node contains base64 images, preserving HTML format');
                        } else {
                            // Extract text content from HTML
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = nodeData.content;
                            const textContent = tempDiv.textContent || tempDiv.innerText || '';

                            appStateData = {
                                content: textContent
                            };
                        }
                    }

                    // Load App Node
                    const appNode = window.nodeLoader.createNode(type, x, y, appStateData, nodeId);

                    // Restore common properties directly on the element
                    if (appNode) {
                        if (nodeData.width) appNode.style.width = nodeData.width;
                        if (nodeData.height) appNode.style.height = nodeData.height;

                        // Restore color to icon wrapper
                        const iconWrapper = appNode.querySelector('.node-icon-wrapper');
                        if (iconWrapper && stripColor) {
                            iconWrapper.style.backgroundColor = stripColor;
                        }

                        // Also check for legacy strip element
                        const strip = appNode.querySelector('.strip');
                        if (strip && stripColor) strip.style.backgroundColor = stripColor;

                        // Store color in dataset for future use
                        if (stripColor) appNode.dataset.color = stripColor;

                        // Restore content-only mode
                        if (nodeData.contentOnly) {
                            appNode.classList.add('content-only-mode');
                        }

                        // Restore node title if saved
                        if (nodeData.nodeTitle) {
                            appNode.dataset.nodeTitle = nodeData.nodeTitle;
                            const titleEl = appNode.querySelector('.node-title');
                            if (titleEl) titleEl.innerText = nodeData.nodeTitle;
                        }

                        // Restore locked state
                        if (nodeData.locked) {
                            appNode.dataset.locked = 'true';
                            // Apply visual lock immediately
                            requestAnimationFrame(() => {
                                if (window.actionBar && window.actionBar.updateLockIndicator) {
                                    window.actionBar.updateLockIndicator(appNode, true);
                                } else {
                                    appNode.classList.add('locked'); // Fallback if actionBar not ready
                                }
                            });
                        }
                    }
                    return; // Skip legacy createNode
                }

                // --- LEGACY NODE CREATION ---
                // Use createNode with all parameters including customData
                const node = window.createNode(
                    x,
                    y,
                    content,
                    nodeType,
                    nodeId,
                    stripColor,
                    nodeData.customData // Pass custom data
                );

                // Restore specific properties
                if (nodeData.locked && node) {
                    node.dataset.locked = 'true';
                    // Apply visual lock immediately
                    requestAnimationFrame(() => {
                        if (window.actionBar && window.actionBar.updateLockIndicator) {
                            window.actionBar.updateLockIndicator(node, true);
                        } else {
                            node.classList.add('locked'); // Fallback if actionBar not ready
                        }
                    });
                }

                if (nodeData.contentOnly && node) {
                    node.classList.add('content-only-mode');
                    const toggle = node.querySelector('.node-visibility-toggle i');
                    if (toggle) {
                        toggle.classList.remove('fa-eye');
                        toggle.classList.add('fa-eye-slash');
                    }
                }
            });
        } else {
            // If no nodes exist, create a welcome node
            if (window.createInitialNode) {
                window.createInitialNode();
            } else {
                console.warn('createInitialNode function not found.');
            }
        }

        // Then load connections
        if (Array.isArray(project.connections)) {
            project.connections.forEach(conn => {
                const startNode = document.getElementById(conn.startNode || conn.source);
                const endNode = document.getElementById(conn.endNode || conn.target);

                if (startNode && endNode && window.createFinalConnection) {
                    // Ensure createFinalConnection doesn't add history during load
                    const wasPerformingAction = window.actionHistory ? window.actionHistory.isPerformingAction : false;
                    if (window.actionHistory) window.actionHistory.isPerformingAction = true;

                    const connPath = window.createFinalConnection(startNode, endNode, conn.startPin, conn.endPin);

                    // Restore connection type if saved
                    if (conn.connectionType && connPath && window.setConnectionType) {
                        window.setConnectionType(connPath, conn.connectionType);
                    }

                    // Restore connection color if saved
                    if (conn.connectionColor && connPath) {
                        connPath.setAttribute('stroke', conn.connectionColor);
                        connPath.dataset.connectionColor = conn.connectionColor;
                    }

                    if (window.actionHistory) window.actionHistory.isPerformingAction = wasPerformingAction;
                } else if (!startNode || !endNode) {
                    console.warn('Could not find start or end node for connection:', conn);
                }
            });
        }

        // Call updateNodeConnections after nodes/connections are loaded
        if (window.updateNodeConnections) {
            console.log("[switchToProject] Calling updateNodeConnections after loading project elements.");
            window.updateNodeConnections();
        }

        // Sync node inputs after connections are established
        // DISABLED: Don't re-trigger data flow on project load
        // Saved DataCardStore data is already deserialized and should be preserved
        // Live data will flow naturally when user interacts with nodes or creates new connections
        setTimeout(() => {
            console.log("[switchToProject] Skipping node input sync (using saved DataCardStore data).");
            // Original code preserved for reference:
            // if (window.nodeSystem && window.nodeSystem.updateNodeInputs && window.connections) {
            //     const targetNodes = new Set();
            //     window.connections.forEach(conn => {
            //         if (conn.target) targetNodes.add(conn.target);
            //     });
            //     targetNodes.forEach(targetId => {
            //         window.nodeSystem.updateNodeInputs(targetId);
            //     });
            // }
        }, 1000);

        // Load groups AFTER nodes and connections
        console.log('[switchToProject] Checking for groups...', {
            hasGroupsArray: Array.isArray(project.groups),
            groupsLength: project.groups?.length,
            windowGroupsExists: !!window.groups,
            renderGroupExists: !!window.renderGroup
        });

        if (Array.isArray(project.groups) && project.groups.length > 0) {
            console.log(`[switchToProject] Starting group restoration for ${project.groups.length} groups`);

            if (!window.groups) {
                console.error('[switchToProject] FATAL: window.groups Map not available!');
                return;
            }

            if (!window.renderGroup) {
                console.error('[switchToProject] FATAL: window.renderGroup function not available!');
                return;
            }

            // Clear existing groups
            window.groups.clear();
            console.log('[switchToProject] Cleared existing groups');

            // Restore each group
            let restoredCount = 0;
            project.groups.forEach((groupData, index) => {
                console.log(`[switchToProject] Restoring group ${index + 1}:`, {
                    id: groupData.id,
                    name: groupData.name,
                    color: groupData.color,
                    nodeIds: groupData.nodeIds,
                    bounds: groupData.bounds
                });

                // Verify all nodes exist in DOM and filter out missing ones
                const validNodeIds = groupData.nodeIds.filter(id => document.getElementById(id));
                const missingNodes = groupData.nodeIds.filter(id => !document.getElementById(id));

                if (missingNodes.length > 0) {
                    console.warn(`[switchToProject] Group "${groupData.name}" has missing nodes:`, missingNodes);
                }

                // Create Group object
                const group = {
                    id: groupData.id,
                    name: groupData.name,
                    color: groupData.color,
                    nodeIds: validNodeIds,
                    bounds: groupData.bounds,
                    element: null
                };

                // Add to groups map
                window.groups.set(group.id, group);
                console.log(`[switchToProject] Added group to Map. Map size: ${window.groups.size}`);

                // Render the group
                try {
                    window.renderGroup(group);
                    console.log(`[switchToProject] Successfully rendered group "${group.name}"`);

                    // Verify element was created
                    if (group.element) {
                        console.log(`[switchToProject] Group element created:`, {
                            id: group.element.id,
                            className: group.element.className,
                            parentNode: group.element.parentNode?.id
                        });
                        restoredCount++;
                    } else {
                        console.error(`[switchToProject] Group element NOT created for "${group.name}"`);
                    }
                } catch (error) {
                    console.error(`[switchToProject] Error rendering group "${group.name}":`, error);
                }
            });

            console.log(`[switchToProject] Group restoration complete. ${restoredCount}/${project.groups.length} groups rendered successfully. Map size: ${window.groups.size}`);
        } else {
            console.log('[switchToProject] No groups to restore');
        }

        // Load stickers
        if (project.stickers) {
            const canvasContent = document.getElementById('canvas-content');
            if (canvasContent) {
                project.stickers.forEach(stickerData => {
                    const sticker = document.createElement('div');
                    sticker.className = 'canvas-sticker';
                    sticker.dataset.sticker = 'true';

                    // Restore position
                    sticker.style.left = `${stickerData.x}px`;
                    sticker.style.top = `${stickerData.y}px`;

                    // Restore size with fallback for old stickers
                    if (stickerData.width) {
                        sticker.style.width = stickerData.width;
                    } else {
                        sticker.style.width = '250px'; // New default for old stickers
                    }

                    if (stickerData.height) {
                        sticker.style.height = stickerData.height;
                    } else {
                        sticker.style.height = 'auto';
                    }

                    // Ensure drag cursor
                    sticker.style.cursor = 'move';

                    const img = document.createElement('img');
                    img.src = stickerData.src;
                    img.alt = 'Sticker';
                    img.draggable = false;
                    img.style.width = '100%';
                    img.style.height = 'auto';
                    img.style.pointerEvents = 'none';

                    sticker.appendChild(img);
                    canvasContent.appendChild(sticker);

                    // Re-attach drag events if stickerPanel exists, otherwise waiting for init
                    // Note: Stickers.js should probably scan for existing stickers on init to attach events
                    // But for now, we can try to attach if panel exists
                    if (window.stickerPanel) {
                        window.stickerPanel.setupStickerDrag(sticker);
                    }
                });
                console.log(`[switchToProject] Restored ${project.stickers.length} stickers.`);
            }
        }

        // Load drawings
        if (window.drawingSystem) {
            // Ensure SVG layer is initialized before loading drawings
            if (!window.drawingSystem.svgLayer) {
                console.log('[switchToProject] SVG layer missing, reinitializing drawing system...');
                window.drawingSystem.reinitialize();
            }

            if (project.drawings && project.drawings.length > 0) {
                console.log(`[switchToProject] Loading ${project.drawings.length} drawings...`);
                window.drawingSystem.loadDrawingsData(project.drawings);
            } else {
                window.drawingSystem.clear(); // Clear existing drawings if none in project
            }
        }

        // Night mode is no longer restored from project - use system/user preference instead

        // Clear history when switching projects
        if (window.actionHistory) {
            window.actionHistory.clear();
        }

        // Restore DataCardStore (I/O panel data)
        if (window.dataCardStore && project.dataCardStore) {
            window.dataCardStore.deserialize(project.dataCardStore);
            console.log(`[switchToProject] Restored DataCardStore data.`);
        } else if (window.dataCardStore) {
            // No saved data - reset store
            window.dataCardStore.reset();
        }

        console.log(`Switched to project: ${project.name}`);

        // Update sidebar to reflect current projects
        if (window.dashboardManager && window.dashboardManager.updateSidebar) {
            window.dashboardManager.updateSidebar();
        }

    } finally {
        // Re-enable auto-saves
        window.isRestoringProject = false;
        console.log('[switchToProject] Restoration complete. Auto-save re-enabled.');
    }
}

// Close a project by index
function closeProject(projectIndex) {
    if (projectIndex < 0 || projectIndex >= projects.length) return;

    const closedProjectName = projects[projectIndex].name;
    console.log(`[closeProject] Closing project: '${closedProjectName}' at index ${projectIndex}`);

    // Check if this is the last project
    if (projects.length === 1) {
        console.log("[closeProject] Attempting to close the last project, will refresh the application.");
        window.location.reload();
        return;
    }

    // Remove the project from the array
    projects.splice(projectIndex, 1);

    // If we closed the active project, switch to another one
    if (projectIndex === activeProjectIndex) {
        // Try to switch to the previous project, or the first one if not possible
        // Ensure the new index is within the bounds of the modified array
        const newIndex = Math.min(Math.max(0, projectIndex - 1), projects.length - 1);
        console.log(`[closeProject] Closed active project. Switching to index ${newIndex}`);
        switchToProject(newIndex); // switchToProject handles updating tabs
    } else if (projectIndex < activeProjectIndex) {
        // If we closed a project before the active one, update the active index
        activeProjectIndex--;
        console.log(`[closeProject] Closed project before active. New active index: ${activeProjectIndex}`);
        updateProjectTabs();
    } else {
        // If we closed a project *after* the active one, the active index doesn't change,
        // but we still need to update the tabs display.
        console.log(`[closeProject] Closed project after active. Active index remains: ${activeProjectIndex}`);
        updateProjectTabs();
    }
}

// Update the project tabs display
// Now uses custom title bar dropdown instead of visual tabs
// This function maintains project list and updates the title bar
function updateProjectTabs() {
    // Get current project name
    const currentProject = (activeProjectIndex >= 0 && projects[activeProjectIndex])
        ? projects[activeProjectIndex]
        : null;
    const projectName = currentProject ? currentProject.name : 'Untitled';

    // Update custom title bar with current project name
    if (window.updateTitleBarProjectName) {
        window.updateTitleBarProjectName(projectName);
    }

    // Update the open projects list in the title bar dropdown
    if (window.customTitleBar && window.customTitleBar.updateOpenProjects) {
        window.customTitleBar.updateOpenProjects(projects, activeProjectIndex);
    }

    // Legacy tabs container - just hide it, don't return early
    const tabsContainer = document.getElementById('project-tabs');
    if (tabsContainer) {
        tabsContainer.style.display = 'none';
    }

    // Continue with normal project management (no early return!)
    // The rest of this function builds old-style tabs which are hidden,
    // but the logic flow must continue for file management to work

    if (!tabsContainer) return; // Only return if container doesn't exist

    projects.forEach((project, index) => {
        const tab = document.createElement('div');
        tab.className = 'project-tab';
        tab.dataset.projectId = project.id;
        tab.dataset.projectIndex = index;
        tab.draggable = true; // Make tab draggable
        if (index === activeProjectIndex) {
            tab.classList.add('active');
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'project-name';
        nameSpan.textContent = project.name || 'Untitled';
        nameSpan.title = project.name || 'Untitled'; // Tooltip for long names
        tab.appendChild(nameSpan);

        // Edit Button (Rename) - Show on hover
        const editButton = document.createElement('span');
        editButton.className = 'tab-edit fas fa-pencil-alt'; // Font Awesome pencil icon
        editButton.title = getText('renameProject') || 'Rename Project'; // Localized tooltip
        editButton.style.visibility = 'hidden'; // Initially hidden
        tab.appendChild(editButton);

        // Close Button
        const closeButton = document.createElement('span');
        closeButton.className = 'tab-close';
        closeButton.innerHTML = '&times;';
        closeButton.title = getText('closeProject') || 'Close Project';
        tab.appendChild(closeButton);

        // Click to switch project
        tab.addEventListener('click', (e) => {
            if (e.target === closeButton || e.target === editButton) return; // Ignore clicks on close/edit button
            switchToProject(index);
        });

        // Click on close button
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent tab switching
            closeProject(index);
        });

        // Click on edit button
        editButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent tab switching
            // Assuming showRenameProjectModal exists and is globally accessible
            if (window.showRenameProjectModal) {
                showRenameProjectModal(index);
            } else {
                console.error('showRenameProjectModal function not found!');
            }
        });

        // Show/Hide edit button on hover
        tab.addEventListener('mouseenter', () => {
            editButton.style.visibility = 'visible';
        });
        tab.addEventListener('mouseleave', () => {
            editButton.style.visibility = 'hidden';
        });

        // --- Drag and Drop Event Listeners ---
        tab.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index); // Store original index
            setTimeout(() => tab.classList.add('dragging'), 0); // Style dragging tab
        });

        tab.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            e.dataTransfer.dropEffect = 'move';
            const draggingTab = document.querySelector('.project-tab.dragging');
            if (draggingTab && draggingTab !== tab) {
                // Basic visual cue - shift tabs slightly
                const rect = tab.getBoundingClientRect();
                const isAfter = e.clientX > rect.left + rect.width / 2;
                tabsContainer.querySelectorAll('.project-tab:not(.new-tab):not(.dragging)').forEach(t => t.classList.remove('drag-over-before', 'drag-over-after'));
                if (isAfter) {
                    tab.classList.add('drag-over-after');
                } else {
                    tab.classList.add('drag-over-before');
                }
            }
        });

        tab.addEventListener('dragleave', (e) => {
            tab.classList.remove('drag-over-before', 'drag-over-after');
        });

        tab.addEventListener('drop', (e) => {
            e.preventDefault();
            tab.classList.remove('drag-over-before', 'drag-over-after');
            const draggingTab = document.querySelector('.project-tab.dragging');
            if (!draggingTab) return;

            const oldIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const newIndex = index;

            if (oldIndex !== newIndex) {
                // Reorder the projects array
                const [movedProject] = projects.splice(oldIndex, 1);
                projects.splice(newIndex, 0, movedProject);

                // Update activeProjectIndex if needed
                if (activeProjectIndex === oldIndex) {
                    activeProjectIndex = newIndex;
                } else if (oldIndex < activeProjectIndex && newIndex >= activeProjectIndex) {
                    activeProjectIndex--;
                } else if (oldIndex > activeProjectIndex && newIndex <= activeProjectIndex) {
                    activeProjectIndex++;
                }

                // Redraw tabs with new order and updated active index
                updateProjectTabs();
            }
        });

        tab.addEventListener('dragend', (e) => {
            tab.classList.remove('dragging');
            tabsContainer.querySelectorAll('.project-tab').forEach(t => t.classList.remove('drag-over-before', 'drag-over-after'));
        });
        // --- End Drag and Drop ---

        tabsContainer.appendChild(tab);
    });

    // Add the "+" button for new projects
    const newTabButton = document.createElement('div');
    newTabButton.className = 'project-tab new-tab';
    newTabButton.innerHTML = '<i class="fas fa-plus"></i>';
    newTabButton.title = getText('newMosaic') || 'New Mosaic'; // Use translation
    newTabButton.addEventListener('click', () => {
        console.log('[+] Tab Button Clicked');
        // Show new project modal for local creation
        const newProjectModal = document.getElementById('new-project-modal');
        const projectNameInput = document.getElementById('project-name');
        if (newProjectModal && projectNameInput) {
            projectNameInput.value = '';
            showModal(newProjectModal);
            projectNameInput.focus();
        } else {
            console.error('[+] Tab: New Project modal not found!');
            createNewProject('Untitled');
        }
    });
    tabsContainer.appendChild(newTabButton);
}
window.updateProjectTabs = updateProjectTabs; // Expose globally

// Function to show the rename project modal
function showRenameProjectModal(projectIndex) {
    if (projectIndex < 0 || projectIndex >= projects.length) return;

    // Get the project to rename
    const project = projects[projectIndex];

    // Check if the rename modal already exists
    let renameModal = document.getElementById('rename-project-modal');

    // Create the modal if it doesn't exist
    if (!renameModal) {
        renameModal = document.createElement('div');
        renameModal.id = 'rename-project-modal';
        renameModal.className = 'modal';

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        // Header
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';

        const modalTitle = document.createElement('h2');
        modalTitle.id = 'rename-modal-title';
        modalTitle.textContent = window.getText ? window.getText('renameProject') : 'Rename Project';

        const closeModalBtn = document.createElement('span');
        closeModalBtn.className = 'close-modal';
        closeModalBtn.innerHTML = '&times;';
        closeModalBtn.addEventListener('click', () => hideModal(renameModal));

        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeModalBtn);

        // Body
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';

        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.htmlFor = 'rename-project-name';
        label.textContent = window.getText ? window.getText('projectName') : 'Project Name:';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'rename-project-name';
        input.name = 'rename-project-name';
        input.placeholder = window.getText ? window.getText('projectNamePlaceholder') : 'Enter a name for your project';

        // Button row
        const buttonRow = document.createElement('div');
        buttonRow.style.display = 'flex';
        buttonRow.style.justifyContent = 'space-between';
        buttonRow.style.marginTop = '20px';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'secondary-btn';
        cancelBtn.textContent = window.getText ? window.getText('cancel') : 'Cancel';
        cancelBtn.addEventListener('click', () => hideModal(renameModal));

        const saveBtn = document.createElement('button');
        saveBtn.className = 'primary-btn';
        saveBtn.textContent = window.getText ? window.getText('save') : 'Save';
        saveBtn.id = 'rename-save-btn';

        buttonRow.appendChild(cancelBtn);
        buttonRow.appendChild(saveBtn);

        formGroup.appendChild(label);
        formGroup.appendChild(input);
        modalBody.appendChild(formGroup);
        modalBody.appendChild(buttonRow);

        // Footer
        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';
        modalFooter.textContent = 'Mosaic Mindmap Tool';

        // Assemble modal
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        renameModal.appendChild(modalContent);

        // Add to document
        document.body.appendChild(renameModal);

        // Setup event listeners for the newly created modal
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('rename-save-btn').click();
            } else if (e.key === 'Escape') {
                hideModal(renameModal);
            }
        });
    } else {
        // Update translations if modal already exists
        document.getElementById('rename-modal-title').textContent = window.getText ? window.getText('renameProject') : 'Rename Project';
        const label = renameModal.querySelector('label[for="rename-project-name"]');
        if (label) label.textContent = window.getText ? window.getText('projectName') : 'Project Name:';

        const saveBtn = document.getElementById('rename-save-btn');
        if (saveBtn) saveBtn.textContent = window.getText ? window.getText('save') : 'Save';

        const cancelBtn = renameModal.querySelector('.secondary-btn');
        if (cancelBtn) cancelBtn.textContent = window.getText ? window.getText('cancel') : 'Cancel';
    }

    // Update modal data
    const projectIndexAttr = document.createAttribute('data-project-index');
    projectIndexAttr.value = projectIndex;
    renameModal.setAttributeNode(projectIndexAttr);

    const input = document.getElementById('rename-project-name');
    input.value = project.name;

    // Update save button handler
    const saveBtn = document.getElementById('rename-save-btn');

    // Remove old event listeners
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    // Add new event listener
    newSaveBtn.addEventListener('click', () => {
        const name = document.getElementById('rename-project-name').value.trim();
        if (name) {
            renameProject(projectIndex, name);
            hideModal(renameModal);
        }
    });

    // Show the modal
    showModal(renameModal);

    // Focus on the input
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);
}

// Function to rename a project
function renameProject(projectIndex, newName) {
    if (projectIndex < 0 || projectIndex >= projects.length || !newName) return;

    // Update the project name
    projects[projectIndex].name = newName;

    // If this is the active project, update the current name
    if (projectIndex === activeProjectIndex) {
        currentProjectName = newName;
    }

    // Update the tabs
    updateProjectTabs();

    // Schedule auto-save after renaming
    if (window.scheduleAutoSave) window.scheduleAutoSave();
}

// Show a modal
function showModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
}

// Hide a modal
function hideModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
}

// Save the current project to a file
function saveProject() {
    if (activeProjectIndex < 0) {
        console.warn("Save Project: No active project.");
        return;
    }

    // --- Electron Save ---
    if (window.electronAPI) {
        console.log("Save Project: Using Electron API");
        saveProjectElectron();
        return;
    }

    // Always save locally when the button is pressed
    console.log("Save Project button clicked. Saving locally...");
    saveProjectLocally();
}

async function saveProjectElectron() {
    saveProjectState(activeProjectIndex);
    const project = projects[activeProjectIndex];

    // Capture thumbnail before saving
    let thumbnailBuffer = null;
    try {
        const thumbnailDataUrl = await captureProjectThumbnail();
        if (thumbnailDataUrl) {
            project.thumbnail = thumbnailDataUrl;
            // Also convert to buffer for preview.png
            thumbnailBuffer = window.assetManager.base64ToBuffer(thumbnailDataUrl);
        }
    } catch (err) {
        console.warn('Could not capture thumbnail:', err);
    }

    // Determine path (if we opened from a file, we might store the path on project)
    const currentPath = project.filePath;

    try {
        // ========== ZIP-BASED SAVE ==========
        console.log('[Save] Starting ZIP-based save...');

        // 1. Extract assets from project (Base64 -> files)
        const { project: lightProject, assets } = window.assetManager.extractAssetsFromProject(project);
        console.log(`[Save] Extracted ${assets.length} assets from project`);

        // 2. Create metadata
        const metadata = {
            version: '2.0',
            format: 'mosaic-zip',
            name: project.name,
            author: window.getCurrentUser?.()?.email || 'unknown',
            createdAt: project.createdAt || new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            nodeCount: (project.nodes || []).length,
            assetCount: assets.length
        };

        // 3. Build ZIP structure
        const zip = new JSZip();

        // Add project.json (lightweight state)
        zip.file('project.json', JSON.stringify(lightProject, null, 2));

        // Add metadata.json
        zip.file('metadata.json', JSON.stringify(metadata, null, 2));

        // Add preview.png (thumbnail)
        if (thumbnailBuffer) {
            zip.file('preview.png', thumbnailBuffer);
        }

        // Add assets
        const assetsFolder = zip.folder('assets');
        for (const asset of assets) {
            assetsFolder.file(asset.filename, asset.buffer);
        }

        // 4. Generate ZIP buffer
        const zipBuffer = await zip.generateAsync({
            type: 'uint8array',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        console.log(`[Save] ZIP created: ${(zipBuffer.length / 1024).toFixed(2)} KB`);

        // 5. Save via Electron
        const result = await window.electronAPI.saveZipFile(Array.from(zipBuffer), currentPath);

        if (result && result.success) {
            project.filePath = result.path; // Update path
            // Extract filename without extension
            const name = result.path.replace(/^.*[\\/]/, '').replace(/\.[^/.]+$/, "");
            setProjectName(name);
            console.log('[Save] Project saved as ZIP:', result.path);

            // Update recent projects (use Blob URL for thumbnail display)
            if (window.electronAPI && window.electronAPI.addToRecent) {
                window.electronAPI.addToRecent({
                    name: name,
                    path: result.path,
                    thumbnail: project.thumbnail || null // Keep data URL for recent list
                });
            }

            refreshLocalDashboard();
            window.dispatchEvent(new CustomEvent('projectSaved'));
        }
    } catch (err) {
        console.error('Electron save failed:', err);
        alert('Failed to save project: ' + err.message);
    }
}

// Capture a thumbnail of the current canvas
async function captureProjectThumbnail() {
    // Use the correct ID 'canvas' or just proceed if wrapper exists
    const canvas = document.getElementById('canvas');
    if (!canvas) {
        console.warn('[Thumbnail] Canvas element not found');
        return null;
    }

    // Check if html2canvas is available
    if (typeof html2canvas !== 'function') {
        console.warn('html2canvas not available for thumbnail capture');
        return null;
    }

    try {
        const canvasWrapper = document.getElementById('canvas-wrapper');
        if (!canvasWrapper) return null;

        // Capture at reduced size for thumbnail
        const capturedCanvas = await html2canvas(canvasWrapper, {
            backgroundColor: document.body.classList.contains('night-mode') ? '#1a1a1a' : '#f0f0f0',
            scale: 0.5, // Improved scale for better visibility (was 0.2)
            logging: false,
            useCORS: true,
            allowTaint: true,
            onclone: (clonedDoc) => {
                // 1. Handle Webviews & Iframes (replace with placeholder)
                const webviews = clonedDoc.querySelectorAll('webview, iframe');
                webviews.forEach(wv => {
                    const placeholder = clonedDoc.createElement('div');
                    // Copy layout styles
                    placeholder.style.width = wv.style.width || '100%';
                    placeholder.style.height = wv.style.height || '100%';
                    placeholder.style.position = wv.style.position;
                    placeholder.style.left = wv.style.left;
                    placeholder.style.top = wv.style.top;

                    // Style the placeholder
                    placeholder.style.backgroundColor = '#1e1e1e';
                    placeholder.style.display = 'flex';
                    placeholder.style.alignItems = 'center';
                    placeholder.style.justifyContent = 'center';
                    placeholder.style.border = '1px solid #333';

                    // Add icon
                    placeholder.innerHTML = '<i class="fas fa-globe" style="font-size: 40px; color: #555;"></i>';

                    if (wv.parentNode) {
                        wv.parentNode.replaceChild(placeholder, wv);
                    }
                });

                // 2. Handle Inputs & Textareas (replace with div for better rendering)
                const inputs = clonedDoc.querySelectorAll('input[type="text"], textarea');
                inputs.forEach(input => {
                    const div = clonedDoc.createElement('div');
                    const style = window.getComputedStyle(input);

                    div.style.cssText = style.cssText;
                    // Force background if transparent
                    div.style.backgroundColor = (style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent')
                        ? '#252525' : style.backgroundColor;
                    div.style.color = style.color || '#e0e0e0';
                    div.style.whiteSpace = 'pre-wrap';
                    div.style.wordBreak = 'break-word';
                    div.textContent = input.value;

                    // Reset some form specific styles
                    div.style.border = 'none';
                    div.style.outline = 'none';
                    div.style.overflow = 'hidden';

                    if (input.parentNode) {
                        input.parentNode.replaceChild(div, input);
                    }
                });

                // 3. Ensure content visibility for nodes
                const contentContainers = clonedDoc.querySelectorAll('.content-container');
                contentContainers.forEach(cc => {
                    const style = window.getComputedStyle(cc);
                    if (style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent') {
                        cc.style.backgroundColor = '#252525';
                    }
                });
            }
        });

        // Convert to data URL (compressed JPEG for smaller size)
        const thumbnail = capturedCanvas.toDataURL('image/jpeg', 0.8); // Improved quality (was 0.5)
        console.log('[Thumbnail] Captured thumbnail, size:', Math.round(thumbnail.length / 1024), 'KB');
        return thumbnail;
    } catch (err) {
        console.warn('[Thumbnail] Error capturing thumbnail:', err);
        return null;
    }
}

// --- NEW FUNCTION: Extracted local save logic ---
function saveProjectLocally() {
    if (activeProjectIndex < 0) return; // Double check

    // --- CRITICAL FIX: Save current state from DOM to memory before saving to file ---
    // This ensures that recent changes (like content-only mode toggles) are captured
    saveProjectState(activeProjectIndex);
    // ----------------------------------------------------------------------------------

    const project = projects[activeProjectIndex];

    // Create data blob
    const projectData = JSON.stringify(project, null, 2);
    const blob = new Blob([projectData], { type: 'application/json' });

    // Create filename
    const filename = `${getSafeFilename(project.name)}.mosaic`;

    // Trigger download
    if (window.saveAs) { // Use FileSaver.js if available
        saveAs(blob, filename);
    } else {
        // Basic fallback download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Open a project from a file
function openProject(optionalFilePath = null) {
    // --- Electron Open ---
    if (window.electronAPI) {
        console.log("Open Project: Using Electron API");
        openProjectElectron(optionalFilePath);
        return;
    }

    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.mosaic,application/json';

    // Handle file selection
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const projectData = JSON.parse(event.target.result);
                const projectName = projectData.name || file.name.replace(/\.mosaic$/, '') || 'Untitled';

                // Load project locally
                console.log("openProject: Loading project locally.");
                const project = new Project(
                    projectName,
                    projectData.nodes || [],
                    projectData.connections || []
                );

                // Restore additional properties
                if (projectData.id) project.id = projectData.id; // Restore UUID for synced projects
                if (projectData.groups) project.groups = projectData.groups;
                if (projectData.stickers) project.stickers = projectData.stickers;
                if (projectData.canvasOffset) project.canvasOffset = projectData.canvasOffset;
                if (projectData.canvasScale) project.canvasScale = projectData.canvasScale;
                if (projectData.nightMode !== undefined) project.nightMode = projectData.nightMode;

                // Add to projects array
                projects.push(project);

                // Restore connections (Needs delay to ensure nodes are in DOM)
                setTimeout(() => {
                    projectData.connections.forEach(conn => {
                        if (window.createConnection) {
                            window.createConnection(conn.from, conn.to, conn.outputSide, conn.inputSide);
                        }
                    });
                }, 500);

                // Switch to the new project (with a minimal delay for stability)
                setTimeout(() => {
                    switchToProject(projects.length - 1);
                    if (window.resetCanvasView) {
                        setTimeout(() => window.resetCanvasView(), 50);
                    }
                }, 0);

                console.log(`Project loaded locally: ${project.name}`);

            } catch (e) {
                console.error("Error parsing project file:", e);
                alert('Could not load the project file. It may be corrupted or in an invalid format.');
            }
        };

        reader.readAsText(file);
    });

    // Trigger file selection
    fileInput.click();
}

async function openProjectElectron(filePath = null) {
    try {
        // First, determine if we have a path and check file type
        let targetPath = filePath;

        if (!targetPath) {
            // Show open dialog
            const dialogResult = await window.electronAPI.openFile(null);
            if (dialogResult.canceled) return;
            targetPath = dialogResult.path;
        }

        // Check if file is ZIP format
        const formatCheck = await window.electronAPI.isZipFile(targetPath);
        const isZipFormat = formatCheck.isZip;

        console.log(`[Open] File: ${targetPath}, isZip: ${isZipFormat}`);

        let projectData, projectName;

        if (isZipFormat) {
            // ========== ZIP FORMAT ==========
            console.log('[Open] Loading ZIP-based project...');

            // Read ZIP file
            const zipResult = await window.electronAPI.openZipFile(targetPath);
            if (!zipResult.success) {
                throw new Error('Failed to read ZIP file');
            }

            // Parse ZIP
            const zip = await JSZip.loadAsync(zipResult.buffer);

            // Read project.json
            const projectJsonFile = zip.file('project.json');
            if (!projectJsonFile) {
                throw new Error('Invalid project: missing project.json');
            }
            const projectJsonContent = await projectJsonFile.async('string');
            projectData = JSON.parse(projectJsonContent);

            // Read metadata.json (optional)
            const metadataFile = zip.file('metadata.json');
            if (metadataFile) {
                const metadataContent = await metadataFile.async('string');
                const metadata = JSON.parse(metadataContent);
                console.log('[Open] Project metadata:', metadata);
            }

            // Extract all assets upfront (for immediate display)
            const assetBuffers = new Map();
            const assetsFolder = zip.folder('assets');
            if (assetsFolder) {
                const assetFiles = [];
                assetsFolder.forEach((relativePath, file) => {
                    if (!file.dir) {
                        assetFiles.push({ path: `assets/${relativePath}`, file });
                    }
                });

                console.log(`[Open] Loading ${assetFiles.length} assets...`);
                for (const { path, file } of assetFiles) {
                    const buffer = await file.async('uint8array');
                    assetBuffers.set(path, buffer);
                }
            }

            // Restore asset references to Blob URLs
            if (assetBuffers.size > 0) {
                projectData = window.assetManager.restoreAssetsToProject(projectData, assetBuffers);
            }

            // Read preview.png for thumbnail if not already set
            if (!projectData.thumbnail) {
                const previewFile = zip.file('preview.png');
                if (previewFile) {
                    const previewBuffer = await previewFile.async('uint8array');
                    projectData.thumbnail = window.assetManager.bufferToBlobUrl(previewBuffer, 'image/png');
                }
            }

            // Set ZIP path for lazy loading
            window.assetManager.setCurrentZipPath(targetPath);

            projectName = zipResult.name.replace('.mosaic', '');

        } else {
            // ========== LEGACY JSON FORMAT ==========
            console.log('[Open] Loading legacy JSON project...');

            const result = await window.electronAPI.openFile(targetPath);
            if (!result.success) {
                throw new Error('Failed to read file');
            }

            projectData = JSON.parse(result.content);
            projectName = result.name.replace('.mosaic', '').replace('.json', '');
        }

        // Check if already open
        if (window.projects) {
            const existingProjectIndex = window.projects.findIndex(p => p.filePath === targetPath);
            if (existingProjectIndex !== -1) {
                console.log('Project already open, switching to it:', targetPath);
                switchToProject(existingProjectIndex);
                const welcomeModal = document.getElementById('welcome-modal');
                if (welcomeModal) hideModal(welcomeModal);
                return;
            }
        }

        // SINGLE PROJECT MODE: Check if there's already an open project
        if (projects.length > 0 && activeProjectIndex >= 0) {
            const currentProject = projects[activeProjectIndex];
            const confirmed = confirm(
                `You have an active project: "${currentProject.name}"\n\n` +
                `Close the current project and open "${projectName}"?\n\n` +
                `(Any unsaved changes will be lost)`
            );

            if (!confirmed) {
                console.log("[openProjectElectron] User cancelled - keeping current project");
                return;
            }

            // Close all existing projects first
            console.log("[openProjectElectron] Closing existing projects for single-project mode");

            // Clear asset cache for old project
            window.assetManager.clearCache();

            projects.length = 0;
            activeProjectIndex = -1;
        }

        const project = new Project(
            projectName,
            projectData.nodes || [],
            projectData.connections || []
        );

        // Set file path and storage type
        project.filePath = targetPath;
        project.storageType = 'local';
        project.isZipFormat = isZipFormat; // Track format

        // Restore additional properties
        if (projectData.canvasOffset) project.canvasOffset = projectData.canvasOffset;
        if (projectData.canvasScale) project.canvasScale = projectData.canvasScale;
        if (projectData.groups) project.groups = projectData.groups;
        if (projectData.stickers) project.stickers = projectData.stickers;
        if (projectData.drawings) project.drawings = projectData.drawings;
        if (projectData.dataCardStore) project.dataCardStore = projectData.dataCardStore; // I/O panel data
        if (projectData.nightMode !== undefined) project.nightMode = projectData.nightMode;

        // Restore cloud sync info
        if (projectData.cloudId) {
            project.cloudId = projectData.cloudId;
            project.storageType = 'cloud';
        }

        // Restore thumbnail
        if (projectData.thumbnail) project.thumbnail = projectData.thumbnail;

        // Add and switch
        projects.push(project);

        // Add to recent projects
        if (window.electronAPI && window.electronAPI.addToRecent) {
            window.electronAPI.addToRecent({
                name: projectName,
                path: targetPath,
                thumbnail: projectData.thumbnail || null
            });
        }

        // Hide dashboard/modal
        const welcomeModal = document.getElementById('welcome-modal');
        if (welcomeModal) hideModal(welcomeModal);

        setTimeout(() => {
            switchToProject(projects.length - 1);
            if (window.resetCanvasView) setTimeout(() => window.resetCanvasView(), 50);
        }, 0);

        console.log(`[Open] Project opened successfully: ${targetPath} (format: ${isZipFormat ? 'ZIP' : 'JSON'})`);

    } catch (err) {
        console.error('Electron open failed:', err);
        alert('Failed to open project: ' + err.message);
    }
}


// Export the current viewport as a PNG image
function exportAsImage() {
    // Create a notification to show during rendering
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.top = '50%';
    notification.style.left = '50%';
    notification.style.transform = 'translate(-50%, -50%)';
    notification.style.background = 'rgba(0, 0, 0, 0.8)';
    notification.style.color = 'white';
    notification.style.padding = '20px';
    notification.style.borderRadius = '10px';
    notification.style.zIndex = '10000';
    notification.textContent = 'Capturing viewport...';
    document.body.appendChild(notification);

    // Get the canvas wrapper which represents the viewport
    const canvasWrapper = document.getElementById('canvas-wrapper');

    if (!canvasWrapper) {
        notification.textContent = 'Cannot find canvas viewport';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
        return;
    }

    try {
        // Use html2canvas to capture the current viewport
        html2canvas(canvasWrapper, {
            backgroundColor: document.body.classList.contains('night-mode') ? '#1a1a1a' : '#f0f0f0',
            scale: 2,  // Higher quality
            useCORS: true,
            logging: false, // Disable logs
            // Don't capture scrollbars
            onclone: (clonedDoc) => {
                const style = clonedDoc.createElement('style');
                style.innerHTML = '::-webkit-scrollbar { display: none !important; }';
                clonedDoc.head.appendChild(style);
            }
        }).then(canvas => {
            // Create formatted date string (YYYY-MM-DD)
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

            // Get project name or use "Untitled"
            const projectName = (currentProjectName || 'Untitled').replace(/\s+/g, '-');

            // Generate filename
            const filename = `${projectName}-${dateStr}-viewport.png`;

            // Convert canvas to image and download
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();

            // Clean up
            document.body.removeChild(notification);

            console.log(`Exported viewport as: ${filename}`);
        }).catch(err => {
            console.error('Error exporting image:', err);
            notification.textContent = 'Error exporting image';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 2000);
        });
    } catch (err) {
        console.error('Error setting up export:', err);
        notification.textContent = 'Error setting up export';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }
}

// Export functions to global scope
window.initFileManagement = initFileManagement; // Ensure it's available for main.js
window.setProjectName = setProjectName;
window.saveProject = saveProject;
window.openProject = openProject;
window.exportAsImage = exportAsImage;
window.createNewProject = createNewProject;
window.switchToProject = switchToProject;
window.closeProject = closeProject;
window.showRenameProjectModal = showRenameProjectModal;
window.renameProject = renameProject;

// --- PDF Export Functionality ---

// Helper to convert image URL to Base64
function imageToBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Handle CORS if images are from different origins
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (error) {
                console.error('Error creating base64 image:', error);
                reject(error);
            }
        };
        img.onerror = (error) => {
            console.error('Error loading image for PDF export:', url, error);
            reject(new Error(`Failed to load image: ${url}`));
        };
        img.src = url;

        // Add timeout for images that may never load
        setTimeout(() => {
            if (!img.complete) {
                reject(new Error(`Image load timeout: ${url}`));
            }
        }, 10000); // 10 second timeout
    });
}

// Helper to process HTML content for PDF
async function processNodeContent(contentEl, doc, startX, startY, availableWidth) {
    if (!contentEl) return startY;

    let currentY = startY;
    const lineHeight = 12;
    const paragraphSpacing = 8;
    const textColor = doc.getTextColor();

    // Function to process all child nodes recursively
    async function processElement(element, level = 0) {
        // Indent list items
        const indent = level * 10;
        const itemX = startX + indent;

        // Process each child node
        for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];

            // Handle text nodes
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent.trim();
                if (text) {
                    try {
                        const lines = doc.splitTextToSize(text, availableWidth - indent);
                        doc.text(lines, itemX, currentY);
                        currentY += lines.length * lineHeight;
                    } catch (error) {
                        console.error('Error processing text:', error);
                    }
                }
            }
            // Handle element nodes
            else if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();

                switch (tagName) {
                    case 'img':
                        try {
                            console.log('Processing image:', child.src);
                            const imgDataUrl = await imageToBase64(child.src);

                            // Get image dimensions
                            const imgWidth = child.naturalWidth || child.width || 100;
                            const imgHeight = child.naturalHeight || child.height || 100;

                            // Scale image if too wide
                            let drawWidth = Math.min(imgWidth, availableWidth - indent);
                            let drawHeight = imgHeight * (drawWidth / imgWidth);

                            // Add image to PDF
                            doc.addImage(
                                imgDataUrl,
                                'PNG',
                                itemX,
                                currentY,
                                drawWidth,
                                drawHeight
                            );

                            currentY += drawHeight + paragraphSpacing;
                            console.log('Image added successfully at', itemX, currentY - drawHeight);
                        } catch (error) {
                            console.error('Error processing image:', error);
                            doc.setTextColor('#FF0000');
                            doc.text('[Image Error]', itemX, currentY);
                            doc.setTextColor(textColor);
                            currentY += lineHeight;
                        }
                        break;

                    case 'h1':
                    case 'h2':
                    case 'h3':
                    case 'h4':
                    case 'h5':
                    case 'h6':
                        // Save current font size
                        const currentSize = doc.getFontSize();
                        // Calculate heading size (h1 is largest, h6 is smallest)
                        const headingSize = currentSize * (1.5 - ((parseInt(tagName.substring(1)) - 1) * 0.1));
                        doc.setFontSize(headingSize);

                        if (child.textContent.trim()) {
                            const lines = doc.splitTextToSize(child.textContent.trim(), availableWidth - indent);
                            doc.text(lines, itemX, currentY);
                            currentY += lines.length * (headingSize / currentSize * lineHeight) + paragraphSpacing;
                        }

                        // Restore font size
                        doc.setFontSize(currentSize);
                        break;

                    case 'p':
                        if (child.textContent.trim()) {
                            const lines = doc.splitTextToSize(child.textContent.trim(), availableWidth - indent);
                            doc.text(lines, itemX, currentY);
                            currentY += lines.length * lineHeight + paragraphSpacing;
                        }
                        break;

                    case 'br':
                        currentY += lineHeight;
                        break;

                    case 'ul':
                    case 'ol':
                        // Process lists
                        const listItems = child.querySelectorAll(':scope > li');
                        for (let j = 0; j < listItems.length; j++) {
                            const item = listItems[j];
                            const bulletOrNumber = tagName === 'ul' ? '• ' : `${j + 1}. `;

                            // Add bullet/number
                            doc.text(bulletOrNumber, itemX, currentY);

                            // Process list item content with indent
                            const listItemX = itemX + doc.getTextWidth(bulletOrNumber) + 2;

                            // Handle text content in list item
                            if (item.childNodes.length === 1 && item.childNodes[0].nodeType === Node.TEXT_NODE) {
                                const lines = doc.splitTextToSize(item.textContent.trim(), availableWidth - indent - doc.getTextWidth(bulletOrNumber) - 2);
                                doc.text(lines, listItemX, currentY);
                                currentY += lines.length * lineHeight;
                            } else {
                                // Handle nested content in list item
                                const startingY = currentY;
                                await processElement(item, level + 1);
                                // If there wasn't any Y movement, add some space
                                if (currentY === startingY) {
                                    currentY += lineHeight;
                                }
                            }
                        }
                        currentY += paragraphSpacing;
                        break;

                    case 'li':
                        // List items are handled in the ul/ol case
                        await processElement(child, level + 1);
                        break;

                    case 'strong':
                    case 'b':
                        // Handle bold text
                        doc.setFont('Helvetica', 'bold');
                        if (child.textContent.trim()) {
                            const lines = doc.splitTextToSize(child.textContent.trim(), availableWidth - indent);
                            doc.text(lines, itemX, currentY);
                            currentY += lines.length * lineHeight;
                        }
                        doc.setFont('Helvetica', 'normal');
                        break;

                    case 'em':
                    case 'i':
                        // Handle italic text
                        doc.setFont('Helvetica', 'italic');
                        if (child.textContent.trim()) {
                            const lines = doc.splitTextToSize(child.textContent.trim(), availableWidth - indent);
                            doc.text(lines, itemX, currentY);
                            currentY += lines.length * lineHeight;
                        }
                        doc.setFont('Helvetica', 'normal');
                        break;

                    case 'iframe':
                        const iframeSrc = child.getAttribute('src') || '';
                        doc.setFont('Helvetica', 'italic');
                        doc.setTextColor('#888888'); // Dim color for iframe src
                        doc.text(`[Iframe: ${iframeSrc}]`, itemX, currentY, { maxWidth: availableWidth - indent });
                        doc.setTextColor(textColor);
                        doc.setFont('Helvetica', 'normal');
                        currentY += lineHeight;
                        break;

                    default:
                        // For other elements, recursively process their children
                        await processElement(child, level);
                }
            }
        }
    }

    // Start processing from the content element
    await processElement(contentEl);

    return currentY;
}

// Export the entire mindmap as a PDF document (Improved Version)
async function exportAsPDF() {
    // Ensure jsPDF is loaded
    if (typeof jspdf === 'undefined') {
        console.error('jsPDF library is not loaded.');
        alert('PDF Export library not found. Please check your internet connection or contact support.');
        return;
    }
    const { jsPDF } = jspdf;

    // Get current project data
    if (activeProjectIndex < 0 || !projects[activeProjectIndex]) {
        console.error('No active project to export');
        alert('No active project selected for export.');
        return;
    }
    saveProjectState(activeProjectIndex); // Ensure current state is captured
    const project = projects[activeProjectIndex];
    const nodes = project.nodes;
    const connections = project.connections;

    if (!nodes || nodes.length === 0) {
        alert('Cannot export an empty project.');
        return;
    }

    // --- 1. Calculate Bounds & Collect Node Elements ---
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const nodeElements = {}; // Store DOM elements for size/content access
    document.querySelectorAll('.node').forEach(nodeEl => {
        // Use the node data structure from saveProjectState (which uses captureNodeData)
        const nodeData = nodes.find(n => n.id === nodeEl.id);
        if (nodeData) {
            // Access position correctly
            const x = nodeData.position?.x ?? 0;
            const y = nodeData.position?.y ?? 0;
            const width = nodeEl.offsetWidth;
            const height = nodeEl.offsetHeight;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
            nodeElements[nodeEl.id] = nodeEl; // Store element
        }
    });

    const padding = 50; // Space around the content
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const pdfWidth = contentWidth + padding * 2;
    const pdfHeight = contentHeight + padding * 2;
    const orientation = pdfWidth > pdfHeight ? 'landscape' : 'portrait';

    // --- 2. Initialize jsPDF ---
    const doc = new jsPDF({
        orientation: orientation,
        unit: 'pt',
        format: [pdfWidth, pdfHeight]
    });

    // --- Font Handling for Unicode Support ---
    try {
        // Try a font with potentially better Unicode support
        doc.setFont('Arial', 'normal'); // Try Arial instead of Helvetica
        console.log("Using Arial font for PDF export.");
    } catch (fontError) {
        console.warn("Arial font not available, falling back to Helvetica.", fontError);
        try {
            doc.setFont('Helvetica', 'normal');
        } catch (fallbackError) {
            console.error("Could not set any standard font for PDF.", fallbackError);
        }
    }

    // --- 3. Set Background & Colors ---
    const isNightMode = document.body.classList.contains('night-mode');
    const backgroundColor = isNightMode ? '#1a1a1a' : '#ffffff';
    const nodeBackgroundColor = isNightMode ? '#2b2b2b' : '#ffffff';
    const textColor = isNightMode ? '#e0e0e0' : '#333333';
    const connectionColor = isNightMode ? '#a0a0a0' : '#aaaaaa'; // Slightly adjusted for visibility
    const nodeBorderColor = isNightMode ? '#555555' : '#cccccc';

    doc.setFillColor(backgroundColor);
    doc.rect(0, 0, pdfWidth, pdfHeight, 'F');

    // --- 4. Add Header ---
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const headerText = `${project.name} - ${dateStr}`;
    doc.setFontSize(10);
    doc.setTextColor(textColor);
    doc.text(headerText, padding / 2, padding / 2 + 10);

    // --- Coordinate Transformation ---
    const transformX = (canvasX) => (canvasX - minX) + padding;
    const transformY = (canvasY) => (canvasY - minY) + padding;

    // --- 5. Draw Connections (Bezier Curves) ---
    doc.setLineWidth(1.5);
    doc.setDrawColor(connectionColor);

    connections.forEach(conn => {
        const startNodeEl = nodeElements[conn.startNode];
        const endNodeEl = nodeElements[conn.endNode];
        // Access position correctly from node data
        const startNodeData = nodes.find(n => n.id === conn.startNode);
        const endNodeData = nodes.find(n => n.id === conn.endNode);

        if (!startNodeEl || !endNodeEl || !startNodeData || !endNodeData) return;

        // Calculate absolute pin positions using correct position data
        const startX = (conn.startPin === 'left') ? startNodeData.position.x : startNodeData.position.x + startNodeEl.offsetWidth;
        const startY = startNodeData.position.y + startNodeEl.offsetHeight / 2;
        const endX = (conn.endPin === 'left') ? endNodeData.position.x : endNodeData.position.x + endNodeEl.offsetWidth;
        const endY = endNodeData.position.y + endNodeEl.offsetHeight / 2;

        // Transform coordinates for PDF
        const pdfStartX = transformX(startX);
        const pdfStartY = transformY(startY);
        const pdfEndX = transformX(endX);
        const pdfEndY = transformY(endY);

        // Calculate control points (same logic as in connections.js)
        const dx = Math.abs(pdfEndX - pdfStartX) / 2;
        let cp1X, cp2X;
        if (conn.startPin === 'left') { cp1X = pdfStartX - dx; } else { cp1X = pdfStartX + dx; }
        if (conn.endPin === 'left') { cp2X = pdfEndX - dx; } else { cp2X = pdfEndX + dx; }

        // Draw Bezier curve
        doc.path([
            { op: 'm', c: [pdfStartX, pdfStartY] }, // Move to start
            { op: 'c', c: [cp1X, pdfStartY, cp2X, pdfEndY, pdfEndX, pdfEndY] } // Bezier curve to end
        ]).stroke();
    });

    // --- 6. Draw Nodes (with Images and Text) ---
    console.log(`Processing ${nodes.length} nodes for PDF export`);
    const nodeDrawingPromises = nodes.map(async (nodeData, index) => {
        const nodeEl = nodeElements[nodeData.id];
        if (!nodeEl) {
            console.warn(`Node element not found for node data: ${nodeData.id}`);
            return;
        }

        console.log(`Processing node ${index + 1}/${nodes.length}: ${nodeData.id} (Type: ${nodeData.nodeType})`);

        // Access position correctly
        const x = nodeData.position?.x ?? 0;
        const y = nodeData.position?.y ?? 0;
        const width = nodeEl.offsetWidth;
        const height = nodeEl.offsetHeight;
        const contentEl = nodeEl.querySelector('.content');
        // Get node type and content from nodeData
        const nodeType = nodeData.nodeType || 'default';
        const nodeContent = nodeData.content;
        const stripColor = nodeData.stripColor || (isNightMode ? '#444' : '#eee');

        const pdfX = transformX(x);
        const pdfY = transformY(y);

        // Draw node background and border
        doc.setFillColor(nodeBackgroundColor);
        doc.setDrawColor(nodeBorderColor);
        doc.setLineWidth(1);
        doc.rect(pdfX, pdfY, width, height, 'FD'); // Fill and Stroke

        // Draw color strip
        const stripWidth = 5;
        doc.setFillColor(stripColor);
        doc.rect(pdfX, pdfY, stripWidth, height, 'F');

        // --- Process node content --- 
        const contentStartX = pdfX + stripWidth + 10;
        const contentStartY = pdfY + 15; // Slightly more top padding
        const availableWidth = width - stripWidth - 20;

        doc.setFontSize(10);
        doc.setTextColor(textColor);

        try {
            if (nodeType === 'checklist') {
                // Handle checklist content DIRECTLY from nodeContent (JSON string)
                doc.setFont('Arial', 'italic'); // Use the chosen font
                // doc.text("[Checklist Content - See Below]", contentStartX, contentStartY); // Remove this line
                doc.setFont('Arial', 'normal'); // Use the chosen font
                let currentY = contentStartY; // Start checklist items directly
                try {
                    // nodeContent should already be the JSON string from captureNodeData
                    const checklistData = JSON.parse(nodeContent);
                    if (checklistData && Array.isArray(checklistData.items)) {
                        doc.setFontSize(9); // Slightly smaller for checklist items
                        checklistData.items.forEach(item => {
                            const itemText = `${item.checked ? '[x]' : '[ ]'} ${item.text}`;
                            const lines = doc.splitTextToSize(itemText, availableWidth - 5); // Adjust width slightly
                            if (currentY + (lines.length * 9) > pdfY + height - 10) return; // Prevent overflow based on font size
                            doc.text(lines, contentStartX + 5, currentY);
                            currentY += lines.length * 9 + 2; // Adjust spacing
                        });
                        doc.setFontSize(10); // Reset font size
                    }
                } catch (e) {
                    doc.setFont('Arial', 'italic');
                    doc.text("(Error parsing checklist data)", contentStartX, currentY);
                    doc.setFont('Arial', 'normal');
                    currentY += 10;
                    console.error("Error parsing checklist JSON for PDF:", e, "Content:", nodeContent);
                }

            } else if (contentEl) {
                // Use existing HTML content processor for default nodes
                // Ensure processNodeContent also uses the correct font
                doc.setFont('Arial', 'normal');
                await processNodeContent(contentEl, doc, contentStartX, contentStartY, availableWidth);
            } else {
                // Fallback if content element not found
                doc.setFont('Arial', 'normal');
                doc.text(nodeContent || "(No Content)", contentStartX, contentStartY, { maxWidth: availableWidth });
            }
        } catch (error) {
            console.error(`Error processing node content for PDF: ${error.message}`, error);
            doc.setFont('Arial', 'italic');
            doc.text("(Error drawing content)", contentStartX, contentStartY);
            doc.setFont('Arial', 'normal');
        }
    });

    // Wait for all nodes (including images) to be processed
    await Promise.all(nodeDrawingPromises);

    // --- 7. Generate Filename & Save ---
    const safeProjectName = getSafeFilename(project.name);
    const filename = `${safeProjectName}-${now.toISOString().split('T')[0]}.pdf`;

    try {
        doc.save(filename);
        console.log(`Exported project as PDF: ${filename}`);
    } catch (error) {
        console.error('Error saving PDF:', error);
        alert('An error occurred while saving the PDF.');
    }
}

// --- End PDF Export ---


// --- Sync to Cloud (Supabase) ---

async function saveProjectToSupabase(projectIndex = activeProjectIndex) {
    if (projectIndex < 0 || !window.projects || !window.projects[projectIndex]) {
        console.error("Invalid project index for sync");
        return null;
    }

    const project = window.projects[projectIndex];
    console.log(`[Sync] Starting sync for project: ${project.name}`);

    // notification
    const notification = document.createElement('div');
    notification.className = 'notification-toast';
    notification.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#333; color:white; padding:10px 20px; border-radius:4px; z-index:10000;';
    notification.textContent = 'Syncing to Cloud...';
    document.body.appendChild(notification);

    try {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        if (!supabase) throw new Error("Supabase client not initialized");

        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!user) throw new Error("User not logged in");

        // Prepare data JSON
        const projectData = {
            nodes: project.nodes,
            connections: project.connections,
            groups: project.groups || [],
            stickers: project.stickers || [],
            canvasOffset: window.canvasOffset,
            canvasScale: window.canvasScale,
            nightMode: document.body.classList.contains('night-mode')
        };

        let data, error;

        // Check if we already have a UUID (update) or need to create (insert)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project.id);

        if (project.id && isUUID) {
            // Update existing
            console.log(`[Sync] Updating existing project ${project.id}`);
            ({ data, error } = await supabase
                .from('projects')
                .update({
                    name: project.name,
                    data: projectData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', project.id)
                .select());
        } else {
            // Create new
            console.log(`[Sync] Creating new project`);
            ({ data, error } = await supabase
                .from('projects')
                .insert({
                    name: project.name,
                    data: projectData,
                    user_id: user.id,
                    is_public: false
                })
                .select());
        }

        if (error) throw error;

        if (data && data.length > 0) {
            const syncedProject = data[0];

            // Update local project with Supabase ID and storage type
            project.id = syncedProject.id;
            project.cloudId = syncedProject.id;  // Track cloud ID separately
            project.storageType = 'cloud';        // Mark as cloud project

            console.log(`[Sync] Sync successful. Project ID: ${project.id}, Storage Type: ${project.storageType}`);
            notification.textContent = 'Project Synced to Cloud!';
            notification.style.backgroundColor = '#4CAF50';

            // Connect to multiplayer now that we have an ID
            if (window.multiplayer) {
                window.multiplayer.connect(project.id);
            }

            // Update the sidebar to reflect the new storage type
            if (window.dashboardManager && window.dashboardManager.updateSidebar) {
                window.dashboardManager.updateSidebar();
            }

            // Re-save locally to persist the new ID
            saveProject(projectIndex);

            return project.id;
        }

    } catch (err) {
        console.error("[Sync] Error syncing project:", err);
        notification.textContent = 'Sync Failed: ' + err.message;
        notification.style.backgroundColor = '#f44336';
    } finally {
        setTimeout(() => {
            if (notification.parentNode) document.body.removeChild(notification);
        }, 3000);
    }
    return null;
}

// Export functions to global scope
window.initFileManagement = initFileManagement; // Ensure it's available for main.js
window.setProjectName = setProjectName;
window.saveProject = saveProject;
window.saveProjectToSupabase = saveProjectToSupabase; // [NEW] Export
window.openProject = openProject;
window.exportAsImage = exportAsImage;
window.exportAsPDF = exportAsPDF;
window.createNewProject = createNewProject;
window.switchToProject = switchToProject;
window.closeProject = closeProject;
window.showRenameProjectModal = showRenameProjectModal;
window.renameProject = renameProject;

// --- Loading Indicator Functions ---
function showLoadingOverlay(message = 'Loading...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.color = 'white';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '10001'; // Above most elements
        overlay.style.fontSize = '1.5em';
        document.body.appendChild(overlay);
    }
    overlay.textContent = message;
    overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Bu fonksiyonları pencere nesnesine ekleyelim
window.showLoadingOverlay = showLoadingOverlay;
window.hideLoadingOverlay = hideLoadingOverlay;
// --- End Loading Indicator ---
