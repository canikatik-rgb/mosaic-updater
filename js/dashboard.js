/**
 * Dashboard Manager
 * Full-page dashboard for project management
 */

class DashboardManager {
    constructor() {
        this.dashboardEl = null;
        this.isVisible = true;
        this.currentSection = 'dashboard';

        this.templates = [
            { id: 'blank', name: 'Blank Canvas', desc: 'Start fresh', icon: 'fa-plus' },
            { id: 'mindmap', name: 'Mind Map', desc: 'Struct Visualizer', icon: 'fa-project-diagram' },
            { id: 'kanban', name: 'Kanban Board', desc: 'Progress Tracker', icon: 'fa-columns' },
            { id: 'flowchart', name: 'Process Flow', desc: 'Sys Arch', icon: 'fa-sitemap' }
        ];

        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        // Sync night mode from html to body (if applied early before body was ready)
        if (document.documentElement.classList.contains('night-mode') &&
            !document.body.classList.contains('night-mode')) {
            document.body.classList.add('night-mode');
            console.log('[Dashboard] Synced night mode from html to body');
        }

        // Also check system preference directly
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark && !document.body.classList.contains('night-mode')) {
            document.body.classList.add('night-mode');
            console.log('[Dashboard] Applied night mode from system preference');
        }

        this.dashboardEl = document.getElementById('dashboard-view');
        this.sidebarEl = document.getElementById('main-sidebar');

        if (!this.dashboardEl) {
            console.warn('[Dashboard] Dashboard element not found');
            return;
        }

        if (!this.sidebarEl) {
            console.warn('[Dashboard] Sidebar element not found');
        }

        this.setupEventListeners();
        this.updateGreeting();
        this.loadRecentProjects();
        this.renderTemplates();
        this.updateSidebar();

        // Load user avatar on init (don't wait for Account click)
        this.loadUserAvatarOnInit();

