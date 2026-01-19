/**
 * Cloud Storage Module
 * Handles syncing Mosaic projects with Supabase
 */

/**
 * Save a project to cloud storage
 * @param {object} projectData - Project data including nodes, connections, etc.
 * @param {string} projectId - Optional existing project ID for updates
 * @returns {Promise<object>} Result with project ID or error
 */
async function saveProjectToCloud(projectData, projectId = null) {
    const supabase = window.getSupabase();
    const user = window.getCurrentUser();

    if (!supabase || !user) {
        return { error: { message: 'Not authenticated' } };
    }

    try {
        const projectRecord = {
            user_id: user.id,
            name: projectData.name || 'Untitled',
            data: {
                nodes: projectData.nodes || [],
                connections: projectData.connections || [],
                groups: projectData.groups || [],
                stickers: projectData.stickers || [],
                canvasOffset: projectData.canvasOffset,
                canvasScale: projectData.canvasScale
            },
            thumbnail: projectData.thumbnail || null,
            updated_at: new Date().toISOString()
        };

        let result;

        if (projectId) {
            // Update existing project
            const { data, error } = await supabase
                .from('projects')
                .update(projectRecord)
                .eq('id', projectId)
                .eq('user_id', user.id) // Extra safety check
                .select()
                .single();

            result = { data, error };
        } else {
            // Create new project
            const { data, error } = await supabase
                .from('projects')
                .insert(projectRecord)
                .select()
                .single();

            result = { data, error };
        }

        if (result.error) {
            console.error('[CloudStorage] Save error:', result.error);
            return { error: result.error };
        }

        console.log('[CloudStorage] Project saved:', result.data.id);
        return { data: result.data };
    } catch (error) {
        console.error('[CloudStorage] Save exception:', error);
        return { error: { message: error.message } };
    }
}

/**
 * Load a project from cloud storage
 * @param {string} projectId - Project ID
 * @returns {Promise<object>} Result with project data or error
 */
async function loadProjectFromCloud(projectId) {
    const supabase = window.getSupabase();
    const user = window.getCurrentUser();

    if (!supabase) {
        return { error: { message: 'Supabase not initialized' } };
    }

    try {
        // First try to load the project
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .maybeSingle(); // Use maybeSingle to avoid error if no result

        if (error) {
            console.error('[CloudStorage] Load error:', error);
            return { error };
        }

        if (!data) {
            // Project not found or no access - check if we're a collaborator
            console.log('[CloudStorage] Direct access denied, checking collaborator access...');

            // Check if user is a collaborator
            const userEmail = user?.email?.toLowerCase() || '';
            const { data: collabData } = await supabase
                .from('project_collaborators')
                .select('project_id')
                .eq('project_id', projectId)
                .or(`user_id.eq.${user?.id},email.ilike.${userEmail}`)
                .limit(1);

            if (!collabData || collabData.length === 0) {
                return { error: { message: 'Access denied - not owner or collaborator' } };
            }

            // User is collaborator, fetch project using RPC or service role
            // For now, try fetching again - RLS should allow it via collaborator policy
            console.log('[CloudStorage] User is collaborator, retrying fetch...');

            // This requires the RLS policy to be correctly configured
            // Let's try a direct query that RLS should allow
            const { data: projectData, error: projectError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (projectError || !projectData) {
                console.error('[CloudStorage] Collaborator fetch failed:', projectError);
                return { error: { message: 'Failed to load shared project. Check RLS policies.' } };
            }

            console.log('[CloudStorage] Shared project loaded:', projectData.name);
            return { data: projectData };
        }

        // Access check removed - RLS handles this
        // Collaborators should be able to access via RLS policy
        console.log('[CloudStorage] Project loaded:', data.name);
        return { data };
    } catch (error) {
        console.error('[CloudStorage] Load exception:', error);
        return { error: { message: error.message } };
    }
}

/**
 * List all projects for the current user
 * @returns {Promise<object>} Result with projects array or error
 */
async function listCloudProjects() {
    const supabase = window.getSupabase();
    const user = window.getCurrentUser();

    if (!supabase || !user) {
        return { error: { message: 'Not authenticated' } };
    }

    try {
        const { data, error } = await supabase
            .from('projects')
            .select('id, name, thumbnail, created_at, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('[CloudStorage] List error:', error);
            return { error };
        }

        console.log('[CloudStorage] Found', data.length, 'projects');
        return { data };
    } catch (error) {
        console.error('[CloudStorage] List exception:', error);
        return { error: { message: error.message } };
    }
}

/**
 * Delete a project from cloud storage
 * @param {string} projectId - Project ID
 * @returns {Promise<object>} Result with success or error
 */
async function deleteCloudProject(projectId) {
    const supabase = window.getSupabase();
    const user = window.getCurrentUser();

    if (!supabase || !user) {
        return { error: { message: 'Not authenticated' } };
    }

    try {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId)
            .eq('user_id', user.id);

        if (error) {
            console.error('[CloudStorage] Delete error:', error);
            return { error };
        }

        console.log('[CloudStorage] Project deleted:', projectId);
        return { success: true };
    } catch (error) {
        console.error('[CloudStorage] Delete exception:', error);
        return { error: { message: error.message } };
    }
}

