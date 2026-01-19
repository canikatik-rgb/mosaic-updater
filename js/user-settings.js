/**
 * User Settings Panel Controller
 * Manages user profile, plan, storage, and sign out
 */

// State
let originalUserData = {};
let hasChanges = false;

/**
 * Show settings panel in dashboard (navigates to settings section)
 */
function showSettingsPanel() {
    // Auto-save current project state before showing settings
    // This ensures no data is lost when navigating to settings
    const activeIndex = window.getActiveProjectIndex ? window.getActiveProjectIndex() : -1;
    if (activeIndex >= 0 && window.saveProjectState) {
        console.log('[UserSettings] Auto-saving project before showing settings');
        window.saveProjectState(activeIndex);
    }

    // Show dashboard if hidden
    const dashboardView = document.getElementById('dashboard-view');
    const dashboardMain = document.querySelector('.dashboard-main');
    const userSection = document.getElementById('dashboard-user-section');

    if (dashboardView && dashboardMain) {
        dashboardView.style.display = 'flex';
        dashboardView.classList.remove('hidden');

        // Hide all sections
        dashboardMain.querySelectorAll('.dashboard-section-content').forEach(s => {
            s.classList.add('hidden');
        });

        // Show settings section
        const settingsSection = dashboardMain.querySelector('[data-section="settings"]');
        if (settingsSection) {
            settingsSection.classList.remove('hidden');
        }

        // Update nav active state
        document.querySelectorAll('.dashboard-nav-item').forEach(n => n.classList.remove('active'));

        // Mark user section as active
        if (userSection) {
            userSection.classList.add('active');
        }
    }

    // Load user data
    loadUserData();
    console.log('[UserSettings] Settings panel shown');
}

/**
 * Remove active state from user section (called when navigating away)
 */
function clearUserSectionActive() {
    const userSection = document.getElementById('dashboard-user-section');
    if (userSection) {
        userSection.classList.remove('active');
    }
}

/**
 * Show settings as overlay (for use when project is open)
 * This keeps the project intact and just shows settings on top
 */
