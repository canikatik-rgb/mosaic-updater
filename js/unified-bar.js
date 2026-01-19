/**
 * Unified Bottom Bar
 * Consolidates Sync Status, Undo/Redo, Objects, Menu, and User Profile
 */

class UnifiedBar {
    constructor() {
        this.element = null;
        this.syncIndicator = null;
        this.objectsPopup = null;
        this.menuPopup = null;
        this.init();
    }

    init() {
        this.createBar();
        this.setupEventListeners();
        // Initial sync status - hide until actual save happens
        this.updateSyncStatus('idle');

        // Listen to save events
        this.setupSyncListeners();

        // Auto-cleanup legacy UI elements
        this.cleanupLegacyUI();
        // Run cleanup periodically in case elements are re-injected
        setInterval(() => this.cleanupLegacyUI(), 2000);

        // Listen for project open events - create minimap when a project is opened
        this.setupMinimapListeners();

        console.log('[UnifiedBar] Initialized');
    }

    setupMinimapListeners() {
        // Listen for dashboard hide (means project is being opened)
        window.addEventListener('dashboardHidden', () => {
            console.log('[Minimap] Dashboard hidden, creating minimap...');
            // Small delay to ensure DOM is ready
            setTimeout(() => this.createMinimap(), 500);
        });

        // Also listen for project switch
        window.addEventListener('projectSwitched', () => {
            console.log('[Minimap] Project switched, updating minimap...');
            this.updateMinimap();
        });

        // Start update interval once minimap exists
        // Faster updates for smoother minimap
        setInterval(() => {
            if (document.getElementById('canvas-minimap')) {
                this.updateMinimap();
            }
        }, 100);
    }

    cleanupLegacyUI() {
        // 1. Objects Panel Toggle
        const objToggle = document.querySelector('.objects-toggle-btn');
        if (objToggle) objToggle.style.display = 'none';

        const objContainer = document.querySelector('.objects-panel-container');
        if (objContainer) objContainer.style.display = 'none'; // Ensure container is hidden too

        // 2. Legacy Undo/Redo Buttons (Find by icon class or title)
        const buttons = document.querySelectorAll('button, .action-btn, div[role="button"]');
        buttons.forEach(btn => {
            // Don't hide our own buttons
            if (this.element.contains(btn) || this.menuPopup.contains(btn) || this.objectsPopup.contains(btn)) return;

            const html = btn.innerHTML;
            const title = btn.getAttribute('title') || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';

            if (html.includes('fa-undo') || title.includes('Undo') || ariaLabel.includes('Undo') ||
                html.includes('fa-redo') || title.includes('Redo') || ariaLabel.includes('Redo')) {
                btn.style.display = 'none';
            }
        });

        // 3. Remove "Saved" and "User" from Old Action Bar (if they exist)
        const oldActionBar = document.getElementById('action-bar');
        if (oldActionBar) {
            Array.from(oldActionBar.children).forEach(child => {
                const text = child.textContent.toLowerCase();
                if (text.includes('saved') || text.includes('saving') ||
                    child.querySelector('.fa-check-circle') ||
                    child.classList.contains('user-profile') ||
                    child.querySelector('.user-avatar')) {
                    child.style.display = 'none';
                }
            });
        }

    }