        console.log('[Dashboard] Initialized');
    }

    // Load user avatar and profile info early
    async loadUserAvatarOnInit() {
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!user) return;

        // Update avatar displays
        if (window.updateAllAvatars) {
            window.updateAllAvatars(user);
        }
    }

    setupEventListeners() {
        // Navigation items in sidebar (now independent from dashboard)
        if (this.sidebarEl) {
            const navItems = this.sidebarEl.querySelectorAll('.dashboard-nav-item');
            navItems.forEach(item => {
                item.addEventListener('click', () => {
                    const section = item.dataset.section;
                    this.switchSection(section);
                });
            });

            // Sidebar action buttons
            const sidebarNewBtn = this.sidebarEl.querySelector('.sidebar-action-btn[data-action="new"]');
            if (sidebarNewBtn) {
                sidebarNewBtn.addEventListener('click', () => this.createNewProject());
            }

            const sidebarOpenBtn = this.sidebarEl.querySelector('.sidebar-action-btn[data-action="open"]');
            if (sidebarOpenBtn) {
                sidebarOpenBtn.addEventListener('click', () => this.importProject());
            }
        }

        // Action buttons in main content (dashboard)
        const newCanvasBtn = this.dashboardEl.querySelector('[data-action="new-canvas"]');
        if (newCanvasBtn) {
            newCanvasBtn.addEventListener('click', () => this.createNewProject());
        }

        const importBtn = this.dashboardEl.querySelector('[data-action="import"]');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importProject());
        }

        // View toggle buttons in dashboard
        const viewToggleBtns = this.dashboardEl.querySelectorAll('.dashboard-view-toggle button');
        viewToggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                viewToggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // "View All" links to switch sections
        const viewAllLinks = this.dashboardEl.querySelectorAll('[data-goto-section]');
        viewAllLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.gotoSection;
                this.switchSection(section);
            });
        });
    }

    updateSidebar() {
        this.updateSidebarCurrentProjects();
        this.updateSidebarRecentProjects();
    }

    updateSidebarCurrentProjects() {
        const container = document.getElementById('sidebar-current-projects');
        if (!container) return;

        // Get currently open projects from file-management (single project mode)
        const projects = window.projects || [];
        // Use getter function to get active project index
        const activeIndex = typeof window.getActiveProjectIndex === 'function'
            ? window.getActiveProjectIndex()
            : -1;
        const dashboardHidden = this.dashboardEl && this.dashboardEl.classList.contains('hidden');

        if (projects.length === 0) {
            container.innerHTML = '<div class="sidebar-empty-message">No open project</div>';
            return;
        }

        container.innerHTML = '';

        // Single project mode - only show the active project (or first one)
        const projectIndex = activeIndex >= 0 ? activeIndex : 0;
        const project = projects[projectIndex];

        if (!project) {
            container.innerHTML = '<div class="sidebar-empty-message">No open project</div>';
            return;
        }

        const isActive = dashboardHidden;
        const storageIcon = this.getStorageIcon(project.storageType);
        const item = document.createElement('div');
        item.className = 'sidebar-project-item' + (isActive ? ' active' : '');
        item.dataset.projectIndex = projectIndex;
        item.dataset.storage = project.storageType || 'local';
        item.innerHTML = `
            <i class="fas ${storageIcon}"></i>
            <span class="sidebar-project-name" data-original="${project.name || 'Untitled'}">${project.name || 'Untitled'}</span>
            <div class="sidebar-project-actions">
                <i class="fas fa-pencil-alt rename-btn" title="Rename"></i>
                <i class="fas fa-times close-btn" title="Close Project"></i>
            </div>
        `;

        const nameSpan = item.querySelector('.sidebar-project-name');

        // Function to start inline editing
        const startEditing = (e) => {
            if (e) e.stopPropagation();

            // Store original value
            nameSpan.dataset.original = nameSpan.textContent;

            // Make editable
            nameSpan.contentEditable = 'true';
            nameSpan.classList.add('editing');
            nameSpan.focus();

            // Select all text
            const range = document.createRange();
            range.selectNodeContents(nameSpan);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        };

        // Function to save edit
        const saveEdit = () => {
            const newName = nameSpan.textContent.trim() || 'Untitled';
            nameSpan.contentEditable = 'false';
            nameSpan.classList.remove('editing');
            nameSpan.textContent = newName;

            // Update project if name changed
            if (newName !== nameSpan.dataset.original && window.renameProject) {
                window.renameProject(projectIndex, newName);
            }
        };

        // Function to cancel edit
        const cancelEdit = () => {
            nameSpan.contentEditable = 'false';
            nameSpan.classList.remove('editing');
            nameSpan.textContent = nameSpan.dataset.original;
        };

        // Event listeners for inline editing
        nameSpan.addEventListener('blur', saveEdit);
        nameSpan.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameSpan.blur(); // Triggers saveEdit
            } else if (e.key === 'Escape') {
                cancelEdit();
            }
        });

        // Double-click to edit
        nameSpan.addEventListener('dblclick', startEditing);

        // Click on project navigates to it
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-btn') ||
                e.target.classList.contains('rename-btn') ||
                e.target.classList.contains('editing') ||
                e.target.contentEditable === 'true') return;

            // Clear nav active states since we're viewing a project
            if (this.sidebarEl) {
                this.sidebarEl.querySelectorAll('.dashboard-nav-item').forEach(nav => {
                    nav.classList.remove('active');
                });
            }

            this.navigateToProject(projectIndex);
        });

        // Rename button - starts inline editing
        const renameBtn = item.querySelector('.rename-btn');
        if (renameBtn) {
            renameBtn.addEventListener('click', startEditing);
        }

        // Close button - with confirmation for unsaved changes
        const closeBtn = item.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.confirmCloseProject(projectIndex);
            });
        }

        container.appendChild(item);
    }

    // Confirm close project with unsaved changes check
    confirmCloseProject(projectIndex) {
        const project = window.projects?.[projectIndex];
        if (!project) return;

        // Check for unsaved changes (simple check - compare with last saved state)
        // For now, always ask since we don't have a dirty flag
        const confirmed = confirm(`Close project "${project.name}"?\n\nAny unsaved changes will be lost.`);

        if (confirmed) {
            if (window.closeProject) {
                window.closeProject(projectIndex);
            }
        }
    }

    // Helper function to get storage type icon
    getStorageIcon(storageType) {
        switch (storageType) {
            case 'cloud': return 'fa-cloud';
            case 'shared': return 'fa-link';
            default: return 'fa-file-alt';
        }
    }

    async updateSidebarRecentProjects() {
        const container = document.getElementById('sidebar-recent-projects');
        if (!container) return;

        try {
            // Use getRecentProjects API (same as dashboard)
            if (window.electronAPI && window.electronAPI.getRecentProjects) {
                let projects = await window.electronAPI.getRecentProjects();

                // Get currently open project paths
                const openProjectPaths = (window.projects || [])
                    .map(p => p.filePath)
                    .filter(path => path); // Filter out null/undefined paths

                // Filter out projects that are already open
                // Fetch more than needed initially to allow for filtering
                projects = projects.filter(p => !openProjectPaths.includes(p.path));

                if (projects.length === 0) {
                    container.innerHTML = '<div class="sidebar-empty-message">No recent projects</div>';
                    return;
                }

                container.innerHTML = '';
                // Show max 3 recent projects in sidebar AFTER filtering
                projects.slice(0, 3).forEach(project => {
                    const name = project.name || (project.path ? project.path.split('/').pop().replace('.mosaic', '').replace('.json', '') : 'Untitled');
                    const item = document.createElement('div');
                    item.className = 'sidebar-project-item' + (project.exists === false ? ' missing' : '');
                    item.innerHTML = `<i class="fas fa-clock"></i><span>${name}</span>`;

                    item.addEventListener('click', () => {
                        if (project.exists === false) {
                            this.handleMissingProject(project);
                        } else {
                            this.openProject(project.path);
                        }
                    });

                    container.appendChild(item);
                });
            } else {
                container.innerHTML = '<div class="sidebar-empty-message">No recent projects</div>';
            }
        } catch (err) {
            console.error('[Dashboard] Error loading sidebar recent projects:', err);
            container.innerHTML = '<div class="sidebar-empty-message">Error loading</div>';
        }
    }

    updateGreeting() {
        const greetingEl = this.dashboardEl.querySelector('.dashboard-greeting');
        if (!greetingEl) return;

        const hour = new Date().getHours();
        let greeting = 'Good Evening';

        if (hour >= 5 && hour < 12) {
            greeting = 'Good Morning';
        } else if (hour >= 12 && hour < 18) {
            greeting = 'Good Afternoon';
        }

        greetingEl.innerHTML = `${greeting}<span class="highlight">.</span>`;
    }

    switchSection(section) {
        this.currentSection = section;

        // Update nav active state in sidebar
        if (this.sidebarEl) {
            const navItems = this.sidebarEl.querySelectorAll('.dashboard-nav-item');
            navItems.forEach(item => {
                item.classList.toggle('active', item.dataset.section === section);
            });

            // Clear project active states when viewing a dashboard section
            this.sidebarEl.querySelectorAll('.sidebar-project-item').forEach(item => {
                item.classList.remove('active');
            });

            // Clear user section active state (since we're not in settings anymore)
            if (window.clearUserSectionActive) {
                window.clearUserSectionActive();
            }
        }

        // Show dashboard view if hidden
        this.show();

        // Switch visible section content
        const allSections = this.dashboardEl.querySelectorAll('.dashboard-section-content');
        allSections.forEach(sec => {
            if (sec.dataset.section === section) {
                sec.classList.remove('hidden');
            } else {
                sec.classList.add('hidden');
            }
        });

        // Load section-specific content
        if (section === 'projects') {
            this.loadAllProjects();
        } else if (section === 'templates') {
            this.loadTemplatesView();
        }

        console.log('[Dashboard] Switched to section:', section);
    }

    // Navigate to a specific project
    navigateToProject(projectIndex) {
        // Check if we're already on this project
        const currentIndex = window.getActiveProjectIndex ? window.getActiveProjectIndex() : -1;
        const isSameProject = currentIndex === projectIndex;

        // Hide dashboard
        this.hide();

        // Only call switchToProject if we're switching to a DIFFERENT project
        // If it's the same project, just hiding dashboard is enough - canvas is still there
        if (!isSameProject && window.switchToProject) {
            window.switchToProject(projectIndex);
        }

        // Update sidebar to show this project as active
        this.updateSidebar();
    }

    async loadRecentProjects() {
        const projectsGrid = this.dashboardEl.querySelector('.dashboard-projects-grid');
        if (!projectsGrid) return;

        projectsGrid.innerHTML = '<div class="dashboard-empty"><i class="fas fa-spinner fa-spin"></i><p>Loading projects...</p></div>';

        try {
            // Use new recent projects API
            if (window.electronAPI && window.electronAPI.getRecentProjects) {
                let projects = await window.electronAPI.getRecentProjects();

                // Get currently open project paths
                const openProjectPaths = (window.projects || [])
                    .map(p => p.filePath)
                    .filter(path => path); // Filter out null/undefined paths

                // Filter out projects that are already open
                projects = projects.filter(p => !openProjectPaths.includes(p.path));

                if (projects.length === 0) {
                    projectsGrid.innerHTML = '<div class="dashboard-empty"><i class="fas fa-folder-open"></i><p>No recent projects</p><p class="dashboard-empty-hint">Open a .mosaic file to see it here</p></div>';
                    return;
                }

                projectsGrid.innerHTML = '';
                // Show only first 8 for dashboard preview
                projects.slice(0, 8).forEach(project => {
                    const card = this.createProjectCard(project);
                    projectsGrid.appendChild(card);
                });
            } else {
                projectsGrid.innerHTML = '<div class="dashboard-empty"><i class="fas fa-folder-open"></i><p>No recent projects</p></div>';
            }
        } catch (err) {
            console.error('[Dashboard] Error loading projects:', err);
            projectsGrid.innerHTML = '<div class="dashboard-empty"><i class="fas fa-exclamation-circle"></i><p>Error loading projects</p></div>';
        }
    }

    createProjectCard(project, showFullDate = false) {
        const card = document.createElement('div');
        card.className = 'project-card' + (project.exists === false ? ' missing' : '');

        // Use mtime, lastOpened, or modified date
        const modifiedDate = project.mtime || project.lastOpened || project.modified;
        const timeAgo = this.getTimeAgo(modifiedDate);
        const fullDate = modifiedDate ? new Date(modifiedDate).toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'Unknown';

        // Get name from project name or file name
        const name = project.name || (project.path ? project.path.split('/').pop().replace('.mosaic', '').replace('.json', '') : 'Untitled');

        // Check for thumbnail
        const hasThumbnail = project.thumbnail && project.thumbnail.startsWith('data:image');

        card.innerHTML = `
            <div class="project-card-preview">
                ${hasThumbnail
                ? `<img src="${project.thumbnail}" alt="${name}" class="project-thumbnail"/>`
                : `<i class="fas ${project.exists === false ? 'fa-exclamation-triangle' : 'fa-project-diagram'}"></i>`
            }
                <span class="project-card-time">${timeAgo}</span>
            </div>
            <div class="project-card-info">
                <div class="project-card-name">${name}</div>
                <div class="project-card-meta">${project.exists === false ? 'File not found' : (showFullDate ? fullDate : 'Local Project')}</div>
            </div>
        `;

        card.addEventListener('click', async () => {
            if (project.exists === false) {
                // Show relocate dialog
                await this.handleMissingProject(project);
            } else {
                this.openProject(project.path);
            }
        });

        return card;
    }

    // Handle missing project - show relocate dialog
    async handleMissingProject(project) {
        if (window.electronAPI && window.electronAPI.relocateProject) {
            const result = await window.electronAPI.relocateProject(project.path);
            if (result.success && result.newPath) {
                // Open the relocated file
                this.openProject(result.newPath);
            } else if (!result.canceled) {
                // Remove from recent if user doesn't want to locate
                const shouldRemove = confirm('Could not locate file. Remove from recent projects?');
                if (shouldRemove && window.electronAPI.removeFromRecent) {
                    await window.electronAPI.removeFromRecent(project.path);
                    this.loadRecentProjects();
                }
            }
        }
    }

    getTimeAgo(date) {
        if (!date) return 'Unknown';

        const now = new Date();
        const then = new Date(date);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return then.toLocaleDateString();
    }

    renderTemplates() {
        const templatesGrid = this.dashboardEl.querySelector('.dashboard-templates-grid');
        if (!templatesGrid) return;

        templatesGrid.innerHTML = '';

        this.templates.forEach(template => {
            const card = document.createElement('div');
            card.className = 'template-card';

            const isBlank = template.id === 'blank';

            card.innerHTML = `
                <div class="template-card-preview">
                    ${isBlank
                    ? '<span class="template-card-plus">+</span>'
                    : `<span class="template-card-icon"><i class="fas ${template.icon}"></i></span>`
                }
                </div>
                <div class="template-card-info">
                    <div class="template-card-name">${template.name}</div>
                    <div class="template-card-desc">${template.desc}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                this.createFromTemplate(template.id);
            });

            templatesGrid.appendChild(card);
        });
    }

    createNewProject() {
        console.log('[Dashboard] Creating new project');

        // Create new untitled project FIRST (with confirmation skipped since we're from dashboard)
        if (window.createNewProject) {
            const project = window.createNewProject('Untitled', true); // skipConfirmation = true

            if (project) {
                // Project created successfully, now hide dashboard
                this.hide();

                // Update sidebar to show new project
                setTimeout(() => {
                    this.updateSidebar();
                }, 100);
            }
        }
    }

    createFromTemplate(templateId) {
        console.log('[Dashboard] Creating from template:', templateId);

        // Create project first with confirmation skipped
        if (window.createNewProject) {
            const project = window.createNewProject('Untitled', true);

            if (project) {
                this.hide();
                setTimeout(() => this.updateSidebar(), 100);
            }
        }
    }

    importProject() {
        console.log('[Dashboard] Importing project');

        if (window.openProject) {
            window.openProject();
        }
    }

    openProject(filePath) {
        console.log('[Dashboard] Opening project:', filePath);
        this.hide();

        if (window.openProject) {
            window.openProject(filePath);
        }
    }

    show() {
        if (this.dashboardEl) {
            // Auto-save current project state before showing dashboard
            // This ensures no data is lost when navigating away
            const activeIndex = window.getActiveProjectIndex ? window.getActiveProjectIndex() : -1;
            if (activeIndex >= 0 && window.saveProjectState) {
                console.log('[Dashboard] Auto-saving project before showing dashboard');
                window.saveProjectState(activeIndex);
            }

            // Hide drawing toolbar if open
            if (window.drawingSystem && window.drawingSystem.toolbar) {
                window.drawingSystem.toolbar.classList.add('hidden');
                window.drawingSystem.deactivate(); // Also deactivate drawing mode
            }

            this.dashboardEl.classList.remove('hidden');
            this.isVisible = true;
            this.loadRecentProjects();
            this.updateGreeting();
            this.updateSidebar();

            // Auto-open sidebar when dashboard is shown
            if (window.customTitleBar && window.customTitleBar.openSidebar) {
                window.customTitleBar.openSidebar();
            }
        }
    }

    hide() {
        if (this.dashboardEl) {
            this.dashboardEl.classList.add('hidden');
            this.isVisible = false;
            // Dispatch event for minimap creation
            window.dispatchEvent(new CustomEvent('dashboardHidden'));
            console.log('[Dashboard] Hidden, dashboardHidden event dispatched');

            // Auto-close sidebar when dashboard is hidden (project opened)
            if (window.customTitleBar && window.customTitleBar.closeSidebar) {
                window.customTitleBar.closeSidebar();
            }
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    // Load all projects for the full projects view
    async loadAllProjects() {
        const container = document.querySelector('[data-section="projects"]');
        if (!container) return;

        // Get the three grids
        const localGrid = document.getElementById('local-projects-grid');
        const cloudGrid = document.getElementById('cloud-projects-grid');
        const sharedGrid = document.getElementById('shared-projects-grid');

        // Show loading state
        const loadingHTML = '<div class="dashboard-empty"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';
        if (localGrid) localGrid.innerHTML = loadingHTML;
        if (cloudGrid) cloudGrid.innerHTML = loadingHTML;
        if (sharedGrid) sharedGrid.innerHTML = loadingHTML;

        try {
            // ===== LOCAL PROJECTS =====
            if (localGrid && window.electronAPI && window.electronAPI.getRecentProjects) {
                const localProjects = await window.electronAPI.getRecentProjects();

                if (localProjects.length === 0) {
                    localGrid.innerHTML = '<div class="dashboard-empty"><i class="fas fa-folder-open"></i><p>No local projects</p><p class="dashboard-empty-hint">Open a .mosaic file to see it here</p></div>';
                } else {
                    localGrid.innerHTML = '';
                    localProjects.forEach(project => {
                        const card = this.createProjectCard({ ...project, storageType: 'local' }, true);
                        localGrid.appendChild(card);
                    });
                }
            } else if (localGrid) {
                localGrid.innerHTML = '<div class="dashboard-empty"><i class="fas fa-folder-open"></i><p>No local projects</p></div>';
            }

            // ===== CLOUD PROJECTS =====
            const isLoggedIn = window.isAuthenticated && window.isAuthenticated();

            if (cloudGrid) {
                if (!isLoggedIn) {
                    cloudGrid.innerHTML = '<div class="dashboard-empty"><i class="fas fa-cloud"></i><p>Sign in to see cloud projects</p></div>';
                } else if (window.listCloudProjects) {
                    const result = await window.listCloudProjects();

                    if (result.error || !result.data || result.data.length === 0) {
                        cloudGrid.innerHTML = '<div class="dashboard-empty"><i class="fas fa-cloud"></i><p>No cloud projects</p><p class="dashboard-empty-hint">Save a project to cloud to see it here</p></div>';
                    } else {
                        cloudGrid.innerHTML = '';
                        result.data.forEach(project => {
                            const card = this.createCloudProjectCard(project);
                            cloudGrid.appendChild(card);
                        });
                    }
                } else {
                    cloudGrid.innerHTML = '<div class="dashboard-empty"><i class="fas fa-cloud"></i><p>Cloud storage unavailable</p></div>';
                }
            }

            // ===== SHARED WITH ME =====
            if (sharedGrid) {
                if (!isLoggedIn) {
                    sharedGrid.innerHTML = '<div class="dashboard-empty"><i class="fas fa-link"></i><p>Sign in to see shared projects</p></div>';
                } else {
                    let allSharedProjects = [];

                    // 1. Load cloud shared projects
                    if (window.listSharedProjects) {
                        const cloudResult = await window.listSharedProjects();
                        if (!cloudResult.error && cloudResult.data) {
                            allSharedProjects.push(...cloudResult.data.map(p => ({
                                ...p,
                                shareType: 'cloud'
                            })));
                        }
                    }

                    // 2. Load P2P shared projects
                    if (window.p2pManager) {
                        const p2pProjects = await window.p2pManager.getSharedWithMe();
                        allSharedProjects.push(...p2pProjects.map(p => ({
                            id: p.project_id,
                            name: p.project_name,
                            thumbnail: p.thumbnail,
                            updated_at: p.updated_at,
                            hostUserId: p.host_user_id,
                            hostOnline: p.hostOnline,
                            shareType: 'p2p'
                        })));
                    }

                    if (allSharedProjects.length === 0) {
                        sharedGrid.innerHTML = '<div class="dashboard-empty"><i class="fas fa-link"></i><p>No shared projects</p><p class="dashboard-empty-hint">Projects shared with you will appear here</p></div>';
                    } else {
                        sharedGrid.innerHTML = '';
                        allSharedProjects.forEach(project => {
                            const card = this.createSharedProjectCard(project);
                            sharedGrid.appendChild(card);
                        });
                    }
                }
            }

        } catch (err) {
            console.error('[Dashboard] Error loading all projects:', err);
            const errorHTML = '<div class="dashboard-empty"><i class="fas fa-exclamation-circle"></i><p>Error loading projects</p></div>';
            if (localGrid) localGrid.innerHTML = errorHTML;
            if (cloudGrid) cloudGrid.innerHTML = errorHTML;
            if (sharedGrid) sharedGrid.innerHTML = errorHTML;
        }
    }

    // Create a cloud project card
    createCloudProjectCard(project) {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.dataset.storageType = 'cloud';

        const modifiedDate = project.updated_at || project.created_at;
        const timeAgo = this.getTimeAgo(modifiedDate);
        const hasThumbnail = project.thumbnail && project.thumbnail.startsWith('data:image');

        card.innerHTML = `
            <div class="project-card-preview">
                ${hasThumbnail
                ? `<img src="${project.thumbnail}" alt="${project.name}" class="project-thumbnail"/>`
                : '<i class="fas fa-cloud"></i>'
            }
                <span class="project-card-time">${timeAgo}</span>
            </div>
            <div class="project-card-info">
                <div class="project-card-name">${project.name || 'Untitled'}</div>
                <div class="project-card-meta"><i class="fas fa-cloud"></i> Cloud Project</div>
            </div>
        `;

        card.addEventListener('click', () => {
            this.openCloudProject(project.id);
        });

        return card;
    }

    // Create a shared project card
    createSharedProjectCard(project) {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.dataset.storageType = 'shared';

        const modifiedDate = project.updated_at || project.created_at;
        const timeAgo = this.getTimeAgo(modifiedDate);
        const hasThumbnail = project.thumbnail && project.thumbnail.startsWith('data:image');
        const isP2P = project.shareType === 'p2p';
        const hostOnline = project.hostOnline;
        const sharedBy = project.sharedBy || 'Unknown';
        const roleLabel = project.role === 'editor' ? 'Editor' : 'Viewer';

        // Status indicator for P2P
        let statusIndicator = '';
        if (isP2P) {
            statusIndicator = hostOnline
                ? '<span class="p2p-status online"><i class="fas fa-circle"></i> Online</span>'
                : '<span class="p2p-status offline"><i class="fas fa-circle"></i> Offline</span>';
        }

        card.innerHTML = `
            <div class="project-card-preview">
                ${hasThumbnail
                ? `<img src="${project.thumbnail}" alt="${project.name}" class="project-thumbnail"/>`
                : `<i class="fas fa-${isP2P ? 'broadcast-tower' : 'link'}"></i>`
            }
                <span class="project-card-time">${timeAgo}</span>
                ${statusIndicator}
            </div>
            <div class="project-card-info">
                <div class="project-card-name">${project.name || 'Untitled'}</div>
                <div class="project-card-meta">
                    ${isP2P
                ? '<i class="fas fa-broadcast-tower"></i> P2P Share'
                : `<i class="fas fa-user"></i> ${sharedBy} · ${roleLabel}`
            }
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            if (isP2P) {
                this.openP2PProject(project);
            } else {
                this.openCloudProject(project.id);
            }
        });

        return card;
    }

    // Prompt to join via ID
    async joinProjectViaId() {
        const roomId = prompt("Enter the Room ID to join:");
        if (!roomId || !roomId.trim()) return;

        try {
            // Check if P2P manager exists
            if (!window.p2pManager) {
                alert("P2P System is not ready.");
                return;
            }

            console.log('[Dashboard] Connecting to Manual Room ID:', roomId);

            // Init if needed
            if (!window.p2pManager.peer) {
                await window.p2pManager.init();
            }

            // Connect using the roomId
            await window.p2pManager.connectToProject(roomId.trim());

            // We need to manually set up the listener since openP2PProject usually does this
            // But we don't have the project object yet to pass to openP2PProject
            // So we'll duplicate the listener logic or refactor

            // Reuse openP2PProject logic by mocking a project object?
            // Or just inline the listener here.

            const removeListener = window.p2pManager.on((event, data) => {
                if (event === 'project-received') {
                    console.log('[Dashboard] Received project data from host');

                    if (data.project && window.Project) {
                        const newProject = new window.Project(data.project.name);
                        newProject.nodes = data.project.nodes || [];
                        newProject.connections = data.project.connections || [];

                        // Add to projects
                        window.projects = window.projects || [];
                        window.projects.push(newProject);
                        window.activeProjectIndex = window.projects.length - 1;

                        if (window.loadProjectData) window.loadProjectData(newProject);
                        if (window.switchToProject) window.switchToProject(window.activeProjectIndex);

                        this.hide();
                    }
                    removeListener?.();
                }
            });

        } catch (err) {
            console.error('[Dashboard] Join error:', err);
            alert("Failed to join: " + err.message);
        }
    }

    // Open a P2P shared project
    async openP2PProject(project) {
        if (!project.hostOnline) {
            alert(`The host is currently offline. You can connect when they come online.`);
            return;
        }

        console.log('[Dashboard] Connecting to P2P project:', project.id);

        try {
            // Initialize P2P if needed
            if (!window.p2pManager?.peer) {
                await window.p2pManager?.init();
            }

            // Connect to host
            await window.p2pManager?.connectToProject(project.id);

            // Set up listener for project data
            const removeListener = window.p2pManager?.on((event, data) => {
                if (event === 'project-received') {
                    console.log('[Dashboard] Received project data from host');

                    // Create project from received data
                    if (data.project && window.Project) {
                        const newProject = new window.Project(data.project.name);
                        newProject.nodes = data.project.nodes || [];
                        newProject.connections = data.project.connections || [];

                        // Add to projects
                        window.projects = window.projects || [];
                        window.projects.push(newProject);
                        window.activeProjectIndex = window.projects.length - 1;

                        // Load and switch to canvas
                        if (window.loadProjectData) {
                            window.loadProjectData(newProject);
                        }
                        if (window.switchToProject) {
                            window.switchToProject(window.activeProjectIndex);
                        }

                        // Hide dashboard
                        this.hide();
                    }

                    removeListener?.();
                }
            });
        } catch (err) {
            console.error('[Dashboard] P2P connect error:', err);
            alert('Failed to connect: ' + err.message);
        }
    }


    // Open a cloud project
    async openCloudProject(cloudProjectId) {
        console.log('[Dashboard] Opening cloud project:', cloudProjectId);

        if (!window.loadProjectFromCloud) {
            console.error('[Dashboard] loadProjectFromCloud not available');
            return;
        }

        // SINGLE PROJECT MODE: Check if there's already an open project
        const projects = window.projects || [];
        const activeIdx = window.getActiveProjectIndex ? window.getActiveProjectIndex() : -1;

        if (projects.length > 0 && activeIdx >= 0) {
            const currentProject = projects[activeIdx];
            const confirmed = confirm(
                `You have an active project: "${currentProject.name}"\n\n` +
                `Close the current project and open from cloud?\n\n` +
                `(Any unsaved changes will be lost)`
            );

            if (!confirmed) {
                console.log("[Dashboard] User cancelled - keeping current project");
                return;
            }

            // Close all existing projects first
            console.log("[Dashboard] Closing existing projects for single-project mode");
            window.projects.length = 0;
            if (window.setActiveProjectIndex) window.setActiveProjectIndex(-1);
        }

        const result = await window.loadProjectFromCloud(cloudProjectId);

        if (result.error) {
            console.error('[Dashboard] Failed to load cloud project:', result.error);
            alert('Failed to load project: ' + (result.error.message || 'Unknown error'));
            return;
        }

        console.log('[Dashboard] Cloud project data loaded:', result.data);

        // Hide dashboard
        this.hide();

        // Check if Project class exists
        if (!window.Project) {
            console.error('[Dashboard] Project class not found');
            return;
        }

        // Create a project object directly with loaded data
        const cloudData = result.data.data || {};
        const project = new window.Project(result.data.name || 'Cloud Project');

        // Load the project data IMMEDIATELY into the project object
        project.nodes = cloudData.nodes || [];
        project.connections = cloudData.connections || [];
        project.groups = cloudData.groups || [];
        project.stickers = cloudData.stickers || [];
        project.canvasOffset = cloudData.canvasOffset || { x: 0, y: 0 };
        project.canvasScale = cloudData.canvasScale || 1;

        // Set cloud properties
        project.cloudId = result.data.id;
        project.storageType = 'cloud';

        console.log('[Dashboard] Project prepared with', project.nodes.length, 'nodes,', project.connections.length, 'connections');

        // Add project to projects array
        window.projects.push(project);
        const newIndex = window.projects.length - 1;

        // Initialize UI if needed
        if (window.initializeAppUIIfNeeded) {
            window.initializeAppUIIfNeeded();
        }

        // Switch to the new project (this will render the nodes)
        if (window.switchToProject) {
            window.switchToProject(newIndex);
        }

        // Set the cloud project ID for auto-sync
        if (window.setCurrentCloudProjectId) {
            window.setCurrentCloudProjectId(cloudProjectId);
        }

        // Update sidebar
        this.updateSidebar();
    }

    // Create a list row for a project
    createProjectListRow(project) {
        const row = document.createElement('div');
        row.className = 'projects-list-row' + (project.exists === false ? ' missing' : '');

        const modifiedDate = project.mtime || project.lastOpened || project.modified;
        const fullDate = modifiedDate ? new Date(modifiedDate).toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'Unknown';

        const timeAgo = this.getTimeAgo(modifiedDate);
        const name = project.name || (project.path ? project.path.split('/').pop().replace('.mosaic', '').replace('.json', '') : 'Untitled');

        row.innerHTML = `
            <span class="projects-col-name">
                <i class="fas ${project.exists === false ? 'fa-exclamation-triangle' : 'fa-file-alt'}"></i>
                <span class="project-name-text">${name}</span>
                ${project.exists === false ? '<span class="file-missing-badge">Missing</span>' : ''}
            </span>
            <span class="projects-col-date">
                <span class="date-full">${fullDate}</span>
                <span class="date-ago">(${timeAgo})</span>
            </span>
            <span class="projects-col-actions">
                <button class="project-action-btn" title="${project.exists === false ? 'Locate' : 'Open'}">
                    <i class="fas ${project.exists === false ? 'fa-search' : 'fa-external-link-alt'}"></i>
                </button>
            </span>
        `;

        row.addEventListener('click', async () => {
            if (project.exists === false) {
                await this.handleMissingProject(project);
            } else {
                this.openProject(project.path);
            }
        });

        return row;
    }

    // Load templates view with categories
    async loadTemplatesView() {
        const container = document.getElementById('templates-categories-container');
        if (!container) return;

        container.innerHTML = '<div class="dashboard-empty"><i class="fas fa-spinner fa-spin"></i><p>Loading templates...</p></div>';

        try {
            // Try to load templates from file system
            let fileBasedTemplates = { categories: [] };
            if (window.electronAPI && window.electronAPI.listTemplates) {
                fileBasedTemplates = await window.electronAPI.listTemplates();
            }

            container.innerHTML = '';

            // Create a section for built-in templates (always show)
            const builtInSection = document.createElement('div');
            builtInSection.className = 'dashboard-section';
            builtInSection.innerHTML = `
                <div class="dashboard-section-header">
                    <span class="dashboard-section-title">Built-in Templates</span>
                </div>
                <div class="dashboard-templates-grid"></div>
            `;

            const builtInGrid = builtInSection.querySelector('.dashboard-templates-grid');
            this.templates.forEach(template => {
                const card = this.createTemplateCard(template, true);
                builtInGrid.appendChild(card);
            });
            container.appendChild(builtInSection);

            // Show file-based category templates
            if (fileBasedTemplates.categories && fileBasedTemplates.categories.length > 0) {
                fileBasedTemplates.categories.forEach(category => {
                    if (category.templates && category.templates.length > 0) {
                        const catSection = document.createElement('div');
                        catSection.className = 'dashboard-section';
                        catSection.innerHTML = `
                            <div class="dashboard-section-header">
                                <span class="dashboard-section-title">${category.name}</span>
                                <span class="template-count">${category.templates.length} templates</span>
                            </div>
                            <div class="dashboard-templates-grid"></div>
                        `;

                        const catGrid = catSection.querySelector('.dashboard-templates-grid');
                        category.templates.forEach(template => {
                            const card = this.createTemplateCard({
                                id: template.path,
                                name: template.name,
                                desc: category.name,
                                icon: category.icon || 'fa-file-alt',
                                isFile: true
                            }, false);
                            catGrid.appendChild(card);
                        });

                        container.appendChild(catSection);
                    }
                });
            }

            // Placeholder for community templates (future)
            const communitySection = document.createElement('div');
            communitySection.className = 'dashboard-section';
            communitySection.innerHTML = `
                <div class="dashboard-section-header">
                    <span class="dashboard-section-title">Community Templates</span>
                    <span class="coming-soon-badge">Coming Soon</span>
                </div>
                <div class="dashboard-empty" style="padding: 40px 20px;">
                    <i class="fas fa-users"></i>
                    <p>Community templates will be available soon</p>
                </div>
            `;
            container.appendChild(communitySection);

        } catch (err) {
            console.error('[Dashboard] Error loading templates:', err);
            container.innerHTML = '<div class="dashboard-empty"><i class="fas fa-exclamation-circle"></i><p>Error loading templates</p></div>';
        }
    }

    // Create template card helper
    createTemplateCard(template, isBuiltIn = false) {
        const card = document.createElement('div');
        card.className = 'template-card';

        const isBlank = template.id === 'blank';

        card.innerHTML = `
            <div class="template-card-preview">
                ${isBlank
                ? '<span class="template-card-plus">+</span>'
                : `<span class="template-card-icon"><i class="fas ${template.icon}"></i></span>`
            }
            </div>
            <div class="template-card-info">
                <div class="template-card-name">${template.name}</div>
                <div class="template-card-desc">${template.desc}</div>
            </div>
        `;

        card.addEventListener('click', () => {
            if (template.isFile) {
                this.createFromFileTemplate(template.id);
            } else {
                this.createFromTemplate(template.id);
            }
        });

        return card;
    }

    // Create project from file-based template
    async createFromFileTemplate(templatePath) {
        console.log('[Dashboard] Creating from file template:', templatePath);

        if (window.electronAPI && window.electronAPI.readTemplate) {
            try {
                const result = await window.electronAPI.readTemplate(templatePath);
                if (result.success && result.content) {
                    this.hide();

                    // Parse template content and create project
                    const templateData = JSON.parse(result.content);
                    if (window.createNewProject) {
                        const project = window.createNewProject(result.name || 'From Template');

                        // Load template data into the new project
                        if (project && templateData.nodes) {
                            // Template loading will be handled by the project system
                            console.log('[Dashboard] Template loaded with', templateData.nodes.length, 'nodes');
                        }
                    }
                } else {
                    console.error('[Dashboard] Failed to load template:', result.error);
                }
            } catch (err) {
                console.error('[Dashboard] Error loading template:', err);
            }
        }
    }
}

// Initialize and expose globally
let dashboardManager = null;

function initDashboard() {
    if (!dashboardManager) {
        dashboardManager = new DashboardManager();
    }
    return dashboardManager;
}

// Expose globally
window.initDashboard = initDashboard;
window.dashboardManager = null;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = initDashboard();
});
