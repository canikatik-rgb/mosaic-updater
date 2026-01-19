/**
 * Command Palette (Spotlight Search)
 * Handles node creation and navigation via the titlebar search interface.
 * Now integrated with the titlebar search bar - appears as dropdown below it.
 * 
 * Features:
 * - URL detection: typing .com/.net etc. creates a URL node
 * - Dashboard auto-project: creating node from dashboard creates new project
 * - Search nodes by name and content
 */
class CommandPalette {
    constructor() {
        this.isVisible = false;
        this.resultsContainer = null;
        this.selectedIndex = 0;
        this.results = [];
        this.nodeTypes = [];
        this.searchResults = [];
        this.currentResultIndex = 0;
        this.navBar = null;
        this.titlebarInput = null;
        this.titlebarSearch = null;

        // URL detection regex
        this.urlPattern = /^(https?:\/\/)?[\w.-]+\.(com|net|org|io|dev|co|me|app|xyz|info|biz|tv|edu|gov|mil|ai|tr|uk|de|fr|es|it|ru|cn|jp|in|br|au|nl|pl|ch|at|be|se|no|dk|fi)(\.[a-z]{2,3})?(\/\S*)?$/i;

        this.init();
    }

    init() {
        this.nodeTypes = [
            { type: 'default', label: getText('cpTextNode'), icon: 'fa-font', description: getText('cpTextNodeDesc') },
            { type: 'checklist', label: getText('cpChecklist'), icon: 'fa-list-ul', description: getText('cpChecklistDesc') },
            { type: 'timer', label: getText('cpTimer'), icon: 'fa-clock', description: getText('cpTimerDesc') },
        ];

        this.createUI();
        this.setupEvents();
    }

    createUI() {
        this.titlebarSearch = document.getElementById('titlebar-search');
        this.titlebarInput = document.getElementById('titlebar-search-input');

        if (!this.titlebarSearch || !this.titlebarInput) {
            console.warn('[CommandPalette] Titlebar search not found, waiting for DOM');
            setTimeout(() => this.createUI(), 100);
            return;
        }

        this.resultsContainer = document.createElement('div');
        this.resultsContainer.id = 'command-palette-results';
        this.resultsContainer.className = 'cp-results-dropdown';
        this.resultsContainer.style.display = 'none';

        this.titlebarSearch.parentNode.insertBefore(this.resultsContainer, this.titlebarSearch.nextSibling);

        console.log('[CommandPalette] UI created - integrated with titlebar search');
    }

