/**
 * Custom Title Bar Component
 * Modern macOS-style frameless window title bar
 * Shows open projects in dropdown (like tabs) + sidebar panel for file management
 */

class CustomTitleBar {
    constructor() {
        this.element = null;
        this.dropdownMenu = null;
        this.sidebarPanel = null;
        this.isDropdownOpen = false;
        this.isSidebarOpen = false;
        this.projectName = 'Untitled';
        this.openProjects = [];
        this.activeProjectIndex = -1;

        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.element = document.getElementById('custom-titlebar');
        this.dropdownMenu = document.getElementById('project-dropdown-menu');

        if (!this.element) {
            console.warn('[CustomTitleBar] Title bar element not found');
            return;
        }

        this.createSidebarPanel();
        this.setupEventListeners();
        console.log('[CustomTitleBar] Initialized');
    }

    createSidebarPanel() {
        // Create sidebar panel for file management
        if (document.getElementById('sidebar-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'sidebar-panel';
        panel.className = 'sidebar-panel';
        panel.innerHTML = `
            <div class="sidebar-header">
                <h3>Mosaic</h3>
                <button class="sidebar-close-btn" title="Close Sidebar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="sidebar-content">
                <div class="sidebar-section">
                    <div class="sidebar-section-title">Current Project</div>
                    <div id="sidebar-current-project" class="sidebar-project-item active">
                        <i class="fas fa-file-alt"></i>
                        <span>Untitled</span>
                    </div>
                </div>
                <div class="sidebar-section">
                    <div class="sidebar-section-title">Recent Projects</div>
                    <div id="sidebar-recent-projects">
                        <!-- Dynamically populated -->
                    </div>
                </div>
                <div class="sidebar-section">
                    <div class="sidebar-section-title">Actions</div>
                    <div class="sidebar-actions">
                        <button class="sidebar-action-btn" data-action="new">
                            <i class="fas fa-plus"></i> New Mosaic
                        </button>
                        <button class="sidebar-action-btn" data-action="open">
                            <i class="fas fa-folder-open"></i> Open from Disk
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);
        this.sidebarPanel = panel;

        // Setup sidebar events
        const closeBtn = panel.querySelector('.sidebar-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSidebar());
        }

        // Action buttons
        const newBtn = panel.querySelector('[data-action="new"]');
        if (newBtn) {
            newBtn.addEventListener('click', () => {
                this.closeSidebar();
                const modal = document.getElementById('new-project-modal');
                if (modal && window.showModal) {
                    window.showModal(modal);
                }
            });
        }

        const openBtn = panel.querySelector('[data-action="open"]');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                this.closeSidebar();
                if (window.openProject) {
                    window.openProject();
                }
            });
        }
    }

    setupEventListeners() {
        // Project Dropdown Toggle - shows open projects
        const dropdownBtn = document.getElementById('project-dropdown-btn');
        if (dropdownBtn) {
            dropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isDropdownOpen && !e.target.closest('.project-dropdown-menu') && !e.target.closest('.project-dropdown')) {
                this.closeDropdown();
            }
            // Sidebar only closes via toggle button, not on outside click
        });

        // Share button
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Use unified bar's dropdown if available
                if (window.unifiedBar && window.unifiedBar.toggleShareDropdown) {
                    window.unifiedBar.toggleShareDropdown();
                } else {
                    this.toggleShareDropdown();
                }
            });
        }

        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showSettings();
            });
        }

        // Chat button
        const chatBtn = document.getElementById('chat-btn');
        if (chatBtn) {
            chatBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.chatManager) {
                    window.chatManager.toggle();
                }
            });
        }

        // Listen for chat badge updates
        window.addEventListener('chat-badge-update', (e) => {
            const badge = document.getElementById('chat-badge');
            if (badge) {
                const count = e.detail.count;
                badge.style.display = count > 0 ? 'flex' : 'none';
                badge.textContent = count > 99 ? '99+' : count;
            }
        });

        // Sidebar toggle
        const sidebarBtn = document.getElementById('sidebar-toggle');
        if (sidebarBtn) {
            sidebarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSidebar();
            });
        }

        // Home button - shows welcome/dashboard
        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.goHome();
            });
        }

        // Dropdown menu items
        this.setupDropdownItems();

        // Listen for Electron fullscreen changes
        if (window.electronAPI && window.electronAPI.onFullscreenChange) {
            window.electronAPI.onFullscreenChange((isFullscreen) => {
                console.log('[CustomTitleBar] Fullscreen changed:', isFullscreen);
                if (isFullscreen) {
                    document.body.classList.add('is-fullscreen');
                } else {
                    document.body.classList.remove('is-fullscreen');
                }
            });
        }
    }

    setupDropdownItems() {
        if (!this.dropdownMenu) return;

        // New Mosaic
        const newMosaicItem = this.dropdownMenu.querySelector('[data-action="new-mosaic"]');
        if (newMosaicItem) {
            newMosaicItem.addEventListener('click', () => {
                this.closeDropdown();
                const modal = document.getElementById('new-project-modal');
                if (modal && window.showModal) {
                    window.showModal(modal);
                }
            });
        }

        // Open from Disk
        const openDiskItem = this.dropdownMenu.querySelector('[data-action="open-disk"]');
        if (openDiskItem) {
            openDiskItem.addEventListener('click', () => {
                this.closeDropdown();
                if (window.openProject) {
                    window.openProject();
                }
            });
        }
    }

    toggleDropdown() {
        if (this.isDropdownOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        if (!this.dropdownMenu) return;

        // Update open projects list before showing
        this.renderOpenProjects();

        this.dropdownMenu.classList.add('open');
        this.isDropdownOpen = true;

        // Update chevron
        const chevron = document.querySelector('.project-dropdown .chevron');
        if (chevron) {
            chevron.classList.remove('fa-chevron-down');
            chevron.classList.add('fa-chevron-up');
        }
    }

    closeDropdown() {
        if (!this.dropdownMenu) return;

        this.dropdownMenu.classList.remove('open');
        this.isDropdownOpen = false;

        // Update chevron
        const chevron = document.querySelector('.project-dropdown .chevron');
        if (chevron) {
            chevron.classList.remove('fa-chevron-up');
            chevron.classList.add('fa-chevron-down');
        }
    }

    // Update open projects list (called from file-management.js)
    updateOpenProjects(projects, activeIndex) {
        this.openProjects = projects || [];
        this.activeProjectIndex = activeIndex;

        // Update current project in sidebar
        this.updateSidebarCurrentProject();
    }

    // Render open projects in dropdown (like tabs)
    renderOpenProjects() {
        const projectsList = this.dropdownMenu?.querySelector('#recent-projects-list');
        if (!projectsList) return;

        projectsList.innerHTML = '';

        if (this.openProjects.length === 0) {
            projectsList.innerHTML = '<div class="dropdown-item" style="opacity: 0.5; cursor: default;">No open projects</div>';
            return;
        }

        this.openProjects.forEach((project, index) => {
            const item = document.createElement('div');
            item.className = 'dropdown-item' + (index === this.activeProjectIndex ? ' active' : '');
            const isSynced = project.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project.id);
            const cloudIcon = isSynced ? '<i class="fas fa-cloud" style="font-size: 10px; margin-left: 6px; color: #4CAF50;" title="Synced to Cloud"></i>' : '';

            item.innerHTML = `
                <i class="fas fa-file-alt"></i>
                <span>${project.name || 'Untitled'}</span>
                ${cloudIcon}
                ${this.openProjects.length > 1 ? '<i class="fas fa-times close-project-btn" data-index="' + index + '"></i>' : ''}
            `;

            // Click to switch project
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('close-project-btn')) {
                    // Close project
                    const idx = parseInt(e.target.dataset.index);
                    if (window.closeProject) {
                        window.closeProject(idx);
                    }
                    e.stopPropagation();
                    return;
                }

                this.closeDropdown();
                if (window.switchToProject) {
                    window.switchToProject(index);
                }
            });

            projectsList.appendChild(item);
        });
    }

    updateSidebarCurrentProject() {
        const currentEl = document.getElementById('sidebar-current-project');
        if (!currentEl) return;

        const project = this.openProjects[this.activeProjectIndex];
        const name = project ? project.name : 'Untitled';

        currentEl.innerHTML = `
            <i class="fas fa-file-alt"></i>
            <span>${name}</span>
        `;
    }

    updateSidebarRecentProjects() {
        const recentList = document.getElementById('sidebar-recent-projects');
        if (!recentList) return;

        recentList.innerHTML = '<div class="sidebar-loading">Loading...</div>';

        const loadRecent = async () => {
            try {
                if (window.electronAPI && window.electronAPI.listLocalFiles) {
                    const files = await window.electronAPI.listLocalFiles();
                    const recent = files.slice(0, 8);

                    if (recent.length === 0) {
                        recentList.innerHTML = '<div class="sidebar-empty">No recent projects</div>';
                        return;
                    }

                    recentList.innerHTML = '';
                    recent.forEach(file => {
                        const item = document.createElement('div');
                        item.className = 'sidebar-project-item';
                        item.innerHTML = `
                            <i class="fas fa-file"></i>
                            <span>${file.name.replace('.mosaic', '')}</span>
                        `;
                        item.addEventListener('click', () => {
                            this.closeSidebar();
                            if (window.openProject) {
                                window.openProject(file.path);
                            }
                        });
                        recentList.appendChild(item);
                    });
                } else {
                    recentList.innerHTML = '<div class="sidebar-empty">No recent projects</div>';
                }
            } catch (err) {
                console.error('[CustomTitleBar] Error loading recent:', err);
                recentList.innerHTML = '<div class="sidebar-empty">Error loading</div>';
            }
        };

        loadRecent();
    }

    setProjectName(name) {
        this.projectName = name || 'Untitled';
        const nameEl = document.getElementById('titlebar-project-name');
        if (nameEl) {
            nameEl.textContent = this.projectName;
        }

        // Also update document title
        document.title = `${this.projectName} - Mosaic`;

        // Update sidebar
        this.updateSidebarCurrentProject();
    }

    toggleSidebar() {
        // Sidebar is now independent - just toggle it
        const sidebar = document.getElementById('main-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            this.isSidebarOpen = !sidebar.classList.contains('collapsed');
            console.log('[CustomTitleBar] Sidebar toggled:', this.isSidebarOpen ? 'open' : 'collapsed');
        }
    }

    openSidebar() {
        const sidebar = document.getElementById('main-sidebar');
        if (sidebar) {
            sidebar.classList.remove('collapsed');
            this.isSidebarOpen = true;
        }
    }

    closeSidebar() {
        const sidebar = document.getElementById('main-sidebar');
        if (sidebar) {
            sidebar.classList.add('collapsed');
            this.isSidebarOpen = false;
        }
    }

    showShareModal() {
        console.log('[CustomTitleBar] Share clicked');

        if (window.unifiedBar && window.unifiedBar.showShareModal) {
            window.unifiedBar.showShareModal();
        } else {
            console.warn('UnifiedBar not ready or showShareModal missing');
            alert('Share functionality is loading...');
        }
    }

    showSettings() {
        console.log('[CustomTitleBar] Settings clicked');

        // Use SettingsManager if available
        if (window.settingsManager) {
            window.settingsManager.toggleDropdown();
        } else {
            // Fallback: Toggle night mode as quick action
            document.body.classList.toggle('night-mode');
            const isNightMode = document.body.classList.contains('night-mode');
            localStorage.setItem('mosaicNightMode', isNightMode ? 'true' : 'false');
            console.log('[CustomTitleBar] Night mode:', isNightMode);
        }
    }

    goHome() {
        console.log('[CustomTitleBar] Home clicked');

        // Home button should SHOW the dashboard (force visible)
        if (window.dashboardManager) {
            window.dashboardManager.show();
        }
    }
}

// Initialize and expose globally
let customTitleBar = null;

function initCustomTitleBar() {
    if (!customTitleBar) {
        customTitleBar = new CustomTitleBar();
    }
    return customTitleBar;
}

// Update title bar project name (called from file-management.js)
function updateTitleBarProjectName(name) {
    if (customTitleBar) {
        customTitleBar.setProjectName(name);
    } else {
        const nameEl = document.getElementById('titlebar-project-name');
        if (nameEl) {
            nameEl.textContent = name || 'Untitled';
        }
    }
}

// Expose functions globally
window.initCustomTitleBar = initCustomTitleBar;
window.updateTitleBarProjectName = updateTitleBarProjectName;
window.customTitleBar = null;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.customTitleBar = initCustomTitleBar();
});

/**
 * Notification Manager
 * Handles in-app notifications with dropdown UI
 */
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.isDropdownOpen = false;
        this.dropdown = null;
        this.unsubscribe = null;

        this.init();
    }

    init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.createDropdown();
        this.setupEventListeners();
        this.loadNotifications();
        this.subscribeToRealtime();

        console.log('[NotificationManager] Initialized');
    }

    createDropdown() {
        // Check if already exists
        if (document.getElementById('notifications-dropdown')) return;

        const dropdown = document.createElement('div');
        dropdown.id = 'notifications-dropdown';
        dropdown.className = 'notifications-dropdown';
        dropdown.innerHTML = `
            <div class="notifications-header">
                <h4>Notifications</h4>
                <button id="mark-all-read">Mark all as read</button>
            </div>
            <div class="notifications-list" id="notifications-list">
                <div class="notifications-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            </div>
        `;
        document.body.appendChild(dropdown);
        this.dropdown = dropdown;

        // Mark all read button
        const markAllBtn = dropdown.querySelector('#mark-all-read');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => this.markAllAsRead());
        }
    }

    setupEventListeners() {
        const btn = document.getElementById('notifications-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isDropdownOpen &&
                !e.target.closest('#notifications-dropdown') &&
                !e.target.closest('#notifications-btn')) {
                this.closeDropdown();
            }
        });
    }

    toggleDropdown() {
        if (this.isDropdownOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        if (!this.dropdown) return;
        this.dropdown.classList.add('open');
        this.isDropdownOpen = true;
        this.renderNotifications();
    }

    closeDropdown() {
        if (!this.dropdown) return;
        this.dropdown.classList.remove('open');
        this.isDropdownOpen = false;
    }

    async loadNotifications() {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        const user = window.getCurrentUser ? window.getCurrentUser() : null;

        if (!supabase || !user) {
            console.log('[NotificationManager] Not authenticated, skipping load');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                // Table might not exist yet
                if (error.code === '42P01') {
                    console.log('[NotificationManager] Notifications table not created yet');
                    return;
                }
                throw error;
            }

            this.notifications = data || [];
            this.updateBadge();
            this.renderNotifications();
        } catch (err) {
            console.error('[NotificationManager] Load error:', err);
        }
    }

    subscribeToRealtime() {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        const user = window.getCurrentUser ? window.getCurrentUser() : null;

        if (!supabase || !user) return;

        try {
            this.unsubscribe = supabase
                .channel('notifications')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                }, (payload) => {
                    console.log('[NotificationManager] New notification:', payload.new);
                    this.notifications.unshift(payload.new);
                    this.updateBadge();
                    if (this.isDropdownOpen) {
                        this.renderNotifications();
                    }
                    // Show toast
                    this.showToast(payload.new);
                })
                .subscribe();
        } catch (err) {
            console.log('[NotificationManager] Realtime subscription error:', err);
        }
    }

    showToast(notification) {
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--modal-bg, #333);
            color: var(--text-color, white);
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10001;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
        `;
        toast.innerHTML = `
            <i class="fas fa-bell" style="color: var(--primary-btn-bg, #67a772);"></i>
            <span>${notification.title}</span>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    updateBadge() {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;

        const unreadCount = this.notifications.filter(n => !n.read).length;

        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    renderNotifications() {
        const list = document.getElementById('notifications-list');
        if (!list) return;

        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="notifications-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }

        list.innerHTML = '';
        this.notifications.forEach(notif => {
            const item = document.createElement('div');
            item.className = 'notification-item' + (notif.read ? '' : ' unread');
            item.dataset.id = notif.id;

            const icon = this.getIconForType(notif.type);
            const timeAgo = this.formatTimeAgo(notif.created_at);

            item.innerHTML = `
                <div class="notification-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notif.title}</div>
                    <div class="notification-message">${notif.message || ''}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
            `;

            item.addEventListener('click', () => this.handleNotificationClick(notif));
            list.appendChild(item);
        });
    }

    getIconForType(type) {
        switch (type) {
            case 'project_shared': return 'fa-share-alt';
            case 'comment': return 'fa-comment';
            case 'mention': return 'fa-at';
            default: return 'fa-bell';
        }
    }

    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    async handleNotificationClick(notification) {
        // Mark as read
        await this.markAsRead(notification.id);

        // Handle action based on type
        if (notification.type === 'project_shared' && notification.data?.project_id) {
            // Open the shared project
            if (window.dashboardManager) {
                window.dashboardManager.openCloudProject(notification.data.project_id);
            }
        }

        this.closeDropdown();
    }

    async markAsRead(notificationId) {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        if (!supabase) return;

        try {
            await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', notificationId);

            // Update local state
            const notif = this.notifications.find(n => n.id === notificationId);
            if (notif) notif.read = true;

            this.updateBadge();
            this.renderNotifications();
        } catch (err) {
            console.error('[NotificationManager] Mark read error:', err);
        }
    }

    async markAllAsRead() {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!supabase || !user) return;

        try {
            await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user.id)
                .eq('read', false);

            // Update local state
            this.notifications.forEach(n => n.read = true);

            this.updateBadge();
            this.renderNotifications();
        } catch (err) {
            console.error('[NotificationManager] Mark all read error:', err);
        }
    }

    // Static method to create a notification (for use from other parts of the app)
    static async create(userId, type, title, message = null, data = null) {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        if (!supabase) return;

        try {
            const { error } = await supabase
                .from('notifications')
                .insert({
                    user_id: userId,
                    type,
                    title,
                    message,
                    data
                });

            if (error) throw error;
            console.log('[NotificationManager] Notification created for user:', userId);
        } catch (err) {
            console.error('[NotificationManager] Create error:', err);
        }
    }
}

// Initialize notification manager
let notificationManager = null;

document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for auth to initialize
    setTimeout(() => {
        notificationManager = new NotificationManager();
        window.notificationManager = notificationManager;
    }, 1000);
});

// Export for use in share modal
window.NotificationManager = NotificationManager;
