/**
 * app-node-registry.js
 * Registers all V2 App Nodes by fetching their metadata.json
 * Single Source of Truth for Node Creation and Command Palette.
 */

(async function () {
    console.log('[AppNodeRegistry] Initializing V2 Node Registry from Metadata...');

    window.nodeTypeLoaders = window.nodeTypeLoaders || {};
    window.appNodeRegistry = []; // Initialize empty

    // List of foldernames to scan
    const nodeFolders = [
        'text_node',
        'checklist_node',
        'timer_node',
        'canvas_node',
        '3d_canvas_node',
        'qr_node',
        'html_embed_node',
        'url_node',
        'gallery_node',
        'code_editor_node',
        'doc_editor_node',
        'transform_node',
        'save_node',
        'color_node',
        'presentation_node'
    ];

    // Helper to fetch metadata
    async function fetchMetadata(type) {
        try {
            const response = await fetch(`node_types/${type}/metadata.json`);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const meta = await response.json();
            return { ...meta, type }; // Ensure type is present
        } catch (e) {
            console.warn(`[AppNodeRegistry] Failed to load metadata for ${type}:`, e);
            // Fallback? or Skip
            return null;
        }
    }

    // Load all metadata
    const promises = nodeFolders.map(type => fetchMetadata(type));
    const results = await Promise.all(promises);

    // Filter valid results and populate registry
    window.appNodeRegistry = results.filter(item => item !== null);

    // Register loaders immediately
    // Note: We register loaders for ALL folders even if metadata failed, 
    // because the code might exist even if metadata is missing/malformed.
    nodeFolders.forEach(type => {
        window.nodeTypeLoaders[type] = function (id, x, y, content, color, customData) {
            const data = customData || {};
            if (content) {
                data.content = content;
            }
            return window.nodeLoader.createNode(type, x, y, data, id);
        };
    });

    // Default aliasing
    window.nodeTypeLoaders['default'] = window.nodeTypeLoaders['text_node'];

    console.log(`[AppNodeRegistry] Registered ${window.appNodeRegistry.length} nodes with metadata.`);

    // Dispatch event to notify Command Palette and others
    window.dispatchEvent(new CustomEvent('registryLoaded', { detail: window.appNodeRegistry }));

})();