    setupEvents() {
        if (!this.titlebarInput) {
            setTimeout(() => this.setupEvents(), 100);
            return;
        }

        this.titlebarInput.addEventListener('input', () => this.handleInput());
        this.titlebarInput.addEventListener('keydown', (e) => this.handleKeydown(e));

        this.titlebarInput.addEventListener('focus', () => {
            setTimeout(() => {
                if (document.activeElement === this.titlebarInput) {
                    this.show();
                }
            }, 50);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && this.navBar && this.navBar.style.display !== 'none') {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) {
                    this.navigateToPrevious();
                } else {
                    this.navigateToNext();
                }
                return;
            }

            if (e.shiftKey && e.key.toLowerCase() === 'a') {
                if (document.activeElement === document.body ||
                    document.activeElement === this.titlebarInput) {
                    e.preventDefault();
                    this.toggle();
                }
            }
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
                this.titlebarInput.blur();
            }
        }, true);

        document.addEventListener('click', (e) => {
            if (this.isVisible &&
                !e.target.closest('#titlebar-search') &&
                !e.target.closest('#command-palette-results') &&
                !e.target.closest('#search-nav-bar')) {
                this.hide();
            }

            if (!e.target.closest('#command-palette-results') &&
                !e.target.closest('#search-nav-bar') &&
                !e.target.closest('.node.selected')) {
                this.clearAllHighlights();
                this.hideNavigationBar();
            }
        });

        window.addEventListener('registryLoaded', () => {
            console.log('[CommandPalette] Registry loaded, ready to refresh.');
        });
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        if (!this.titlebarInput || !this.resultsContainer) return;

        this.isVisible = true;
        this.resultsContainer.style.display = 'block';
        this.titlebarInput.focus();
        this.handleInput();
    }

    hide() {
        this.isVisible = false;
        if (this.resultsContainer) {
            this.resultsContainer.style.display = 'none';
        }
    }

    /**
     * Check if dashboard is visible (not canvas mode)
     */
    isDashboardVisible() {
        const dashboard = document.getElementById('dashboard-view');
        return dashboard && !dashboard.classList.contains('hidden');
    }

    /**
     * Ensure we're in canvas mode, creating new project if needed
     */
    ensureCanvasMode() {
        if (this.isDashboardVisible()) {
            console.log('[CommandPalette] Dashboard visible, creating new project first');
            if (window.dashboardManager) {
                window.dashboardManager.createNewProject();
            } else if (window.createNewProject) {
                window.createNewProject('Untitled');
            }

            // Poll until canvas is ready
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 50; // 5 seconds max

                const checkReady = () => {
                    attempts++;
                    const canvas = document.getElementById('canvas');
                    const wrapper = document.getElementById('canvas-wrapper');
                    const wrapperVisible = wrapper && wrapper.style.display !== 'none';
                    const nodeLoaderReady = window.nodeLoader && typeof window.nodeLoader.createNode === 'function';

                    if (canvas && wrapperVisible && nodeLoaderReady) {
                        console.log('[CommandPalette] Canvas ready after', attempts * 100, 'ms');
                        setTimeout(resolve, 50); // Small buffer for final setup
                    } else if (attempts >= maxAttempts) {
                        console.warn('[CommandPalette] Canvas not ready after timeout, proceeding anyway');
                        resolve();
                    } else {
                        setTimeout(checkReady, 100);
                    }
                };

                setTimeout(checkReady, 100);
            });
        }
        return Promise.resolve();
    }

    /**
     * Check if input looks like a URL
     */
    isUrl(text) {
        return this.urlPattern.test(text.trim());
    }

    /**
     * Normalize URL (add https:// if missing)
     */
    normalizeUrl(text) {
        let url = text.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        return url;
    }

    handleInput() {
        if (!this.titlebarInput) return;

        const query = this.titlebarInput.value.toLowerCase().trim();
        const rawQuery = this.titlebarInput.value.trim();
        this.results = [];

        // Check if query is a URL - add URL node creation option
        if (rawQuery && this.isUrl(rawQuery)) {
            const normalizedUrl = this.normalizeUrl(rawQuery);
            this.results.push({
                category: getText('cpOpenUrl') || 'Open URL',
                label: normalizedUrl,
                icon: 'fa-globe',
                description: getText('cpCreateUrlNode') || 'Create URL Node and visit this site',
                action: async () => {
                    await this.ensureCanvasMode();
                    const center = this.getViewportCenter();
                    const newNode = window.nodeLoader.createNode('url_node', center.x, center.y, { content: normalizedUrl });

                    // Auto-Title Logic
                    if (newNode) {
                        const pollForWebview = () => {
                            // URL Node uses Shadow DOM for structure
                            // The structure is: newNode -> .content -> .node-iframe (host) -> #shadow-root -> .node-content-wrapper -> webview

                            // 1. Try finding .node-iframe (Shadow Host)
                            const host = newNode.querySelector('.node-iframe');
                            if (host && host.shadowRoot) {
                                const webview = host.shadowRoot.querySelector('webview');
                                if (webview) {
                                    console.log('[CommandPalette] Found webview in Shadow DOM, attaching listener');

                                    const titleHandler = (e) => {
                                        if (e.title) {
                                            console.log('[CommandPalette] Raw Webview title:', e.title);

                                            // Smart Title Cleaning: Prefer readable "Site Name"
                                            let cleanTitle = e.title;

                                            // Only process if the title is reasonably long
                                            if (cleanTitle.length > 20) {
                                                const parts = cleanTitle.split(/[:|—-]|\s\/\/\s/);
                                                try {
                                                    const urlObj = new URL(normalizedUrl);
                                                    const hostname = urlObj.hostname.replace('www.', '').split('.')[0];

                                                    // 1. Try to find a part that matches the domain name provided in URL
                                                    const brandPart = parts.find(p => p.toLowerCase().trim() === hostname.toLowerCase());

                                                    if (brandPart) {
                                                        cleanTitle = brandPart.trim();
                                                    } else {
                                                        // 2. If title is extremely long (>50), just use Capitalized Hostname
                                                        if (cleanTitle.length > 50) {
                                                            cleanTitle = hostname.charAt(0).toUpperCase() + hostname.slice(1);
                                                        } else {
                                                            // 3. Otherwise take the first part (often the most relevant page name)
                                                            cleanTitle = parts[0].trim();
                                                        }
                                                    }
                                                } catch (err) {
                                                    // Fallback
                                                    cleanTitle = parts[0].trim();
                                                }
                                            }

                                            console.log('[CommandPalette] setCleanTitle:', cleanTitle);

                                            const titleEl = newNode.querySelector('.node-title');
                                            if (titleEl) titleEl.innerText = cleanTitle;
                                            newNode.dataset.nodeTitle = cleanTitle;

                                            // Trigger save
                                            if (window.scheduleAutoSave) window.scheduleAutoSave();

                                            // One-shot
                                            webview.removeEventListener('page-title-updated', titleHandler);
                                        }
                                    };
                                    webview.addEventListener('page-title-updated', titleHandler);

                                    // --- Context Menu & Zoom Support ---
                                    webview.addEventListener('contextmenu', (e) => {
                                        // Trigger native menu in Main process
                                        window.ipcRenderer.send('show-context-menu');
                                    });

                                    // Handle commands from Context Menu
                                    // We assign a unique listener for this node instantiation
                                    const contextMenuHandler = (event, command) => {
                                        // Only act if this node is currently focused or being interacted with
                                        const isFocused = newNode.classList.contains('selected') ||
                                            newNode.matches(':focus-within') ||
                                            (document.activeElement && newNode.contains(document.activeElement));

                                        if (isFocused) {
                                            if (command === 'back' && webview.canGoBack()) webview.goBack();
                                            if (command === 'forward' && webview.canGoForward()) webview.goForward();
                                            if (command === 'reload') webview.reload();
                                            if (command === 'inspect') webview.openDevTools();
                                        }
                                    };
                                    // Only register IPC handler if ipcRenderer is available
                                    if (window.ipcRenderer && typeof window.ipcRenderer.on === 'function') {
                                        window.ipcRenderer.on('context-menu-command', contextMenuHandler);
                                    }

                                    // Enable plugins/zoom if needed (Electron usually handles pinch-zoom if enabled in webPreferences)
                                    // webview.setZoomFactor(1.0);
                                    return true; // Found
                                }
                            }

                            // 2. Fallback for non-shadow or iframe modes
                            const iframe = newNode.querySelector('iframe');
                            if (iframe) {
                                iframe.onload = () => {
                                    try {
                                        const title = iframe.contentDocument.title;
                                        if (title) {
                                            const titleEl = newNode.querySelector('.node-title');
                                            if (titleEl) titleEl.innerText = title;
                                            newNode.dataset.nodeTitle = title;
                                            if (window.scheduleAutoSave) window.scheduleAutoSave();
                                        }
                                    } catch (e) { }
                                };
                                return true;
                            }

                            return false; // Not found yet
                        };

                        // Poll for a few seconds
                        let attempts = 0;
                        const maxAttempts = 20; // 2 seconds
                        const interval = setInterval(() => {
                            if (pollForWebview() || attempts > maxAttempts) {
                                clearInterval(interval);
                            }
                            attempts++;
                        }, 100);
                    }

                    // If in focus mode, switch focus to new node
                    this.switchFocusToNode(newNode);
                }
            });
        }

        // Dynamically build list from Registry
        const registry = window.appNodeRegistry || [];
        const lang = window.currentLanguage || 'en';

        const nodeTypes = registry.map(item => {
            const label = item.name ? (item.name[lang] || item.name['en'] || Object.values(item.name)[0]) : item.id;
            const desc = item.description ? (item.description[lang] || item.description['en'] || '') : '';

            return {
                type: item.id || item.type,
                label: label,
                icon: item.icon || 'fa-cube',
                description: desc,
                isV2: true,
                tags: item.tags || []
            };
        });

        // 1. Node Types (Always show if query matches or empty)
        nodeTypes.forEach(type => {
            // Match label, type id, or tags
            const matches = query === '' ||
                type.label.toLowerCase().includes(query) ||
                type.type.toLowerCase().includes(query) ||
                (type.tags && type.tags.some(tag => tag.toLowerCase().includes(query)));

            if (matches) {
                this.results.push({
                    category: getText('cpCreateNew'),
                    ...type,
                    action: async () => {
                        await this.ensureCanvasMode();
                        const center = this.getViewportCenter();
                        let newNode;
                        if (type.isV2) {
                            newNode = window.nodeLoader.createNode(type.type, center.x, center.y);
                        } else {
                            newNode = this.createNode(type.type);
                        }

                        // If in focus mode, switch focus to new node
                        this.switchFocusToNode(newNode);
                    }
                });
            }
        });

        // 2. Existing Nodes (Search by title AND content)
        if (query !== '' && !this.isDashboardVisible()) {
            const nodes = document.querySelectorAll('.node');
            nodes.forEach(node => {
                // Get node title
                let nodeTitle = '';
                const titleEl = node.querySelector('.node-title');
                if (titleEl) {
                    nodeTitle = titleEl.innerText || '';
                }

                // Get node content
                let content = '';
                if (node.classList.contains('app-node')) {
                    if (node.dataset.savedState) {
                        try {
                            const data = JSON.parse(node.dataset.savedState);
                            content = data.content || data.text || data.value || '';
                            // For text nodes, content might be in 'content' field
                            if (typeof content === 'object') {
                                content = JSON.stringify(content);
                            }
                        } catch (e) {
                            console.warn('Failed to parse saved state for search', e);
                        }
                    }
                    if (!content && window.nodeSystem && window.nodeSystem.getNodeData) {
                        const nodeData = window.nodeSystem.getNodeData(node.id);
                        if (nodeData && nodeData.value) {
                            content = typeof nodeData.value === 'string' ? nodeData.value : JSON.stringify(nodeData.value);
                        }
                    }
                } else {
                    // Legacy node
                    const contentEl = node.querySelector('.content');
                    content = contentEl ? (contentEl.innerText || contentEl.textContent || '') : (node.innerText || '');
                }

                // Check if title or content matches
                const lowerTitle = nodeTitle.toLowerCase();
                const lowerContent = content.toLowerCase();

                if (lowerTitle.includes(query) || lowerContent.includes(query)) {
                    // Create a meaningful label
                    let label = nodeTitle || 'Untitled Node';
                    let snippet = '';

                    if (lowerContent.includes(query) && content.length > 0) {
                        // Find the match position and show context
                        const matchIndex = lowerContent.indexOf(query);
                        const start = Math.max(0, matchIndex - 20);
                        const end = Math.min(content.length, matchIndex + query.length + 30);
                        snippet = (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '');
                    }

                    this.results.push({
                        category: getText('cpGoToNode') || 'Go to Node',
                        label: label,
                        icon: 'fa-location-arrow',
                        description: snippet || (getText('cpJumpToNode') || 'Jump to this node'),
                        action: () => this.jumpToNode(node)
                    });
                }
            });

            // 3. Groups (Search group names)
            if (window.groups && window.groups.size > 0) {
                window.groups.forEach((group, groupId) => {
                    const groupName = group.name.toLowerCase();
                    if (groupName.includes(query)) {
                        this.results.push({
                            category: getText('cpGoToGroup') || 'Go to Group',
                            label: group.name,
                            icon: 'fa-object-group',
                            description: `${group.nodeIds.length} ${getText('cpNodes') || 'nodes'}`,
                            action: () => this.jumpToGroup(group)
                        });
                    }
                });
            }
        }

        this.renderResults();
    }

    renderResults() {
        if (!this.resultsContainer) return;

        this.resultsContainer.innerHTML = '';
        this.selectedIndex = 0;

        if (this.results.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'cp-no-results';
            noResults.textContent = getText('cpNoResults') || 'No results found';
            this.resultsContainer.appendChild(noResults);
            return;
        }

        let currentCategory = null;

        this.results.forEach((result, index) => {
            if (result.category !== currentCategory) {
                const header = document.createElement('div');
                header.className = 'cp-category-header';
                header.textContent = result.category;
                this.resultsContainer.appendChild(header);
                currentCategory = result.category;
            }

            const item = document.createElement('div');
            item.className = 'cp-result-item';
            if (index === 0) item.classList.add('selected');

            item.innerHTML = `
                <div class="cp-item-icon"><i class="fas ${result.icon}"></i></div>
                <div class="cp-item-details">
                    <div class="cp-item-label">${result.label}</div>
                    <div class="cp-item-desc">${result.description}</div>
                </div>
            `;

            item.addEventListener('click', async () => {
                try {
                    await result.action();
                } catch (err) {
                    console.error('Error executing command:', err);
                }
                this.hide();
                this.titlebarInput.value = '';
                this.titlebarInput.blur();
            });

            item.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            this.resultsContainer.appendChild(item);
        });
    }

    handleKeydown(e) {
        if (!this.isVisible) return;
        if (this.results.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % this.results.length;
            this.updateSelection();
            this.scrollToSelected();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex - 1 + this.results.length) % this.results.length;
            this.updateSelection();
            this.scrollToSelected();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % this.results.length;
            this.updateSelection();
            this.scrollToSelected();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.results[this.selectedIndex]) {
                this.results[this.selectedIndex].action();
                this.hide();
                this.titlebarInput.value = '';
                this.titlebarInput.blur();
            }
        }
    }

    updateSelection() {
        const items = this.resultsContainer.querySelectorAll('.cp-result-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    scrollToSelected() {
        const selected = this.resultsContainer.querySelector('.cp-result-item.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }

    createNode(type) {
        if (window.createNode) {
            const center = this.getViewportCenter();
            const newNode = window.createNode(center.x, center.y, null, type);

            if (newNode) {
                if (window.clearSelectedNodes) window.clearSelectedNodes();
                if (window.selectNode) window.selectNode(newNode);

                if (window.viewportManager && window.viewportManager.panToNode) {
                    window.viewportManager.panToNode(newNode, true);
                }
            }

            return newNode;
        }
        return null;
    }

    /**
     * Switch focus to a newly created node if currently in focus mode
     */
    switchFocusToNode(newNode) {
        if (!newNode) return;

        // Check if we're in focus mode
        const overlay = document.getElementById('focus-overlay');
        const isInFocusMode = overlay && overlay.classList.contains('active');

        if (isInFocusMode && window.actionBar) {
            console.log('[CommandPalette] Switching focus to new node:', newNode.id);

            // Exit current focus mode
            if (window.actionBar.exitFocusMode) {
                window.actionBar.exitFocusMode();
            }

            // Select the new node
            if (window.selectNode) window.selectNode(newNode);

            // Enter focus mode with new node after a short delay
            setTimeout(() => {
                if (window.actionBar.enterFocusMode) {
                    window.actionBar.enterFocusMode(newNode);
                    window.actionBar.render();
                }
            }, 100);
        } else {
            // Not in focus mode, just select and pan to the new node
            if (window.clearSelectedNodes) window.clearSelectedNodes();
            if (window.selectNode) window.selectNode(newNode);

            if (window.viewportManager && window.viewportManager.panToNode) {
                window.viewportManager.panToNode(newNode, true);
            }
        }
    }

    jumpToNode(node) {
        console.log('[CommandPalette] jumpToNode called', { node, viewportManager: window.viewportManager });

        const query = this.titlebarInput ? this.titlebarInput.value.toLowerCase().trim() : '';

        // Check if we're in focus mode
        const overlay = document.getElementById('focus-overlay');
        const isInFocusMode = overlay && overlay.classList.contains('active');

        if (query) {
            this.searchResults = [];
            const allNodes = document.querySelectorAll('.node');
            allNodes.forEach(n => {
                // Check title
                const titleEl = n.querySelector('.node-title');
                const title = titleEl ? titleEl.innerText.toLowerCase() : '';

                // Check content
                const contentEl = n.querySelector('.content');
                const content = contentEl ? contentEl.innerText.toLowerCase() : n.innerText.toLowerCase();

                if (title.includes(query) || content.includes(query)) {
                    this.searchResults.push(n);
                }
            });

            this.currentResultIndex = this.searchResults.indexOf(node);

            if (this.searchResults.length > 1) {
                this.showNavigationBar(query);
            } else {
                this.hideNavigationBar();
            }
        }

        if (window.clearSelectedNodes) window.clearSelectedNodes();
        if (window.selectNode) window.selectNode(node);

        if (query) {
            this.highlightSearchTerm(node, query);
        }

        // If in focus mode, switch to the new node in focus mode
        if (isInFocusMode && window.actionBar) {
            // Exit current focus mode and enter with new node
            window.actionBar.exitFocusMode();
            window.actionBar.render();

            // Small delay to let the exit complete
            setTimeout(() => {
                if (window.actionBar.enterFocusMode) {
                    window.actionBar.enterFocusMode(node);
                    window.actionBar.render();
                }
            }, 100);
            return;
        }

        if (window.viewportManager && window.viewportManager.panToNode) {
            console.log('[CommandPalette] Calling viewportManager.panToNode');
            window.viewportManager.panToNode(node, true);
        } else {
            console.log('[CommandPalette] No viewportManager, using fallback', node);
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    highlightSearchTerm(node, query) {
        this.clearHighlights(node);

        const walker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let currentNode;
        while (currentNode = walker.nextNode()) {
            textNodes.push(currentNode);
        }

        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const lowerText = text.toLowerCase();
            const index = lowerText.indexOf(query);

            if (index !== -1) {
                const beforeText = text.substring(0, index);
                const matchText = text.substring(index, index + query.length);
                const afterText = text.substring(index + query.length);

                const fragment = document.createDocumentFragment();

                if (beforeText) fragment.appendChild(document.createTextNode(beforeText));

                const highlight = document.createElement('mark');
                highlight.className = 'search-highlight';
                highlight.style.backgroundColor = '#ffeb3b';
                highlight.style.color = '#000';
                highlight.style.padding = '2px 4px';
                highlight.style.borderRadius = '3px';
                highlight.textContent = matchText;
                fragment.appendChild(highlight);

                if (afterText) fragment.appendChild(document.createTextNode(afterText));

                textNode.parentNode.replaceChild(fragment, textNode);
            }
        });

        node.dataset.hasHighlight = 'true';
    }

    clearHighlights(node) {
        const highlights = node.querySelectorAll('.search-highlight');
        highlights.forEach(highlight => {
            const text = highlight.textContent;
            highlight.replaceWith(document.createTextNode(text));
        });
        delete node.dataset.hasHighlight;
    }

    jumpToGroup(group) {
        console.log('[CommandPalette] jumpToGroup called', { group, viewportManager: window.viewportManager });

        if (window.selectGroup) window.selectGroup(group);

        const labelX = group.bounds.x + 20;
        const labelY = group.bounds.y + 20;

        console.log('[CommandPalette] Group label position:', { labelX, labelY });

        if (window.viewportManager && window.viewportManager.panToPosition) {
            console.log('[CommandPalette] Calling viewportManager.panToPosition');
            window.viewportManager.panToPosition(labelX, labelY, true);
        } else {
            console.log('[CommandPalette] No viewportManager.panToPosition, using fallback');
            const canvasWrapper = document.getElementById('canvas-wrapper');
            if (canvasWrapper) {
                const targetOffsetX = canvasWrapper.clientWidth / 2 - labelX * window.canvasScale;
                const targetOffsetY = canvasWrapper.clientHeight / 2 - labelY * window.canvasScale;

                window.canvasOffset.x = targetOffsetX;
                window.canvasOffset.y = targetOffsetY;
                if (window.updateCanvasTransform) {
                    window.updateCanvasTransform();
                }
            }
        }
    }

    getViewportCenter() {
        const canvas = document.getElementById('canvas');
        if (!canvas) return { x: 100, y: 100 };

        const offsetX = window.canvasOffset ? window.canvasOffset.x : 0;
        const offsetY = window.canvasOffset ? window.canvasOffset.y : 0;
        const scale = window.canvasScale || 1;

        const centerX = (window.innerWidth / 2 - offsetX) / scale;
        const centerY = (window.innerHeight / 2 - offsetY) / scale;

        return { x: centerX, y: centerY };
    }

    showNavigationBar(query) {
        if (!this.navBar) {
            this.createNavigationBar();
        }

        const navCount = this.navBar.querySelector('.nav-count');
        if (navCount) {
            navCount.textContent = `${this.currentResultIndex + 1} / ${this.searchResults.length}`;
        }

        this.navBar.style.display = 'flex';
    }

    hideNavigationBar() {
        if (this.navBar) {
            this.navBar.style.display = 'none';
        }
    }

    createNavigationBar() {
        this.navBar = document.createElement('div');
        this.navBar.id = 'search-nav-bar';
        this.navBar.style.position = 'fixed';
        this.navBar.style.bottom = '80px';
        this.navBar.style.left = '50%';
        this.navBar.style.transform = 'translateX(-50%)';
        this.navBar.style.display = 'none';
        this.navBar.style.flexDirection = 'row';
        this.navBar.style.alignItems = 'center';
        this.navBar.style.gap = '10px';
        this.navBar.style.padding = '10px 20px';
        this.navBar.style.backgroundColor = 'var(--node-bg)';
        this.navBar.style.border = '1px solid var(--border-color)';
        this.navBar.style.borderRadius = '8px';
        this.navBar.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        this.navBar.style.zIndex = '2000';

        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        prevBtn.style.background = 'transparent';
        prevBtn.style.border = 'none';
        prevBtn.style.cursor = 'pointer';
        prevBtn.style.fontSize = '16px';
        prevBtn.style.color = 'var(--text-color)';
        prevBtn.style.padding = '5px 10px';
        prevBtn.addEventListener('click', () => this.navigateToPrevious());

        const countDisplay = document.createElement('span');
        countDisplay.className = 'nav-count';
        countDisplay.style.fontSize = '14px';
        countDisplay.style.color = 'var(--text-color)';
        countDisplay.style.minWidth = '60px';
        countDisplay.style.textAlign = 'center';
        countDisplay.textContent = '1 / 1';

        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
        nextBtn.style.background = 'transparent';
        nextBtn.style.border = 'none';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.fontSize = '16px';
        nextBtn.style.color = 'var(--text-color)';
        nextBtn.style.padding = '5px 10px';
        nextBtn.addEventListener('click', () => this.navigateToNext());

        this.navBar.appendChild(prevBtn);
        this.navBar.appendChild(countDisplay);
        this.navBar.appendChild(nextBtn);

        document.body.appendChild(this.navBar);
    }

    navigateToPrevious() {
        if (this.searchResults.length === 0) return;

        this.currentResultIndex = (this.currentResultIndex - 1 + this.searchResults.length) % this.searchResults.length;
        const node = this.searchResults[this.currentResultIndex];

        const navCount = this.navBar.querySelector('.nav-count');
        if (navCount) {
            navCount.textContent = `${this.currentResultIndex + 1} / ${this.searchResults.length}`;
        }

        if (window.clearSelectedNodes) window.clearSelectedNodes();
        if (window.selectNode) window.selectNode(node);

        const query = this.titlebarInput ? this.titlebarInput.value.toLowerCase().trim() : '';
        if (query) {
            this.highlightSearchTerm(node, query);
        }

        if (window.viewportManager && window.viewportManager.panToNode) {
            window.viewportManager.panToNode(node, true);
        }
    }

    navigateToNext() {
        if (this.searchResults.length === 0) return;

        this.currentResultIndex = (this.currentResultIndex + 1) % this.searchResults.length;
        const node = this.searchResults[this.currentResultIndex];

        const navCount = this.navBar.querySelector('.nav-count');
        if (navCount) {
            navCount.textContent = `${this.currentResultIndex + 1} / ${this.searchResults.length}`;
        }

        if (window.clearSelectedNodes) window.clearSelectedNodes();
        if (window.selectNode) window.selectNode(node);

        const query = this.titlebarInput ? this.titlebarInput.value.toLowerCase().trim() : '';
        if (query) {
            this.highlightSearchTerm(node, query);
        }

        if (window.viewportManager && window.viewportManager.panToNode) {
            window.viewportManager.panToNode(node, true);
        }
    }

    clearAllHighlights() {
        const allNodes = document.querySelectorAll('.node[data-has-highlight]');
        allNodes.forEach(node => {
            this.clearHighlights(node);
        });
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.commandPalette = new CommandPalette();
});