    createBar() {
        // Remove old menu button if exists
        const oldMenuBtn = document.getElementById('menu-button');
        if (oldMenuBtn) oldMenuBtn.style.display = 'none';

        const oldDropdown = document.getElementById('dropdown-menu');
        if (oldDropdown) oldDropdown.style.display = 'none';

        // Create unified bar
        this.element = document.createElement('div');
        this.element.id = 'unified-bar';
        this.element.className = 'unified-bar';
        this.element.innerHTML = `
            <div class="ub-section ub-left">
                <div class="ub-sync" id="ub-sync" title="Sync Status">
                    <i class="fas fa-check-circle"></i>
                    <span>Saved</span>
                </div>
            </div>
            <div class="ub-section ub-center">
                <button class="ub-btn" id="ub-undo" title="Undo (Cmd+Z)">
                    <i class="fas fa-undo"></i>
                </button>
                <button class="ub-btn" id="ub-redo" title="Redo (Cmd+Shift+Z)">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
            <div class="ub-section ub-right">
                <button class="ub-btn ub-menu-btn" id="ub-menu" title="Menu">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
                <div class="ub-user" id="ub-user" title="Profile">
                    <span class="ub-avatar">M</span>
                </div>
        `;

        // Create menu popup with localized text
        const getText = window.getText || ((key) => key);
        this.menuPopup = document.createElement('div');

        this.menuPopup.id = 'ub-menu-popup';
        this.menuPopup.className = 'ub-popup';
        this.menuPopup.innerHTML = `
            <button class="ub-popup-item" data-action="new">
                <i class="fas fa-plus"></i> ${getText('newMosaic') || 'New Mosaic'}
            </button>
            <button class="ub-popup-item" data-action="save">
                <i class="fas fa-save"></i> ${getText('saveProject') || 'Save Project'}
            </button>
            <button class="ub-popup-item" data-action="open">
                <i class="fas fa-folder-open"></i> ${getText('openProject') || 'Open Project'}
            </button>
            <div class="ub-popup-divider"></div>
            <button class="ub-popup-item" data-action="export-image">
                <i class="fas fa-image"></i> ${getText('exportImage') || 'Export as Image'}
            </button>
            <button class="ub-popup-item" data-action="export-pdf">
                <i class="fas fa-file-pdf"></i> ${getText('exportPDF') || 'Export as PDF'}
            </button>
            <div class="ub-popup-divider"></div>
            <button class="ub-popup-item" data-action="reset-view">
                <i class="fas fa-compress-arrows-alt"></i> ${getText('resetView') || 'Reset View'}
            </button>
            <button class="ub-popup-item" data-action="save-template">
                <i class="fas fa-bookmark"></i> ${getText('saveAsTemplate') || 'Save as Template'}
            </button>
        `;

        // Create objects popup
        this.objectsPopup = document.createElement('div');
        this.objectsPopup.id = 'ub-objects-popup';
        this.objectsPopup.className = 'ub-popup ub-objects-popup';
        this.objectsPopup.innerHTML = `
            <div class="ub-popup-header">${getText('objects') || 'Objects'}</div>
            <div class="ub-objects-list" id="ub-objects-list">
                <div class="ub-objects-empty">${getText('noObjects') || 'No objects'}</div>
            </div>
        `;

        // Create settings popup card
        this.settingsPopup = document.createElement('div');
        this.settingsPopup.id = 'ub-settings-popup';
        this.settingsPopup.className = 'ub-popup ub-settings-popup';
        this.settingsPopup.innerHTML = `
            <div class="ub-settings-user">
                <div class="ub-settings-avatar-wrapper">
                    <div class="ub-settings-avatar" id="ub-settings-avatar">M</div>
                    <span id="ub-status-dot" class="ub-status-dot offline"></span>
                </div>
                <div class="ub-settings-info">
                    <div class="ub-settings-name" id="ub-settings-name">Mosaic User</div>
                    <div class="ub-settings-email" id="ub-settings-email">Not signed in</div>
                </div>
            </div>
            <div class="ub-popup-divider"></div>
            <button class="ub-popup-item" data-settings-action="account">
                <i class="fas fa-user-cog"></i> Account Settings
            </button>
            <button class="ub-popup-item" data-settings-action="dashboard">
                <i class="fas fa-home"></i> Dashboard
            </button>
            <div class="ub-popup-divider"></div>
            <div class="ub-popup-item ub-online-toggle-row">
                <div class="ub-online-toggle-info">
                    <i class="fas fa-broadcast-tower"></i>
                    <span>Appear Online</span>
                </div>
                <label class="ub-toggle-switch">
                    <input type="checkbox" id="ub-online-toggle" checked>
                    <span class="ub-toggle-slider"></span>
                </label>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(this.element);
        document.body.appendChild(this.menuPopup);
        document.body.appendChild(this.objectsPopup);
        document.body.appendChild(this.settingsPopup);

        this.syncIndicator = document.getElementById('ub-sync');
    }

    setupEventListeners() {
        // Menu Button
        const menuBtn = document.getElementById('ub-menu');
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePopup(this.menuPopup);
            });
        }

        // Menu actions
        this.menuPopup.querySelectorAll('.ub-popup-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleMenuAction(action);
                this.hideAllPopups();
            });
        });


        // Undo button
        document.getElementById('ub-undo').addEventListener('click', () => {
            if (window.actionHistory) window.actionHistory.undo();
        });

        // Redo button
        document.getElementById('ub-redo').addEventListener('click', () => {
            if (window.actionHistory) window.actionHistory.redo();
        });

        // Close popups on outside click
        document.addEventListener('click', (e) => {
            if (!this.element.contains(e.target) &&
                !this.menuPopup.contains(e.target) &&
                !this.objectsPopup.contains(e.target)) {
                this.hideAllPopups();
            }
        });

        // User avatar - toggle settings popup
        document.getElementById('ub-user').addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('[UnifiedBar] Opening settings popup...');
            this.updateSettingsPopup();
            this.togglePopup(this.settingsPopup, e.currentTarget);
        });

        // Settings popup actions
        this.settingsPopup.querySelectorAll('[data-settings-action]').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.settingsAction;
                this.handleSettingsAction(action);
                this.hideAllPopups();
            });
        });

        // Online toggle
        const onlineToggle = document.getElementById('ub-online-toggle');
        if (onlineToggle) {
            // Initialize from presence manager or default to online
            if (window.presenceManager) {
                const currentStatus = window.presenceManager.currentStatus || 'offline';
                onlineToggle.checked = currentStatus === 'online';
                this.updateStatusDot(currentStatus);
            } else {
                // Default: toggle is checked (online) by default in HTML
                // Set status dot to match the toggle's initial state
                this.updateStatusDot(onlineToggle.checked ? 'online' : 'offline');
            }

            onlineToggle.addEventListener('change', async (e) => {
                e.stopPropagation(); // Prevent popup from closing

                const wantOnline = e.target.checked;
                this.updateStatusDot('pending');

                console.log('[UnifiedBar] Setting status:', wantOnline ? 'online' : 'offline');

                if (window.presenceManager) {
                    try {
                        await window.presenceManager.setStatus(wantOnline ? 'online' : 'offline');
                        this.updateStatusDot(wantOnline ? 'online' : 'offline');
                        this.updateSidebarStatus(wantOnline ? 'Online' : 'Offline');
                    } catch (err) {
                        console.error('Status update failed:', err);
                        this.updateStatusDot('offline');
                        onlineToggle.checked = false;
                    }
                } else {
                    this.updateStatusDot(wantOnline ? 'online' : 'offline');
                    this.updateSidebarStatus(wantOnline ? 'Online' : 'Offline');
                }
            });

            // Prevent toggle row click from closing popup
            const toggleRow = this.settingsPopup.querySelector('.ub-online-toggle-row');
            if (toggleRow) {
                toggleRow.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }

        // Click outside to close popups
        document.addEventListener('click', (e) => {
            if (!this.menuPopup.contains(e.target) &&
                !this.objectsPopup.contains(e.target) &&
                !this.settingsPopup.contains(e.target)) {
                this.hideAllPopups();
            }
        });
    }

    updateSidebarStatus(statusText) {
        const statusEl = document.getElementById('user-status-text');
        if (statusEl) {
            statusEl.textContent = statusText;
            statusEl.className = 'dashboard-user-status';
            if (statusText === 'Online') {
                statusEl.style.color = '#4ade80';
            } else if (statusText === 'Offline') {
                statusEl.style.color = '#f97316';
            } else {
                statusEl.style.color = '#9ca3af';
            }
        }
    }

    updateStatusDot(status) {
        const dot = document.getElementById('ub-status-dot');
        if (dot) {
            // Accept both string status and boolean for backwards compat
            let statusClass = 'offline';
            if (status === 'online' || status === true) {
                statusClass = 'online';
            } else if (status === 'pending') {
                statusClass = 'pending';
            } else if (status === 'offline' || status === false) {
                statusClass = 'offline';
            }
            dot.className = 'ub-status-dot ' + statusClass;
        }
    }

    handleMenuAction(action) {
        console.log('[UnifiedBar] Menu action:', action);
        switch (action) {
            case 'new':
                if (window.createNewProject) {
                    const modal = document.getElementById('new-project-modal');
                    if (modal && window.showModal) {
                        window.showModal(modal);
                        const input = document.getElementById('project-name');
                        if (input) {
                            input.value = '';
                            input.focus();
                        }
                    }
                }
                break;
            case 'save':
                if (window.saveProject) window.saveProject();
                break;
            case 'open':
                if (window.openProject) window.openProject();
                break;
            case 'export-image':
                if (window.exportAsImage) window.exportAsImage();
                break;
            case 'export-pdf':
                // Call exportAsPDF directly
                console.log('[UnifiedBar] Exporting PDF...');
                if (typeof window.exportAsPDF === 'function') {
                    window.exportAsPDF();
                } else {
                    console.error('[UnifiedBar] exportAsPDF function not available');
                    alert('PDF export not available');
                }
                break;
            case 'reset-view':
                if (window.resetCanvasView) window.resetCanvasView();
                break;
            case 'save-template':
                this.saveAsTemplate();
                break;
        }
    }

    async saveAsTemplate() {
        if (!window.electronAPI || !window.electronAPI.saveAsTemplate) {
            alert('Template save not available');
            return;
        }

        const projectName = document.getElementById('file-name-display')?.textContent || 'Untitled';
        const name = prompt('Template name:', projectName);
        if (!name) return;

        // Get current project data
        if (window.projects && window.activeProjectIndex >= 0) {
            const project = window.projects[window.activeProjectIndex];
            if (window.saveProjectState) window.saveProjectState(window.activeProjectIndex);

            const result = await window.electronAPI.saveAsTemplate({
                name: name,
                content: JSON.stringify(project, null, 2),
                categoryId: 'my-templates'
            });

            if (result.success) {
                alert(`Template "${name}" saved!`);
            } else {
                alert('Failed to save template: ' + (result.error || 'Unknown error'));
            }
        }
    }

    togglePopup(popup, triggerButton = null) {
        const isVisible = popup.classList.contains('show');
        this.hideAllPopups();
        if (!isVisible) {
            popup.classList.add('show');

            // Dynamic positioning for Objects popup
            if (triggerButton && popup.id === 'ub-objects-popup') {
                const rect = triggerButton.getBoundingClientRect();
                const popupWidth = 240; // Approximate width (min-width is 220px)

                // Position centered above button
                let left = rect.left + (rect.width / 2) - (popupWidth / 2);

                // Bound checks (keep on screen)
                if (left < 10) left = 10;
                if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10;

                popup.style.left = `${left}px`;
                popup.style.right = 'auto'; // Clear right
                popup.style.bottom = `${window.innerHeight - rect.top + 10}px`; // 10px spacing
                popup.style.transform = 'none'; // Clear CSS transform
            }
        }
    }

    hideAllPopups() {
        this.menuPopup.classList.remove('show');
        this.objectsPopup.classList.remove('show');
        this.settingsPopup.classList.remove('show');
        // Delay resetting dynamic styles to allow CSS transition to complete
        setTimeout(() => {
            if (!this.objectsPopup.classList.contains('show')) {
                this.objectsPopup.style.left = '';
                this.objectsPopup.style.right = '';
                this.objectsPopup.style.bottom = '';
                this.objectsPopup.style.transform = '';
            }
        }, 250); // Slightly longer than the 200ms CSS transition
    }

    /**
     * Update settings popup with current user data
     */
    updateSettingsPopup() {
        const user = window.getCurrentUser ? window.getCurrentUser() : null;

        const avatarEl = document.getElementById('ub-settings-avatar');
        const nameEl = document.getElementById('ub-settings-name');
        const emailEl = document.getElementById('ub-settings-email');

        if (user) {
            const fullName = user.user_metadata?.full_name || 'Mosaic User';
            const email = user.email || 'Not signed in';
            const avatarUrl = user.user_metadata?.avatar_url;
            const initial = fullName.charAt(0).toUpperCase();

            if (nameEl) nameEl.textContent = fullName;
            if (emailEl) emailEl.textContent = email;

            if (avatarEl) {
                if (avatarUrl) {
                    avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                } else {
                    avatarEl.innerHTML = '';
                    avatarEl.textContent = initial;
                }
            }
        } else {
            if (nameEl) nameEl.textContent = 'Not signed in';
            if (emailEl) emailEl.textContent = 'Click to sign in';
            if (avatarEl) avatarEl.textContent = 'M';
        }

        // Sync status dot and toggle with current presence status
        const onlineToggle = document.getElementById('ub-online-toggle');
        if (window.presenceManager) {
            const currentStatus = window.presenceManager.currentStatus || 'offline';
            this.updateStatusDot(currentStatus);
            if (onlineToggle) {
                onlineToggle.checked = currentStatus === 'online';
            }
        } else {
            // Default to online if no presence manager
            this.updateStatusDot('online');
            if (onlineToggle) {
                onlineToggle.checked = true;
            }
        }
    }

    /**
     * Handle settings popup actions
     */
    handleSettingsAction(action) {
        console.log('[UnifiedBar] Settings action:', action);

        switch (action) {
            case 'account':
                // Navigate to account settings panel
                if (window.showSettingsPanel) {
                    window.showSettingsPanel();
                }
                break;
            case 'dashboard':
                // Navigate to dashboard
                if (window.dashboardController) {
                    window.dashboardController.switchSection('dashboard');
                }
                break;
            case 'signout':
                // Sign out
                if (window.signOut) {
                    window.signOut();
                }
                break;
        }
    }

    updateSyncStatus(status) {
        if (!this.syncIndicator) return;

        const icon = this.syncIndicator.querySelector('i');
        const text = this.syncIndicator.querySelector('span');

        switch (status) {
            case 'saving':
                icon.className = 'fas fa-sync fa-spin';
                text.textContent = 'Saving...';
                this.syncIndicator.classList.add('syncing');
                this.syncIndicator.classList.remove('saved', 'error');
                break;
            case 'saved':
                icon.className = 'fas fa-check-circle';
                text.textContent = 'Saved';
                this.syncIndicator.classList.add('saved');
                this.syncIndicator.classList.remove('syncing', 'error');
                break;
            case 'error':
                icon.className = 'fas fa-exclamation-circle';
                text.textContent = 'Error';
                this.syncIndicator.classList.add('error');
                this.syncIndicator.classList.remove('syncing', 'saved');
                break;
            case 'unsaved':
                icon.className = 'fas fa-circle';
                text.textContent = 'Unsaved';
                this.syncIndicator.classList.remove('syncing', 'saved', 'error');
                break;
            case 'idle':
                // Initial state - show nothing or minimal indicator
                icon.className = 'fas fa-cloud';
                text.textContent = '';
                this.syncIndicator.classList.remove('syncing', 'saved', 'error');
                this.syncIndicator.style.opacity = '0.5';
                break;
        }

        // Reset opacity for non-idle states
        if (status !== 'idle') {
            this.syncIndicator.style.opacity = '1';
        }
    }

    toggleShareDropdown() {
        const dropdown = document.getElementById('share-dropdown');
        if (!dropdown) return;

        if (dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
            return;
        }

        // Populate dropdown content
        this.populateShareDropdown(dropdown);
        dropdown.classList.add('show');

        // Close on outside click
        const closeHandler = (e) => {
            if (!dropdown.contains(e.target) && !e.target.closest('#share-btn')) {
                dropdown.classList.remove('show');
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    populateShareDropdown(dropdown) {
        // Get all projects and active project
        const projects = window.projects || [];
        const activeIdx = window.getActiveProjectIndex ? window.getActiveProjectIndex() : -1;
        const activeProject = activeIdx >= 0 ? projects[activeIdx] : null;

        // Check P2P hosting status
        const isHosting = window.p2pManager?.isHost && window.p2pManager?.hostedProject;
        const hostedProjectId = window.p2pManager?.hostedProject?.id;

        // Check if we're a P2P guest on someone else's project
        const isP2PGuest = window.p2pManager?.connectedProject && !window.p2pManager?.isHost;

        // Build project options - deduplicate by project id or name
        let projectOptions = '';
        if (projects.length > 0) {
            // Deduplicate projects by id first, then by name
            const seen = new Map();
            const uniqueProjects = [];
            projects.forEach((p, i) => {
                const key = p.id || p.name || `project-${i}`;
                if (!seen.has(key)) {
                    seen.set(key, true);
                    uniqueProjects.push({ project: p, index: i });
                }
            });

            projectOptions = uniqueProjects.map(({ project: p, index: i }) => {
                const selected = i === activeIdx ? 'selected' : '';
                const name = p.name || 'Untitled';
                const isHosted = p.id === hostedProjectId;
                return `<option value="${i}" ${selected}>${name}${isHosted ? ' (Hosting)' : ''}</option>`;
            }).join('');
        } else {
            projectOptions = '<option disabled>No projects open</option>';
        }

        // Build hosting UI based on state
        let hostingUI = '';

        // If user is a guest on a P2P shared project, show read-only message
        if (isP2PGuest) {
            hostingUI = `
                <div style="text-align: center; padding: 16px 0;">
                    <i class="fas fa-link" style="font-size: 24px; opacity: 0.5; margin-bottom: 8px;"></i>
                    <div style="font-size: 13px; opacity: 0.7;">This project is shared with you</div>
                    <div style="font-size: 12px; opacity: 0.5; margin-top: 4px;">You cannot re-share shared projects</div>
                </div>
            `;
        } else if (isHosting) {
            hostingUI = `
                <div class="share-hosting-status">
                    <div class="share-hosting-active">
                        <i class="fas fa-broadcast-tower"></i>
                        <span>Hosting Active</span>
                    </div>
                    <button class="share-stop-btn" id="share-stop-btn">
                        <i class="fas fa-stop"></i> Stop
                    </button>
                </div>
                <div class="share-input-row" style="margin-top: 12px; display: flex; gap: 6px;">
                    <input type="text" class="share-invite-input" id="share-room-id-input" readonly value="${hostedProjectId || ''}" style="font-family: monospace; font-size: 11px;">
                    <button class="share-invite-btn" id="share-copy-btn" title="Copy Room ID"><i class="fas fa-copy"></i></button>
                </div>
                <div style="margin-top: 8px; font-size: 12px; opacity: 0.6; text-align: center;">
                    Share this Room ID with others on your local network to let them join.
                </div>
            `;
        } else {
            hostingUI = `
                <button class="share-start-btn" id="share-start-btn">
                    <i class="fas fa-broadcast-tower"></i> Start Hosting
                </button>
                <div style="margin-top: 12px; font-size: 12px; opacity: 0.6; text-align: center;">
                    Your project will be discoverable on your local network.
                </div>
            `;
        }

        dropdown.innerHTML = `
            <div class="share-dropdown-header">
                <div class="share-dropdown-title">Share Project</div>
                <select class="share-project-select" id="share-project-select">
                    ${projectOptions}
                </select>
            </div>
            <div class="share-dropdown-body">
                ${hostingUI}
            </div>
        `;

        // Attach event listeners
        this.attachShareDropdownListeners(dropdown);

        // No invitees list for local P2P yet
    }

    attachShareDropdownListeners(dropdown) {
        // Start Hosting
        const startBtn = dropdown.querySelector('#share-start-btn');
        if (startBtn) {
            startBtn.onclick = async () => {
                startBtn.disabled = true;
                startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';

                try {
                    const activeIdx = window.getActiveProjectIndex ? window.getActiveProjectIndex() : -1;
                    if (activeIdx < 0 || !window.projects || !window.projects[activeIdx]) {
                        throw new Error('No active project');
                    }

                    const project = window.projects[activeIdx];
                    const projectData = {
                        name: project.name,
                        nodes: project.nodes,
                        connections: project.connections,
                        thumbnail: project.thumbnail
                    };

                    if (!window.p2pManager?.peer) {
                        await window.p2pManager?.init();
                    }

                    await window.p2pManager?.hostProject(project.id || 'local-' + Date.now(), projectData);

                    // Refresh dropdown
                    this.populateShareDropdown(dropdown);
                    this.updateCollaboratorAvatars();

                } catch (err) {
                    console.error('P2P hosting failed:', err);
                    alert('Failed to start hosting: ' + err.message);
                    startBtn.disabled = false;
                    startBtn.innerHTML = '<i class="fas fa-broadcast-tower"></i> Start P2P Hosting';
                }
            };
        }

        // Stop Hosting
        const stopBtn = dropdown.querySelector('#share-stop-btn');
        if (stopBtn) {
            stopBtn.onclick = async () => {
                await window.p2pManager?.stopHosting();
                this.populateShareDropdown(dropdown);
                this.updateCollaboratorAvatars();
            };
        }

        // Copy ID
        const copyBtn = dropdown.querySelector('#share-copy-btn');
        const idInput = dropdown.querySelector('#share-room-id-input');
        if (copyBtn && idInput) {
            copyBtn.onclick = () => {
                idInput.select();
                document.execCommand('copy');

                const originalHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    copyBtn.innerHTML = originalHtml;
                }, 2000);
            };
        }

        // Project selector change
        const projectSelect = dropdown.querySelector('#share-project-select');
        if (projectSelect) {
            projectSelect.onchange = (e) => {
                const idx = parseInt(e.target.value);
                if (window.switchToProject && !isNaN(idx)) {
                    window.switchToProject(idx);
                    this.populateShareDropdown(dropdown);
                }
            };
        }
    }

    updateCollaboratorAvatars() {
        const container = document.getElementById('collaborator-avatars');
        if (!container) return;

        // If not hosting or no connections, clear
        if (!window.p2pManager?.isHost) {
            container.innerHTML = '';
            return;
        }

        // Show connected peers
        const connections = window.p2pManager?.connections || new Map();
        if (connections.size === 0) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        connections.forEach((conn, peerId) => {
            const initial = peerId.charAt(7).toUpperCase();
            html += `
                <div class="collab-avatar" title="${peerId}">
                    ${initial}
                    <span class="collab-status online"></span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    async loadCollaborators(modal) {
        const list = modal.querySelector('#share-collaborators-list');

        // Get project ID from multiple sources
        let projectId = null;
        const activeIdx = window.getActiveProjectIndex ? window.getActiveProjectIndex() : -1;
        if (activeIdx >= 0 && window.projects && window.projects[activeIdx]) {
            projectId = window.projects[activeIdx].cloudId;
        }
        if (!projectId && window.multiplayer) {
            projectId = window.multiplayer.projectId;
        }

        if (!projectId || !window.getSupabase) return;

        list.innerHTML = '<div style="padding:10px;text-align:center;opacity:0.5">Loading...</div>';

        try {
            const supabase = window.getSupabase();
            const { data, error } = await supabase
                .from('project_collaborators')
                .select('*')
                .eq('project_id', projectId);

            if (error) throw error;

            list.innerHTML = '';

            // Add self/owner (Mock logic for owner as we don't query projects table here usually)
            // But we can just list the collaborators found.
            // If the project owner isn't in collaborators table (common design), we might miss them.
            // Usually owner is separate. Let's list the explicit collaborators.

            if (data.length === 0) {
                list.innerHTML = '<div style="padding:10px;text-align:center;opacity:0.5">No invited collaborators.</div>';
            }

            data.forEach(collab => {
                const initial = collab.email ? collab.email[0].toUpperCase() : '?';
                const role = collab.role;
                const email = collab.email || 'Unknown User';

                const item = document.createElement('div');
                item.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);';
                item.innerHTML = `
                    <div style="width: 30px; height: 30px; background: #667eea; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: white;">${initial}</div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; color:white;">${email}</div>
                        <div style="font-size: 11px; color: rgba(255,255,255,0.5);">${role}</div>
                    </div>
                `;
                list.appendChild(item);
            });

        } catch (e) {
            console.error('Error loading collaborators:', e);
            list.innerHTML = '<div style="padding:10px;text-align:center;color:#ff6b6b">Error loading list</div>';
        }
    }

