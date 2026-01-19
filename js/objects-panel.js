/**
 * Objects Panel (Title Bar)
 * Manages the "Objects" panel in the title bar.
 * Listing, Navigation, and Focus Mode integration.
 */

class ObjectsPanel {
    constructor() {
        this.container = null;
        this.dropdown = null;
        this.labelEl = null;
        this.navPrev = null;
        this.navNext = null;

        this.isOpen = false;
        this.collapsedGroups = new Set();
        this.cachedFlatList = []; // Array of {id, type, element} for linear navigation

        this.init();
    }

    init() {
        console.log('[ObjectsPanel] Initializing Title Bar Panel...');

        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }

        this.setupObservers();
    }

    setup() {
        this.container = document.getElementById('titlebar-objects');
        this.dropdown = document.getElementById('titlebar-objects-list');

        if (!this.container) return;

        this.labelEl = this.container.querySelector('.t-obj-label');
        this.navPrev = this.container.querySelector('.t-obj-nav-btn.prev');
        this.navNext = this.container.querySelector('.t-obj-nav-btn.next');
        const mainBtn = this.container.querySelector('.t-obj-main');

        // Main button click - toggle dropdown
        if (mainBtn) {
            mainBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('[ObjectsPanel] Toggle clicked');
                this.toggleDropdown();
            });
        }

        // Navigation buttons
        if (this.navPrev) {
            this.navPrev.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.navigate(-1);
            });
        }

        if (this.navNext) {
            this.navNext.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.navigate(1);
            });
        }

        // Global click listener to close dropdown
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // App Visibility Check
        this.checkVisibility();
    }


    setupObservers() {
        // 1. Update list on Node Changes
        ['nodeCreated', 'nodeDeleted', 'groupCreated', 'groupDeleted'].forEach(evt => {
            window.addEventListener(evt, () => this.dirtyUpdate());
        });

        // 2. Selection / Focus changes
        window.addEventListener('selectionChanged', () => {
            this.updateLabel();
            this.highlightInDropdown();
        });

        // 3. Focus Mode changes - listen for specific events
        ['focusModeEntered', 'focusModeExited', 'focus-mode-entered', 'focus-mode-exited'].forEach(evt => {
            window.addEventListener(evt, () => {
                console.log('[ObjectsPanel] Focus mode event:', evt);
                this.updateLabel();
            });
        });

        // 4. Also observe body class changes for focus-mode class
        const bodyObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'class') {
                    this.updateLabel();
                    break;
                }
            }
        });
        bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        // 5. Language Change
        window.addEventListener('languageChanged', () => this.updateLabel());

        // 6. App Visibility
        const observer = new MutationObserver(() => this.checkVisibility());
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            observer.observe(appContainer, { attributes: true, attributeFilter: ['style'] });
        }
    }

    checkVisibility() {
        if (!this.container) return;
        const appContainer = document.getElementById('app-container');
        const shareBtn = document.getElementById('share-btn');
        const collaboratorAvatars = document.getElementById('collaborator-avatars');

        const isProjectOpen = appContainer && appContainer.style.display !== 'none';

        if (isProjectOpen) {
            this.container.style.display = 'flex';
            if (shareBtn) shareBtn.style.display = '';
            if (collaboratorAvatars) collaboratorAvatars.style.display = '';
            this.dirtyUpdate(); // Ensure list is populated
        } else {
            this.container.style.display = 'none';
            // Hide share button and collaborator avatars when no project is open
            if (shareBtn) shareBtn.style.display = 'none';
            if (collaboratorAvatars) collaboratorAvatars.style.display = 'none';
        }
    }

    dirtyUpdate() {
        // Debounce updates
        if (this._updateTimer) clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => {
            this.updateList();
            this.updateLabel();
        }, 100);
    }

    toggleDropdown() {
        console.log('[ObjectsPanel] toggleDropdown called, isOpen:', this.isOpen);
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        console.log('[ObjectsPanel] openDropdown called, dropdown exists:', !!this.dropdown);
        if (!this.dropdown) {
            console.error('[ObjectsPanel] dropdown element not found!');
            return;
        }
        this.updateList(); // Refresh list before showing
        this.dropdown.classList.add('show');
        this.isOpen = true;
        const chevron = this.container.querySelector('.t-obj-chevron');
        if (chevron) chevron.className = 'fas fa-chevron-up t-obj-chevron';
        console.log('[ObjectsPanel] Dropdown opened, show class added');
    }

    closeDropdown() {
        console.log('[ObjectsPanel] closeDropdown called');
        if (!this.dropdown) return;
        this.dropdown.classList.remove('show');
        this.isOpen = false;
        const chevron = this.container.querySelector('.t-obj-chevron');
        if (chevron) chevron.className = 'fas fa-chevron-down t-obj-chevron';
    }

    // --- Navigation Logic ---

    getLinearList() {
        // Return cached list if valid and young
        // For now, regenerate to be safe
        const nodes = Array.from(document.querySelectorAll('.node'));
        // Sort by DOM order? Or visual order? DOM order is usually creation order unless moved.
        // Let's stick to DOM order for stability.

        // Filter out hidden/deleted?
        return nodes.filter(n => n.style.display !== 'none');
    }

    navigate(direction) {
        // console.log(`[ObjectsPanel] Navigating direction: ${direction}`);
        const nodeList = this.getLinearList();
        if (nodeList.length === 0) return;

        // Find current
        let currentIndex = -1;

        // Logic:
        // 1. If Focus Mode is active, check focused node
        // 2. Else check selected node
        // 3. Else start at 0

        const isFocusMode = document.body.classList.contains('focus-mode') || document.body.classList.contains('has-focused-node');
        let activeNode = null;

        // Check multiple focus node sources for compatibility
        if (isFocusMode) {
            activeNode = window.focusModeManager?.currentFocusNode
                || window.actionBar?.currentFocusedNode
                || null;
        }

        // Fallback to selected node if not in focus mode or no focus node
        // NOTE: selectedNodes is a Set, not an Array!
        if (!activeNode && window.selectedNodes && window.selectedNodes.size > 0) {
            activeNode = window.selectedNodes.values().next().value;
        }

        if (activeNode) {
            // Robust find: check ID then reference
            currentIndex = nodeList.findIndex(n => n.id === activeNode.id || n === activeNode);
        }

        // If not found (e.g. brand new selection not in list yet, or list filtered), verify list isn't stale
        if (activeNode && currentIndex === -1) {
            console.warn('[ObjectsPanel] Active node not found in linear list. Refreshing list...');
            // Force refresh list
            const freshList = this.getLinearList();
            currentIndex = freshList.findIndex(n => n.id === activeNode.id || n === activeNode);
        }

        // If still -1, ensure we start at 0 or end depending on direction
        if (currentIndex === -1) {
            if (direction > 0) currentIndex = -1; // Next -> 0
            else currentIndex = 0; // Prev -> last
        }

        // Calculate next index
        let nextIndex = currentIndex + direction;

        // Loop functionality
        if (nextIndex < 0) nextIndex = nodeList.length - 1;
        if (nextIndex >= nodeList.length) nextIndex = 0;

        const targetNode = nodeList[nextIndex];

        // Skip if target is same as current
        if (activeNode && targetNode.id === activeNode.id) {
            console.log('[ObjectsPanel] Target is same as current, skipping');
            return;
        }

        console.log('[ObjectsPanel] Navigating to:', targetNode.id, 'from index', currentIndex, 'to', nextIndex);

        // Action
        if (isFocusMode) {
            // CRITICAL: When switching focus in focus mode, we must first EXIT
            // to restore the current node's state, then ENTER with the new node.
            // Use a transition overlay to prevent jarring canvas flash.
            if (window.actionBar) {
                const target = targetNode;

                // Create or get transition overlay
                let transitionOverlay = document.getElementById('focus-transition-overlay');
                if (!transitionOverlay) {
                    transitionOverlay = document.createElement('div');
                    transitionOverlay.id = 'focus-transition-overlay';
                    transitionOverlay.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: var(--ui-bg, #f5f5f5);
                        z-index: 9998;
                        opacity: 0;
                        pointer-events: none;
                        transition: opacity 0.15s ease;
                    `;
                    document.body.appendChild(transitionOverlay);
                }

                // Fade in overlay
                transitionOverlay.style.opacity = '1';

                // After overlay is visible, do the switch
                setTimeout(() => {
                    // Exit current focus mode
                    if (window.actionBar.exitFocusMode) {
                        window.actionBar.exitFocusMode();
                    }

                    // Enter new focus mode
                    setTimeout(() => {
                        if (window.actionBar.enterFocusMode) {
                            window.actionBar.enterFocusMode(target);
                        }

                        // Fade out overlay after new focus is active
                        setTimeout(() => {
                            transitionOverlay.style.opacity = '0';
                        }, 100);
                    }, 50);
                }, 150);
            }
        } else {
            // Select and Pan
            if (window.selectNode) {
                window.clearSelectedNodes();
                window.selectNode(targetNode);
                if (window.viewportManager) window.viewportManager.panToNode(targetNode);
            }
        }
    }


    // --- Label Logic ---

    updateLabel() {
        if (!this.labelEl) return;

        const isFocusMode = document.body.classList.contains('focus-mode') || document.body.classList.contains('has-focused-node');
        const getText = window.getText || ((k) => k);

        // Check for focused node first
        let activeNode = null;
        if (isFocusMode) {
            activeNode = window.focusModeManager?.currentFocusNode
                || window.actionBar?.currentFocusedNode
                || null;
        }

        // If no focus node, check selected node (canvas mode)
        if (!activeNode && window.selectedNodes && window.selectedNodes.size > 0) {
            // Only show single selection
            if (window.selectedNodes.size === 1) {
                activeNode = window.selectedNodes.values().next().value;
            }
        }

        // Show node title if we have an active node
        if (activeNode) {
            this.labelEl.textContent = this.getNodeTitle(activeNode);
            this.labelEl.style.fontWeight = '600';
            this.labelEl.style.color = 'var(--primary-btn-bg)';
        } else {
            // Default "Objects"
            this.labelEl.textContent = getText('objects') || 'Objects';
            this.labelEl.style.fontWeight = '';
            this.labelEl.style.color = '';
        }
    }

    getNodeTitle(node) {
        if (!node) return 'Unknown';

        // Try .node-title
        const titleEl = node.querySelector('.node-title');
        if (titleEl && titleEl.innerText.trim()) return titleEl.innerText.trim();

        // Try data attribute
        if (node.dataset.nodeTitle) return node.dataset.nodeTitle;

        // Try Type Registry
        const type = node.dataset.type;
        if (window.appNodeRegistry) {
            const meta = window.appNodeRegistry.find(m => m.id === type || m.type === type);
            if (meta) {
                const lang = document.documentElement.lang || 'en';
                return (meta.name && meta.name[lang]) ? meta.name[lang] : (meta.name ? meta.name.en : type);
            }
        }

        return 'Untitled Node';
    }


    // --- List Populator (Reused/Simplified logic) ---

    updateList() {
        if (!this.dropdown) return;
        this.dropdown.innerHTML = '';

        const groups = window.groups || [];
        const processedIds = new Set();
        const docFragment = document.createDocumentFragment();

        // Groups
        groups.forEach(group => {
            const groupEl = this.createGroupItem(group);
            docFragment.appendChild(groupEl);

            if (!this.collapsedGroups.has(group.id)) {
                const nodes = this.getNodesInGroup(group);
                nodes.forEach(node => {
                    processedIds.add(node.id);
                    docFragment.appendChild(this.createNodeItem(node, true));
                });
            } else {
                const nodes = this.getNodesInGroup(group);
                nodes.forEach(n => processedIds.add(n.id));
            }
        });

        // Unassigned Nodes
        const allNodes = document.querySelectorAll('.node');
        allNodes.forEach(node => {
            if (!processedIds.has(node.id)) {
                docFragment.appendChild(this.createNodeItem(node, false));
            }
        });

        // Empty state
        if (docFragment.children.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'titlebar-objects-empty';
            empty.style.padding = '12px';
            empty.style.opacity = '0.5';
            empty.style.textAlign = 'center';
            empty.style.fontSize = '12px';
            empty.textContent = 'No objects found';
            docFragment.appendChild(empty);
        }

        this.dropdown.appendChild(docFragment);
        this.highlightInDropdown();
    }

    getNodesInGroup(group) {
        // Assuming groups.js logic or we reverse lookup
        const nodes = [];
        document.querySelectorAll('.node').forEach(node => {
            // Check if node is visually within group rect? Or check internal data?
            // Usually grouping is stored in node data or group data.
            // If window.groupsManager exists, use it. 
            // Falling back to a simple check if we don't have direct access:
            // Let's assume nodes have no explicit group Link in DOM for now unless we know otherwise.
            // But valid `ObjectsPanel` previously had logic: `window.getGroupForNode`.
            if (window.getGroupForNode && window.getGroupForNode(node.id) === group) {
                nodes.push(node);
            }
        });
        return nodes;
    }

    createGroupItem(group) {
        const item = document.createElement('div');
        item.className = 'object-item group-item';
        item.style.paddingLeft = '8px';

        const color = group.color || '#999';

        // Toggle
        const isCollapsed = this.collapsedGroups.has(group.id);
        const toggle = document.createElement('i');
        toggle.className = `fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}`;
        toggle.style.width = '16px';
        toggle.style.textAlign = 'center';
        toggle.style.fontSize = '10px';
        toggle.onclick = (e) => {
            e.stopPropagation();
            if (isCollapsed) this.collapsedGroups.delete(group.id);
            else this.collapsedGroups.add(group.id);
            this.updateList();
        };

        const icon = document.createElement('i');
        icon.className = 'fas fa-object-group item-icon';
        icon.style.color = color;

        const name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = group.name || 'Group';

        item.appendChild(toggle);
        item.appendChild(icon);
        item.appendChild(name);

        // Click to pan to group
        item.onclick = (e) => {
            if (e.target !== toggle) {
                if (window.viewportManager) window.viewportManager.panToGroup(group);
                this.closeDropdown();
            }
        };

        return item;
    }

    createNodeItem(node, isChild) {
        const item = document.createElement('div');
        item.className = 'object-item node-item';
        item.dataset.id = node.id;
        if (isChild) item.style.paddingLeft = '28px'; // Indent

        // Icon
        const img = node.querySelector('img');
        /* 
           If it's an image node, we might want to show the thumbnail. 
           But for consistency with "Objects", maybe an icon is better unless satisfied with thumb.
           Leaving thumb logic if existing specific image node handling is desired, 
           but 'image_node' usually is wrapped. 
           Let's prioritize registry icon if available, but keep image thumb if it's a raw image? 
           Actually, the user wants "Correct icons", so let's stick to Registry/Type icons primarily, 
           unless it IS a pure image element which might be legacy. 
        */

        // Check for registry metadata
        let iconClass = 'fa-cube'; // Default
        const type = node.dataset.type;

        if (window.appNodeRegistry) {
            const meta = window.appNodeRegistry.find(m => m.id === type || m.type === type);
            if (meta && meta.icon) {
                iconClass = meta.icon;
            }
        } else {
            // Fallbacks if registry not loaded yet
            if (type === 'text_node') iconClass = 'fa-font';
            else if (type === 'checklist_node') iconClass = 'fa-list-ul';
            else if (type === 'url_node' || type === 'webview_node') iconClass = 'fa-globe';
            else if (type === 'timer_node') iconClass = 'fa-clock';
        }

        const icon = document.createElement('i');
        icon.className = `fas ${iconClass} item-icon`;

        // Apply Color
        if (node.dataset.color) {
            icon.style.color = node.dataset.color;
        } else {
            // Default gray or inherit
            icon.style.color = '#888';
        }

        item.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = this.getNodeTitle(node);

        item.appendChild(name);

        item.onclick = (e) => {
            e.stopPropagation();
            this.handleNodeClick(node);
            this.closeDropdown();
        };

        return item;
    }

    handleNodeClick(node) {
        const isFocusMode = document.body.classList.contains('focus-mode');

        if (isFocusMode) {
            if (window.focusModeManager) window.focusModeManager.enterFocusMode(node);
        } else {
            if (window.selectNode) {
                window.clearSelectedNodes();
                window.selectNode(node);
                if (window.viewportManager) window.viewportManager.panToNode(node);
            }
        }
    }

    highlightInDropdown() {
        if (!this.dropdown) return;

        // clear
        this.dropdown.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        this.dropdown.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));

        // Highlight Selected
        if (window.selectedNodes) {
            window.selectedNodes.forEach(n => {
                const el = this.dropdown.querySelector(`.node-item[data-id="${n.id}"]`);
                if (el) el.classList.add('selected');
            });
        }

        // Highlight Focused (if different)
        const isFocusMode = document.body.classList.contains('focus-mode');
        if (isFocusMode && window.focusModeManager?.currentFocusNode) {
            const el = this.dropdown.querySelector(`.node-item[data-id="${window.focusModeManager.currentFocusNode.id}"]`);
            if (el) el.classList.add('focused');
        }
    }
}

// Instantiate
window.objectsPanel = new ObjectsPanel();