function showSettingsOverlay() {
    // Create or show overlay
    let overlay = document.getElementById('settings-overlay');

    if (!overlay) {
        // Create overlay element
        overlay = document.createElement('div');
        overlay.id = 'settings-overlay';
        overlay.className = 'settings-overlay';
        overlay.innerHTML = `
            <div class="settings-overlay-content">
                <div class="settings-overlay-header">
                    <h2>Account Settings</h2>
                    <button class="settings-overlay-close" onclick="window.hideSettingsOverlay()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="settings-overlay-body" id="settings-overlay-body">
                    <!-- Content will be cloned from dashboard settings panel -->
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Clone settings panel content
        const settingsPanel = document.getElementById('settings-panel');
        const overlayBody = document.getElementById('settings-overlay-body');
        if (settingsPanel && overlayBody) {
            overlayBody.innerHTML = settingsPanel.innerHTML;
        }

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hideSettingsOverlay();
            }
        });

        // Re-bind event handlers for cloned elements
        bindOverlayEvents();
    }

    overlay.classList.add('show');
    loadUserData();
    console.log('[UserSettings] Settings overlay shown');
}

/**
 * Hide settings overlay
 */
function hideSettingsOverlay() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

/**
 * Bind events for overlay cloned elements
 */
function bindOverlayEvents() {
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;

    // Save button
    const saveBtn = overlay.querySelector('#settings-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveUserSettings);
    }

    // Sign out button
    const signOutBtn = overlay.querySelector('#settings-signout-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSettingsSignOut);
    }

    // Avatar upload
    const uploadBtn = overlay.querySelector('#settings-avatar-upload');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', handleAvatarUpload);
    }

    // Avatar delete
    const deleteBtn = overlay.querySelector('#settings-avatar-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleAvatarDelete);
    }
}

/**
 * Legacy function - still used for overlay modal (if needed)
 */
function showUserSettings() {
    showSettingsOverlay();
}

/**
 * Hide user settings modal
 */
function hideUserSettings() {
    hideSettingsOverlay();
    hasChanges = false;
}

/**
 * Load user data from Supabase
 */
async function loadUserData() {
    const user = window.getCurrentUser();
    if (!user) {
        console.warn('[UserSettings] No user logged in');
        return;
    }

    // Store original data for comparison
    originalUserData = {
        fullName: user.user_metadata?.full_name || '',
        email: user.email || '',
        profession: user.user_metadata?.profession || ''
    };

    // Update form fields
    const nameInput = document.getElementById('settings-fullname');
    const emailInput = document.getElementById('settings-email');
    const professionSelect = document.getElementById('settings-profession');

    if (nameInput) nameInput.value = originalUserData.fullName;
    if (emailInput) emailInput.value = originalUserData.email;
    if (professionSelect) professionSelect.value = originalUserData.profession;

    // Update avatar
    updateAvatarDisplay(user);

    // Load plan info
    await loadPlanInfo(user.id);

    // Load stats
    await loadUserStats(user.id);

    // Load storage
    await loadStorageInfo(user.id);

    // Setup online toggle
    setupOnlineToggle();

    // Reset save button state
    updateSaveButtonState();
    hideSettingsMessage();
}

/**
 * Setup online/offline toggle
 */
function setupOnlineToggle() {
    const toggle = document.getElementById('settings-online-toggle');
    if (!toggle) return;

    // Set initial state from presence manager
    const presenceManager = window.presenceManager;
    if (presenceManager) {
        toggle.checked = presenceManager.isVisible;
    }

    // Remove old listener if any
    toggle.removeEventListener('change', handleOnlineToggleChange);
    toggle.addEventListener('change', handleOnlineToggleChange);
}

function handleOnlineToggleChange(e) {
    const isOnline = e.target.checked;
    const presenceManager = window.presenceManager;

    if (presenceManager) {
        presenceManager.setInvisible(!isOnline);
        console.log('[UserSettings] Online status toggled:', isOnline ? 'visible' : 'invisible');
    }
}

/**
 * Update avatar display
 */
function updateAvatarDisplay(user) {
    const avatar = document.getElementById('settings-avatar');
    const fullName = user?.user_metadata?.full_name || user?.email || 'U';
    const initial = fullName.charAt(0).toUpperCase();
    const avatarUrl = user?.user_metadata?.avatar_url;

    if (avatar) {
        if (avatarUrl) {
            avatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
        } else {
            avatar.innerHTML = '';
            avatar.textContent = initial;
        }
    }

    // Also update sidebar and unified-bar avatars
    updateAllAvatars(user);
}

/**
 * Update all avatar displays across the app
 */
function updateAllAvatars(user) {
    const fullName = user?.user_metadata?.full_name || user?.email || 'U';
    const initial = fullName.charAt(0).toUpperCase();
    const avatarUrl = user?.user_metadata?.avatar_url;

    // Sidebar avatar
    const sidebarAvatar = document.querySelector('.dashboard-user-avatar');
    if (sidebarAvatar) {
        if (avatarUrl) {
            sidebarAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            sidebarAvatar.innerHTML = '';
            sidebarAvatar.textContent = initial;
        }
    }

    // Sidebar name
    const sidebarName = document.querySelector('.dashboard-user-name');
    if (sidebarName) {
        sidebarName.textContent = fullName;
    }

    // Sidebar status
    const sidebarStatus = document.querySelector('.dashboard-user-status');
    if (sidebarStatus && user) {
        sidebarStatus.textContent = user.email || 'Signed In';
    }

    // Unified Bar avatar
    const ubAvatar = document.querySelector('.ub-avatar');
    if (ubAvatar) {
        if (avatarUrl) {
            ubAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            ubAvatar.innerHTML = '';
            ubAvatar.textContent = initial;
        }
    }
}

/**
 * Load plan information
 */
async function loadPlanInfo(userId) {
    const supabase = window.getSupabase();
    if (!supabase) return;

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', userId)
            .single();

        const tier = profile?.subscription_tier || 'free';

        // Update plan display
        const planBadge = document.getElementById('settings-plan-badge');
        const planName = document.getElementById('settings-plan-name');
        const planContainer = document.getElementById('settings-plan-container');
        const upgradeBtn = document.getElementById('settings-upgrade-btn');

        if (planBadge) {
            planBadge.textContent = tier.toUpperCase();
            planBadge.className = `user-settings-plan-badge ${tier}`;
        }

        if (planName) {
            const names = { free: 'Free Plan', pro: 'Pro Plan', team: 'Team Plan' };
            planName.textContent = names[tier] || 'Free Plan';
        }

        if (planContainer) {
            planContainer.className = `user-settings-plan ${tier}`;
        }

        if (upgradeBtn) {
            upgradeBtn.style.display = tier === 'free' ? 'block' : 'none';
        }

    } catch (error) {
        console.error('[UserSettings] Error loading plan:', error);
    }
}

/**
 * Load user statistics
 */
async function loadUserStats(userId) {
    const supabase = window.getSupabase();
    const user = window.getCurrentUser();
    if (!supabase || !user) return;

    try {
        // Count user's CLOUD projects
        const { count: cloudProjectCount } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Count LOCAL projects (from window.projects)
        const localProjectCount = window.projects?.length || 0;

        // Total projects = max of cloud or local (they can overlap)
        const totalProjects = Math.max(cloudProjectCount || 0, localProjectCount);

        // Count CLOUD projects shared WITH this user
        const userEmail = user.email?.toLowerCase() || '';
        const { data: cloudSharedData } = await supabase
            .from('project_collaborators')
            .select('id')
            .or(`user_id.eq.${userId},email.ilike.${userEmail}`)
            .neq('role', 'owner');

        const cloudSharedCount = cloudSharedData?.length || 0;

        // Count P2P projects shared WITH this user
        let p2pSharedCount = 0;
        try {
            const { data: p2pSharedData } = await supabase
                .from('shared_projects')
                .select('id')
                .eq('is_active', true)
                .filter('invited_emails', 'cs', `{"${userEmail}"}`);
            p2pSharedCount = p2pSharedData?.length || 0;
        } catch (e) {
            console.warn('[UserSettings] P2P shared count error:', e);
        }

        // Count P2P projects this user is HOSTING
        let p2pHostingCount = 0;
        try {
            const { count: hostCount } = await supabase
                .from('shared_projects')
                .select('*', { count: 'exact', head: true })
                .eq('host_user_id', userId);
            p2pHostingCount = hostCount || 0;
        } catch (e) {
            console.warn('[UserSettings] P2P hosting count error:', e);
        }

        // Total shared = cloud collabs + P2P received + P2P hosting
        const totalSharedCount = cloudSharedCount + p2pSharedCount + p2pHostingCount;

        // Update stats display
        const projectStat = document.getElementById('settings-stat-projects');
        const sharedStat = document.getElementById('settings-stat-shared');

        if (projectStat) projectStat.textContent = totalProjects;
        if (sharedStat) sharedStat.textContent = totalSharedCount;

        console.log('[UserSettings] Stats loaded:', { totalProjects, totalSharedCount });

    } catch (error) {
        console.error('[UserSettings] Error loading stats:', error);
    }
}

/**
 * Load storage information
 */
async function loadStorageInfo(userId) {
    const supabase = window.getSupabase();
    if (!supabase) return;

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('storage_used_bytes, subscription_tier')
            .eq('id', userId)
            .single();

        const usedBytes = profile?.storage_used_bytes || 0;
        const tier = profile?.subscription_tier || 'free';

        // Storage limits by tier
        const limits = {
            free: 100 * 1024 * 1024,    // 100 MB
            pro: 5 * 1024 * 1024 * 1024, // 5 GB
            team: 50 * 1024 * 1024 * 1024 // 50 GB
        };

        const limit = limits[tier] || limits.free;
        const percentage = Math.min((usedBytes / limit) * 100, 100);

        // Update storage display
        const storageValue = document.getElementById('settings-storage-value');
        const storageFill = document.getElementById('settings-storage-fill');

        if (storageValue) {
            storageValue.textContent = `${formatBytes(usedBytes)} / ${formatBytes(limit)}`;
        }

        if (storageFill) {
            storageFill.style.width = `${percentage}%`;
            storageFill.className = 'user-settings-storage-fill';
            if (percentage > 90) {
                storageFill.classList.add('danger');
            } else if (percentage > 70) {
                storageFill.classList.add('warning');
            }
        }

    } catch (error) {
        console.error('[UserSettings] Error loading storage:', error);
    }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Save user settings
 */
async function saveUserSettings() {
    const user = window.getCurrentUser();
    if (!user) return;

    const nameInput = document.getElementById('settings-fullname');
    const emailInput = document.getElementById('settings-email');
    const professionSelect = document.getElementById('settings-profession');
    const saveBtn = document.getElementById('settings-save-btn');

    const newName = nameInput?.value.trim();
    const newEmail = emailInput?.value.trim();
    const newProfession = professionSelect?.value;

    // Validate
    if (!newName) {
        showSettingsMessage('Name cannot be empty', 'error');
        return;
    }

    if (!newEmail || !newEmail.includes('@')) {
        showSettingsMessage('Please enter a valid email address', 'error');
        return;
    }

    // Disable save button
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const supabase = window.getSupabase();

        // Check if email changed
        const emailChanged = newEmail !== originalUserData.email;

        // Update user metadata
        const { error: updateError } = await supabase.auth.updateUser({
            email: emailChanged ? newEmail : undefined,
            data: {
                full_name: newName,
                profession: newProfession
            }
        });

        if (updateError) {
            throw updateError;
        }

        // Update profile in database
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                display_name: newName,
                profession: newProfession
            })
            .eq('id', user.id);

        if (profileError) {
            console.warn('[UserSettings] Profile update error:', profileError);
        }

        // Update original data
        originalUserData.fullName = newName;
        originalUserData.profession = newProfession;

        if (emailChanged) {
            showSettingsMessage('Settings saved. A confirmation link was sent to your new email.', 'success');
        } else {
            showSettingsMessage('Settings saved.', 'success');
        }

        hasChanges = false;
        updateSaveButtonState();

        // Update sidebar user display
        updateSidebarUserDisplay(newName);

    } catch (error) {
        console.error('[UserSettings] Save error:', error);
        showSettingsMessage(error.message || 'Error saving settings', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    }
}

/**
 * Update sidebar user display
 */
function updateSidebarUserDisplay(name) {
    const userName = document.querySelector('.dashboard-user-name');
    const userAvatar = document.querySelector('.dashboard-user-avatar');

    if (userName) userName.textContent = name;
    if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
}

/**
 * Handle sign out
 */
async function handleSettingsSignOut() {
    if (!confirm('Are you sure you want to sign out?')) {
        return;
    }

    try {
        await window.signOut();
        hideUserSettings();

        // Show sign in screen
        if (window.showSignInScreen) {
            window.showSignInScreen();
        } else {
            location.reload();
        }
    } catch (error) {
        console.error('[UserSettings] Sign out error:', error);
        showSettingsMessage('Error signing out', 'error');
    }
}

/**
 * Handle avatar upload
 */
let currentCropper = null;

/**
 * Initialize Crop Modal
 */
function initCropModal() {
    const modal = document.getElementById('crop-modal');
    if (!modal) return;

    const saveBtn = document.getElementById('crop-save-btn');
    const cancelBtn = document.getElementById('crop-cancel-btn');
    const closeBtn = document.getElementById('crop-modal-close');

    if (saveBtn) saveBtn.onclick = saveCroppedAvatar;
    if (cancelBtn) cancelBtn.onclick = cancelCrop;
    if (closeBtn) closeBtn.onclick = cancelCrop;
}

/**
 * Handle avatar upload - Opens Cropper
 */
function handleAvatarUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Max 10MB source
        if (file.size > 10 * 1024 * 1024) {
            showSettingsMessage('Photo must be smaller than 10MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const image = document.getElementById('crop-image');
            const modal = document.getElementById('crop-modal');

            if (image && modal) {
                // Reset image
                image.src = '';
                image.src = e.target.result;
                modal.classList.add('show');

                // Initialize cropper
                if (currentCropper) {
                    currentCropper.destroy();
                }

                // Wait for image to load
                image.onload = () => {
                    currentCropper = new Cropper(image, {
                        aspectRatio: 1,
                        viewMode: 1,
                        dragMode: 'move',
                        autoCropArea: 1,
                        restore: false,
                        guides: true,
                        center: true,
                        highlight: false,
                        cropBoxMovable: true,
                        cropBoxResizable: true,
                        toggleDragModeOnDblclick: false,
                    });
                };
            }
        };
        reader.readAsDataURL(file);
    };

    input.click();
}

/**
 * Save cropped avatar
 */
async function saveCroppedAvatar() {
    if (!currentCropper) return;

    try {
        const user = window.getCurrentUser();
        const supabase = window.getSupabase();

        if (!user || !supabase) {
            showSettingsMessage('Session error. Please sign in again.', 'error');
            return;
        }

        const saveBtn = document.getElementById('crop-save-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        // Get cropped canvas
        const canvas = currentCropper.getCroppedCanvas({
            width: 512,
            height: 512,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        if (!canvas) {
            throw new Error('Canvas creation failed');
        }

        canvas.toBlob(async (blob) => {
            try {
                if (!blob) throw new Error('Blob creation failed');

                // Storage filename (always jpg)
                const fileName = `${user.id}.jpg`;

                // Upload to Supabase Storage
                const { data, error } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, blob, {
                        upsert: true,
                        contentType: 'image/jpeg',
                        cacheControl: '3600'
                    });

                if (error) throw error;

                // Get public URL with timestamp
                const { data: urlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                const publicUrl = urlData.publicUrl + '?t=' + Date.now();

                // Update user metadata
                const { error: updateError } = await supabase.auth.updateUser({
                    data: { avatar_url: publicUrl }
                });

                if (updateError) console.warn('[UserSettings] Metadata update error:', updateError);

                // Update display immediately
                const avatar = document.getElementById('settings-avatar');
                if (avatar) {
                    avatar.innerHTML = `<img src="${publicUrl}" alt="Avatar">`;
                }

                // Update across app
                const updatedUser = { ...user, user_metadata: { ...user.user_metadata, avatar_url: publicUrl } };
                if (window.updateAllAvatars) window.updateAllAvatars(updatedUser);

                showSettingsMessage('Profile photo updated', 'success');
                cancelCrop(); // Close modal

            } catch (error) {
                console.error('[UserSettings] Upload error:', error);

                let errorMsg = 'Error uploading photo';
                if (error.message?.includes('bucket') || error.statusCode === 404) {
                    errorMsg = 'Storage bucket not configured';
                } else if (error.message?.includes('permission') || error.statusCode === 403) {
                    errorMsg = 'Permission denied';
                }

                showSettingsMessage(errorMsg, 'error');
            } finally {
                // Reset button
                if (saveBtn) {
                    saveBtn.textContent = originalText;
                    saveBtn.disabled = false;
                }
            }
        }, 'image/jpeg', 0.85); // 85% quality

    } catch (error) {
        console.error('[UserSettings] Crop save error:', error);
        showSettingsMessage('Error saving photo', 'error');
        if (saveBtn) {
            saveBtn.textContent = 'Save Photo';
            saveBtn.disabled = false;
        }
    }
}

/**
 * Cancel/Close Crop Modal
 */
function cancelCrop() {
    const modal = document.getElementById('crop-modal');
    if (modal) {
        modal.classList.remove('show');
    }

    if (currentCropper) {
        currentCropper.destroy();
        currentCropper = null;
    }

    const image = document.getElementById('crop-image');
    if (image) image.src = '';
}

/**
 * Handle avatar delete
 */
async function handleAvatarDelete() {
    if (!confirm('Are you sure you want to delete your profile photo?')) {
        return;
    }

    try {
        const user = window.getCurrentUser();
        const supabase = window.getSupabase();

        // Remove from user metadata
        await supabase.auth.updateUser({
            data: { avatar_url: null }
        });

        // Update display
        const avatar = document.getElementById('settings-avatar');
        const fullName = user.user_metadata?.full_name || user.email || 'U';
        if (avatar) {
            avatar.innerHTML = '';
            avatar.textContent = fullName.charAt(0).toUpperCase();
        }

        showSettingsMessage('Profile photo deleted', 'success');

    } catch (error) {
        console.error('[UserSettings] Avatar delete error:', error);
        showSettingsMessage('Error deleting photo', 'error');
    }
}

/**
 * Show message
 */
function showSettingsMessage(text, type) {
    const msg = document.getElementById('settings-message');
    if (msg) {
        msg.textContent = text;
        msg.className = `user-settings-message show ${type}`;
    }
}

/**
 * Hide message
 */
function hideSettingsMessage() {
    const msg = document.getElementById('settings-message');
    if (msg) {
        msg.classList.remove('show');
    }
}

/**
 * Track changes
 */
function trackSettingsChanges() {
    const nameInput = document.getElementById('settings-fullname');
    const emailInput = document.getElementById('settings-email');
    const professionSelect = document.getElementById('settings-profession');

    const checkChanges = () => {
        const nameChanged = nameInput?.value !== originalUserData.fullName;
        const emailChanged = emailInput?.value !== originalUserData.email;
        const professionChanged = professionSelect?.value !== originalUserData.profession;

        hasChanges = nameChanged || emailChanged || professionChanged;
        updateSaveButtonState();
    };

    nameInput?.addEventListener('input', checkChanges);
    emailInput?.addEventListener('input', checkChanges);
    professionSelect?.addEventListener('change', checkChanges);
}

/**
 * Update save button state
 */
function updateSaveButtonState() {
    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn) {
        saveBtn.disabled = !hasChanges;
    }
}

/**
 * Initialize user settings
 */
function initUserSettings() {
    // Initialize crop modal events
    initCropModal();

    // Bind events for the legacy overlay (if it exists)
    const overlay = document.getElementById('user-settings-overlay');
    if (overlay) {
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hideUserSettings();
            }
        });

        // Close button
        const closeBtn = document.getElementById('user-settings-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', hideUserSettings);
        }
    }

    // Bind events for the settings panel in dashboard section
    const settingsPanel = document.getElementById('settings-panel');

    // Save button
    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveUserSettings);
    }

    // Sign out button
    const signOutBtn = document.getElementById('settings-signout-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSettingsSignOut);
    }

    // Avatar upload - use event delegation for reliability
    const uploadBtn = document.getElementById('settings-avatar-upload');
    if (uploadBtn) {
        // Remove any existing listeners and add fresh one
        uploadBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAvatarUpload();
        };
        console.log('[UserSettings] Avatar upload button bound');
    } else {
        console.warn('[UserSettings] Avatar upload button not found');
    }

    // Avatar delete
    const deleteBtn = document.getElementById('settings-avatar-delete');
    if (deleteBtn) {
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAvatarDelete();
        };
    }

    // Track changes
    trackSettingsChanges();

    // Escape key to close overlay
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('settings-overlay');
            if (overlay && overlay.classList.contains('show')) {
                hideSettingsOverlay();
            }
        }
    });

    // Auto-update avatars when user is available
    const user = window.getCurrentUser && window.getCurrentUser();
    if (user) {
        setTimeout(() => updateAllAvatars(user), 500);
    }

    // Listen for sidebar user section click
    const userSection = document.getElementById('dashboard-user-section');
    if (userSection) {
        userSection.addEventListener('click', () => {
            setTimeout(loadUserData, 100);
        });
    }
}

// Export functions
window.showUserSettings = showUserSettings;
window.hideUserSettings = hideUserSettings;
window.showSettingsPanel = showSettingsPanel;
window.showSettingsOverlay = showSettingsOverlay;
window.hideSettingsOverlay = hideSettingsOverlay;
window.updateAllAvatars = updateAllAvatars;
window.clearUserSectionActive = clearUserSectionActive;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initUserSettings, 200);
});

// Update avatars when auth state changes
window.addEventListener('authStateChanged', (e) => {
    const user = e.detail?.user;
    if (user) {
        updateAllAvatars(user);
    }
});