    async loadP2PInvitees(container, projectId) {
        if (!container || !projectId) return;

        const supabase = window.getSupabase ? window.getSupabase() : null;
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!supabase || !user) {
            container.innerHTML = 'No invitees yet';
            return;
        }

        try {
            const { data, error } = await supabase
                .from('shared_projects')
                .select('invited_emails')
                .eq('project_id', projectId)
                .eq('host_user_id', user.id)
                .single();

            if (error) throw error;

            const emails = data?.invited_emails || [];

            if (emails.length === 0) {
                container.innerHTML = 'No invitees yet. Invite someone to collaborate!';
                return;
            }

            container.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${emails.map(email => `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                            <i class="fas fa-user" style="opacity: 0.5;"></i>
                            <span>${email}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (err) {
            console.error('Error loading P2P invitees:', err);
            container.innerHTML = 'Error loading invitees';
        }
    }

    setupSyncListeners() {
        // Listen to custom save events
        window.addEventListener('projectSaving', () => {
            this.updateSyncStatus('saving');
        });

        window.addEventListener('projectSaved', () => {
            this.updateSyncStatus('saved');
            // Auto-hide after 3 seconds
            setTimeout(() => {
                if (this.syncIndicator) {
                    const text = this.syncIndicator.querySelector('span');
                    if (text && text.textContent === 'Saved') {
                        text.textContent = '';
                    }
                }
            }, 3000);
        });

        window.addEventListener('projectSaveError', () => {
            this.updateSyncStatus('error');
        });

        // Also intercept the existing scheduleAutoSave
        const originalScheduleAutoSave = window.scheduleAutoSave;
        if (originalScheduleAutoSave) {
            window.scheduleAutoSave = () => {
                this.updateSyncStatus('unsaved');
                originalScheduleAutoSave();
            };
        }
    }

    updateObjectsList() {
        const list = document.getElementById('ub-objects-list');
        if (!list) return;

        const nodes = document.querySelectorAll('.node');
        const groups = window.groups || new Map();

        if (nodes.length === 0 && groups.size === 0) {
            list.innerHTML = '<div class="ub-objects-empty">No objects</div>';
            return;
        }

        let html = '';

        // Groups first
        if (groups.size > 0) {
            html += '<div class="ub-objects-section">Groups</div>';
            groups.forEach((group, id) => {
                html += `
                    <div class="ub-object-item" data-type="group" data-id="${id}">
                        <i class="fas fa-object-group"></i>
                        <span>${group.name || 'Unnamed Group'}</span>
                        <span class="ub-object-count">${group.nodeIds?.length || 0}</span>
                    </div>
                `;
            });
        }

        // Nodes
        if (nodes.length > 0) {
            html += '<div class="ub-objects-section">Nodes</div>';
            nodes.forEach(node => {
                // Get content preview first for text nodes
                let title = '';
                let contentPreview = '';
                const nodeType = node.dataset.type || 'default';

                // 1. Get content preview from .content element
                const content = node.querySelector('.content');
                if (content && content.innerText.trim()) {
                    const text = content.innerText.trim();
                    // Skip placeholder text
                    if (text !== 'Düzenlemek için çift tıklayın' &&
                        text !== 'Double Click to Edit Text' &&
                        !text.includes('Hoş Geldiniz')) {
                        contentPreview = text.length > 25 ? text.substring(0, 25) + '...' : text;
                    }
                }

                // 2. Try node-title element (for custom titled nodes)
                const titleEl = node.querySelector('.node-title');
                if (titleEl && titleEl.innerText.trim()) {
                    title = titleEl.innerText.trim();
                }
                // 3. Fallback to data-node-title
                else if (node.dataset.nodeTitle) {
                    title = node.dataset.nodeTitle;
                }
                // 4. Use content preview if we have it
                else if (contentPreview) {
                    title = contentPreview;
                }
                // 5. Fallback to registry name
                else if (window.appNodeRegistry) {
                    const meta = window.appNodeRegistry.find(m => m.id === nodeType || m.type === nodeType);
                    if (meta) {
                        const lang = document.documentElement.lang || 'en';
                        title = (meta.name && meta.name[lang]) ? meta.name[lang] : (meta.name ? meta.name.en : nodeType);
                    }
                }
                // 6. Final fallback
                if (!title) title = `Node ${node.id.slice(-4)}`;

                // Icon based on type
                let icon = 'fa-sticky-note';
                if (node.querySelector('.checklist-container')) icon = 'fa-list-ul';
                else if (node.querySelector('.timer-container')) icon = 'fa-clock';
                else if (node.querySelector('img:not(.strip-icon)')) icon = 'fa-image';
                else if (node.querySelector('webview')) icon = 'fa-globe';

                html += `
                    <div class="ub-object-item" data-type="node" data-id="${node.id}">
                        <i class="fas ${icon}"></i>
                        <span>${title}</span>
                    </div>
                `;
            });
        }

        list.innerHTML = html;

        // Add click handlers
        list.querySelectorAll('.ub-object-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                const id = item.dataset.id;
                this.focusObject(type, id);
                this.hideAllPopups();
            });
        });
    }

    focusObject(type, id) {
        if (type === 'node') {
            const node = document.getElementById(id);
            if (node) {
                // Use viewportManager for smooth panning
                if (window.viewportManager && window.viewportManager.panToNode) {
                    window.viewportManager.panToNode(node, true);
                } else {
                    // Fallback
                    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                // Highlight effect
                node.classList.add('highlight');
                setTimeout(() => node.classList.remove('highlight'), 1000);
                // Select the node
                if (window.selectNode) window.selectNode(node, false);
            }
        } else if (type === 'group') {
            if (window.viewportManager && window.viewportManager.panToGroup) {
                const group = window.groups?.find(g => g.id === id);
                if (group) window.viewportManager.panToGroup(group);
            }
        }
    }

    toggleMinimap() {
        // No longer used - minimap is always visible
    }

    createMinimap() {
        // Check if already exists
        if (document.getElementById('canvas-minimap')) {
            console.log('[Minimap] Already exists, skipping creation');
            return;
        }

        console.log('[Minimap] Creating minimap...');
        const minimap = document.createElement('div');
        minimap.id = 'canvas-minimap';
        minimap.className = 'canvas-minimap';
        // Add loading state
        minimap.innerHTML = `
            <div class="minimap-loading">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
            <div class="minimap-content" id="minimap-content" style="opacity: 0; transition: opacity 0.3s ease;"></div>
        `;
        document.body.appendChild(minimap);
        console.log('[Minimap] Minimap created and appended to body');

        // Initial update after a short delay to allow layout to settle
        setTimeout(() => this.updateMinimap(), 100);
    }

    updateMinimap() {
        const content = document.getElementById('minimap-content');
        if (!content) return;

        // Remove loading state if present
        const loading = document.querySelector('.minimap-loading');

        // Safely check for nodes existences
        const hasNodes = window.nodeSystem && window.nodeSystem.nodes && window.nodeSystem.nodes.size > 0;
        const domNodes = document.querySelectorAll('.node');
        const hasDomNodes = domNodes.length > 0;

        if (loading && (hasNodes || hasDomNodes)) {
            loading.remove();
            content.style.opacity = '1';
        }

        const canvas = document.getElementById('canvas');
        if (!canvas) return;

        // Get all nodes
        const nodes = canvas.querySelectorAll('.node');

        if (nodes.length === 0) {
            content.innerHTML = '<div class="minimap-empty">No nodes</div>';
            return;
        }

        // Minimap dimensions
        const MINIMAP_WIDTH = 170;
        const MINIMAP_HEIGHT = 110;

        // Node Icons Map - Initialize with defaults
        const NODE_ICONS = {
            'text_node': 'fa-file-alt',
            'checklist': 'fa-check-square',
            'timer': 'fa-clock',
            'image': 'fa-image',
            'url': 'fa-globe',
            'app_node': 'fa-cube',
            'default': 'fa-sticky-note'
        };

        // Populate from AppNodeRegistry if available (Single Source of Truth)
        if (window.appNodeRegistry && Array.isArray(window.appNodeRegistry)) {
            window.appNodeRegistry.forEach(meta => {
                if (meta.type && meta.icon) {
                    NODE_ICONS[meta.type] = meta.icon;
                }
            });
        }

        // First pass: collect all node data and find bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const nodeData = [];

        nodes.forEach(node => {
            let x = parseFloat(node.style.left);
            let y = parseFloat(node.style.top);
            if (isNaN(x) || isNaN(y)) return;

            const w = node.offsetWidth || 200;
            const h = node.offsetHeight || 100;

            // Update bounds
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);

            // Determine icon
            let iconClass = NODE_ICONS['default'];
            const nodeType = node.dataset.type;

            if (nodeType && NODE_ICONS[nodeType]) {
                iconClass = NODE_ICONS[nodeType];
            }
            // Manual Fallbacks for older/unregistered nodes
            else if (node.querySelector('.checklist-container')) iconClass = 'fa-list-ul';
            else if (node.querySelector('.timer-container')) iconClass = 'fa-clock';
            else if (node.querySelector('img:not(.strip-icon)')) iconClass = 'fa-image';
            else if (node.querySelector('webview')) iconClass = 'fa-globe';
            else if (node.classList.contains('app-node')) iconClass = 'fa-cube';
            else {
                const stripIcon = node.querySelector('.strip i');
                if (stripIcon) {
                    stripIcon.classList.forEach(cls => {
                        if (cls.startsWith('fa-') && cls !== 'fa-fw') iconClass = cls;
                    });
                }
            }

            // Color logic
            let color = '#4caf50'; // default green
            let extractedColor = 'transparent';

            // Priority 1: .node-icon-wrapper (Verified source)
            const iconWrapper = node.querySelector('.node-icon-wrapper');
            if (iconWrapper) {
                extractedColor = iconWrapper.style.backgroundColor || getComputedStyle(iconWrapper).backgroundColor;
            }

            // Priority 2: .strip or .header (Legacy/Fallback)
            if (!extractedColor || extractedColor === 'transparent' || extractedColor === 'rgba(0, 0, 0, 0)') {
                const strip = node.querySelector('.strip') || node.querySelector('.header');
                if (strip) {
                    extractedColor = strip.style.backgroundColor || getComputedStyle(strip).backgroundColor;
                }
            }

            // Priority 3: Node background
            if (!extractedColor || extractedColor === 'transparent' || extractedColor === 'rgba(0, 0, 0, 0)') {
                extractedColor = node.style.backgroundColor || getComputedStyle(node).backgroundColor;
            }

            if (extractedColor && extractedColor !== 'transparent' && extractedColor !== 'rgba(0, 0, 0, 0)') {
                color = extractedColor;
            }

            nodeData.push({ id: node.id, x, y, w, h, icon: iconClass, color });
        });

        // Add padding to bounds
        const BOUNDS_PADDING = 800;
        minX -= BOUNDS_PADDING;
        minY -= BOUNDS_PADDING;
        maxX += BOUNDS_PADDING;
        maxY += BOUNDS_PADDING;

        // Calculate scaling
        const totalW = maxX - minX;
        const totalH = maxY - minY;

        if (totalW <= 0 || totalH <= 0) return;

        const scaleX = MINIMAP_WIDTH / totalW;
        const scaleY = MINIMAP_HEIGHT / totalH;
        let scale = Math.min(scaleX, scaleY);
        scale = Math.min(scale, 0.15);

        // Center the content
        const contentW = totalW * scale;
        const contentH = totalH * scale;
        const offsetX = (MINIMAP_WIDTH - contentW) / 2;
        const offsetY = (MINIMAP_HEIGHT - contentH) / 2;

        let html = '';

        // --- 0. Render Groups (Background Layer) ---
        // Use window.groups map if available, fallback to DOM
        if (window.groups && window.groups.size > 0) {
            window.groups.forEach(group => {
                if (!group.bounds) return;

                const x = group.bounds.x;
                const y = group.bounds.y;
                const w = group.bounds.width;
                const h = group.bounds.height;

                const mx = offsetX + (x - minX) * scale;
                const my = offsetY + (y - minY) * scale;
                const mw = Math.max(w * scale, 2);
                const mh = Math.max(h * scale, 2);

                let groupColor = 'rgba(255, 255, 255, 0.05)';
                if (group.color) {
                    groupColor = group.color;
                }

                html += `<div class="minimap-group" style="
                    left: ${mx}px;
                    top: ${my}px;
                    width: ${mw}px;
                    height: ${mh}px;
                    background-color: ${groupColor};
                    opacity: 0.15;
                    border: 1px solid ${groupColor};
                    position: absolute;
                    border-radius: 4px;
                "></div>`;
            });
        } else {
            // DOM Fallback
            const groupElements = canvas.querySelectorAll('.group');
            groupElements.forEach(groupEl => {
                const x = parseFloat(groupEl.style.left);
                const y = parseFloat(groupEl.style.top);
                const w = parseFloat(groupEl.style.width);
                const h = parseFloat(groupEl.style.height);

                if (isNaN(x) || isNaN(y)) return;

                const mx = offsetX + (x - minX) * scale;
                const my = offsetY + (y - minY) * scale;
                const mw = Math.max(w * scale, 2);
                const mh = Math.max(h * scale, 2);

                let groupColor = 'rgba(255, 255, 255, 0.05)';
                if (groupEl.style.borderColor) {
                    groupColor = groupEl.style.borderColor;
                } else if (groupEl.style.backgroundColor) {
                    groupColor = groupEl.style.backgroundColor;
                }

                html += `<div class="minimap-group" style="
                    left: ${mx}px;
                    top: ${my}px;
                    width: ${mw}px;
                    height: ${mh}px;
                    background-color: ${groupColor};
                    opacity: 0.15;
                    border: 1px solid ${groupColor};
                    position: absolute;
                 "></div>`;
            });
        }