/**
 * Auto-sync the current project to cloud (debounced)
 */
let autoSyncTimeout = null;
let currentCloudProjectId = null;

function scheduleAutoSync(projectData, delay = 5000) {
    if (!window.isAuthenticated || !window.isAuthenticated()) {
        return; // Don't sync if not logged in
    }

    // Clear existing timeout
    if (autoSyncTimeout) {
        clearTimeout(autoSyncTimeout);
    }

    // Schedule new sync
    autoSyncTimeout = setTimeout(async () => {
        console.log('[CloudStorage] Auto-syncing project...');
        const result = await saveProjectToCloud(projectData, currentCloudProjectId);

        if (result.data && !currentCloudProjectId) {
            currentCloudProjectId = result.data.id;
            console.log('[CloudStorage] Assigned cloud ID:', currentCloudProjectId);
        }
    }, delay);
}

/**
 * Set the current cloud project ID (used when opening cloud projects)
 * @param {string} projectId 
 */
function setCurrentCloudProjectId(projectId) {
    currentCloudProjectId = projectId;
}

/**
 * Get the current cloud project ID
 * @returns {string|null}
 */
function getCurrentCloudProjectId() {
    return currentCloudProjectId;
}

/**
 * List projects shared with the current user
 * Queries by both user_id AND email to catch pending invites
 * @returns {Promise<object>} Result with shared projects array or error
 */
async function listSharedProjects() {
    const supabase = window.getSupabase();
    const user = window.getCurrentUser();

    if (!supabase || !user) {
        return { data: [] };
    }

    try {
        // Normalize email to lowercase for matching
        const userEmail = user.email?.toLowerCase() || '';
        console.log('[CloudStorage] Listing shared projects for user:', user.id, 'email:', userEmail);

        // Get projects where user is a collaborator by user_id OR email (for pending invites)
        const { data, error } = await supabase
            .from('project_collaborators')
            .select(`
                id,
                project_id,
                role,
                user_id,
                email,
                invited_by,
                projects (
                    id,
                    name,
                    thumbnail,
                    created_at,
                    updated_at,
                    user_id
                )
            `)
            .or(`user_id.eq.${user.id},email.ilike.${userEmail}`)
            .neq('role', 'owner');

        if (error) {
            console.error('[CloudStorage] List shared error:', error);
            return { error };
        }

        console.log('[CloudStorage] Raw collaborator data:', data);

        // Transform data and fetch owner names
        const sharedProjects = [];
        for (const collab of data) {
            // Auto-claim: If matched by email but user_id is null, update it
            const collabEmail = collab.email?.toLowerCase() || '';
            if (collabEmail === userEmail && !collab.user_id) {
                console.log('[CloudStorage] Claiming email invite for project:', collab.project_id);
                await supabase
                    .from('project_collaborators')
                    .update({ user_id: user.id })
                    .eq('id', collab.id);
            }

            if (collab.projects) {
                // Get who shared this with us (invited_by), not the project owner
                let sharedByName = 'Unknown';
                const lookupId = collab.invited_by || collab.projects.user_id;

                if (lookupId) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('display_name')
                        .eq('id', lookupId)
                        .single();

                    sharedByName = profile?.display_name || 'Unknown';
                }

                sharedProjects.push({
                    ...collab.projects,
                    role: collab.role,
                    sharedBy: sharedByName,
                    storageType: 'shared'
                });
            }
        }

        console.log('[CloudStorage] Found', sharedProjects.length, 'shared projects');
        return { data: sharedProjects };
    } catch (error) {
        console.error('[CloudStorage] List shared exception:', error);
        return { error: { message: error.message } };
    }
}

// Export functions globally
window.saveProjectToCloud = saveProjectToCloud;
window.loadProjectFromCloud = loadProjectFromCloud;
window.listCloudProjects = listCloudProjects;
window.listSharedProjects = listSharedProjects;
window.deleteCloudProject = deleteCloudProject;
window.scheduleAutoSync = scheduleAutoSync;
window.setCurrentCloudProjectId = setCurrentCloudProjectId;
window.getCurrentCloudProjectId = getCurrentCloudProjectId;