        // --- 1. Render Connections (Middle Layer) ---
        const connections = document.querySelectorAll('.connection');
        let linesHtml = '';
        const isLightMode = !document.body.classList.contains('night-mode');
        const strokeColor = isLightMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)';

        connections.forEach(conn => {
            const startId = conn.dataset.startNode;
            const endId = conn.dataset.endNode;

            const startNode = nodeData.find(n => n.id === startId);
            const endNode = nodeData.find(n => n.id === endId);

            if (startNode && endNode) {
                const x1 = startNode.x + startNode.w / 2;
                const y1 = startNode.y + startNode.h / 2;
                const x2 = endNode.x + endNode.w / 2;
                const y2 = endNode.y + endNode.h / 2;

                // Map to minimap
                const mx1 = offsetX + (x1 - minX) * scale;
                const my1 = offsetY + (y1 - minY) * scale;
                const mx2 = offsetX + (x2 - minX) * scale;
                const my2 = offsetY + (y2 - minY) * scale;

                linesHtml += `<line x1="${mx1}" y1="${my1}" x2="${mx2}" y2="${my2}" stroke="${strokeColor}" stroke-width="1.2" />`;
            }
        });

        if (linesHtml) {
            html += `<svg class="minimap-connections" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;">${linesHtml}</svg>`;
        }

        // --- 2. Render Nodes (Top Layer) ---
        nodeData.forEach(d => {
            const mx = offsetX + (d.x - minX) * scale;
            const my = offsetY + (d.y - minY) * scale;
            const mw = Math.max(d.w * scale, 8);
            const mh = Math.max(d.h * scale, 6);

            html += `
                <div class="minimap-node" style="
                    left: ${mx}px;
                    top: ${my}px;
                    width: ${mw}px;
                    height: ${mh}px;
                    background-color: ${d.color};
                ">
                    ${mw > 10 ? `<i class="fas ${d.icon}"></i>` : ''}
                </div>
            `;
        });

        // --- 3. Render Viewport ---
        const wrapper = document.getElementById('canvas-wrapper');
        if (wrapper && window.canvasOffset) {
            const vx = -window.canvasOffset.x / window.canvasScale;
            const vy = -window.canvasOffset.y / window.canvasScale;
            const vw = wrapper.clientWidth / window.canvasScale;
            const vh = wrapper.clientHeight / window.canvasScale;

            const vmx = offsetX + (vx - minX) * scale;
            const vmy = offsetY + (vy - minY) * scale;
            const vmw = vw * scale;
            const vmh = vh * scale;

            // Check if viewport is visible within minimap bounds
            const viewportVisible = (
                vmx + vmw > 0 && vmx < MINIMAP_WIDTH &&
                vmy + vmh > 0 && vmy < MINIMAP_HEIGHT
            );

            if (viewportVisible) {
                // Normal viewport rectangle
                html += `
                    <div class="minimap-viewport" style="
                        left: ${vmx}px;
                        top: ${vmy}px;
                        width: ${vmw}px;
                        height: ${vmh}px;
                        border-radius: 4px;
                        border-color: ${isLightMode ? 'rgba(96, 96, 96, 0.5)' : 'rgba(191, 191, 191, 0.5)'};
                    "></div>
                `;
            } else {
                // Viewport is off-screen - show direction indicator
                // Calculate center of viewport
                const vcx = vmx + vmw / 2;
                const vcy = vmy + vmh / 2;

                // Clamp to minimap bounds with padding
                const padding = 8;
                const indicatorX = Math.max(padding, Math.min(MINIMAP_WIDTH - padding, vcx));
                const indicatorY = Math.max(padding, Math.min(MINIMAP_HEIGHT - padding, vcy));

                // Determine which edge(s) viewport is outside
                const indicatorColor = isLightMode ? '#667eea' : '#60A5FA';

                html += `
                    <div class="minimap-offscreen-indicator" style="
                        position: absolute;
                        left: ${indicatorX}px;
                        top: ${indicatorY}px;
                        width: 12px;
                        height: 12px;
                        background: ${indicatorColor};
                        border-radius: 50%;
                        transform: translate(-50%, -50%);
                        box-shadow: 0 0 8px ${indicatorColor}, 0 0 16px ${indicatorColor};
                        animation: minimapPulse 1.5s ease-in-out infinite;
                        z-index: 10;
                    "></div>
                `;
            }
        }

        content.innerHTML = html;
    }

    show() {
        if (this.element) this.element.style.display = 'flex';
    }

    hide() {
        if (this.element) this.element.style.display = 'none';
    }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other scripts to load
    setTimeout(() => {
        window.unifiedBar = new UnifiedBar();
    }, 100);
});

// Expose globally
window.UnifiedBar = UnifiedBar;
