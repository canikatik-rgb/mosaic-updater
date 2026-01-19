/**
 * Node System
 * Handles the logical data flow between nodes.
 * This system allows nodes to register callbacks for data retrieval and updates.
 */

const nodeRegistry = new Map();

// Register a node's data handlers
// callbacks: {
//   getOutput: () => any, // Function to get data from this node
//   onInputUpdate: (inputId, data, sourceNodeId) => void // Function called when an input updates
// }
function registerNode(nodeId, callbacks) {
    nodeRegistry.set(nodeId, callbacks);
    // console.log(`[NodeSystem] Registered node: ${nodeId}`);
}

// Unregister a node
function unregisterNode(nodeId) {
    nodeRegistry.delete(nodeId);
    // console.log(`[NodeSystem] Unregistered node: ${nodeId}`);
}

// Get data from a specific node
function getNodeData(nodeId) {
    // 1. Try Registered App Nodes (New System)
    const callbacks = nodeRegistry.get(nodeId);
    if (callbacks && callbacks.getOutput) {
        return callbacks.getOutput();
    }

    // 2. Fallback: Extract from Legacy DOM Nodes
    const node = document.getElementById(nodeId);
    if (!node) return null;

    // Determine type and extract content
    const type = node.dataset.nodeType || 'default';

    // Safety check: If this is an App Node (has iframe) but not in registry yet,
    // DO NOT scrape its text content. It will be garbage.
    if (node.querySelector('iframe')) {
        // console.warn('[NodeSystem] Node has iframe but not registered yet. Waiting:', nodeId);
        return null; // Wait for registration
    }

    const contentDiv = node.querySelector('.content');

    // Text / Default Node
    if (type === 'default' || type === 'text') {
        const text = contentDiv.innerText.trim();
        console.log(`[NodeSystem] Extracted text from ${nodeId}: "${text}"`);
        // If it looks like a color?
        if (text.startsWith('#') && (text.length === 4 || text.length === 7)) return { type: 'color', value: text };
        return { type: 'text', value: text };
    }

    // Checklist
    if (type === 'checklist') {
        return { type: 'checklist', value: contentDiv.innerHTML };
    }

    // Canvas (Native legacy) - unlikely to output but good for completeness
    if (type === 'canvas') {
        return { type: 'image', value: node.querySelector('canvas')?.toDataURL() };
    }

    // Generic Fallback
    return { type: 'text', value: contentDiv.innerText };
}

// Trigger an update from a source node to its connected targets
function triggerNodeUpdate(sourceNodeId) {
    // console.log(`[NodeSystem] Triggering update from: ${sourceNodeId}`);

    // Get all connections
    // We assume window.getNodeConnections is available from connections.js
    if (!window.getNodeConnections) {
        console.warn('[NodeSystem] window.getNodeConnections not found');
        return;
    }

    const connections = window.getNodeConnections();

    // Get fresh data from source
    const data = getNodeData(sourceNodeId);

    // If data is null (e.g. pending App Node), do not propagate garbage or null.
    // We simply wait for the node to be ready and trigger another update then.
    if (!data) return;

    // Find connections where this node is the source
    connections.forEach(conn => {
        if (conn.source === sourceNodeId) {
            const targetNodeId = conn.target;
            const callbacks = nodeRegistry.get(targetNodeId);

            if (callbacks && callbacks.onInputUpdate) {
                // console.log(`[NodeSystem] Propagating to ${targetNodeId}`, data);
                callbacks.onInputUpdate(targetNodeId, data, sourceNodeId);
            }
        }
    });
}

// Map to store observers: nodeId -> MutationObserver
const nodeObservers = new Map();

// Start watching a legacy node for DOM changes
function startWatchingLegacyNode(nodeId) {
    if (nodeObservers.has(nodeId)) return; // Already watching

    const node = document.getElementById(nodeId);
    if (!node) return;

    // We only need to watch legacy nodes (those that don't have registered callbacks)
    if (nodeRegistry.has(nodeId)) return;

    const contentDiv = node.querySelector('.content');
    if (!contentDiv) return;

    // console.log(`[NodeSystem] Starting observer for ${nodeId}`);

    const observer = new MutationObserver((mutations) => {
        // Debounce? For now, raw updates for responsiveness (Timer needs 1s precision)
        triggerNodeUpdate(nodeId);
    });

    observer.observe(contentDiv, {
        characterData: true,
        childList: true,
        subtree: true,
        attributes: true, // In case style/class changes
        attributeFilter: ['style', 'class', 'value'] // Limit attributes
    });

    nodeObservers.set(nodeId, observer);
}

// Stop watching (when disconnected?)
// For now, we can leave them watching as it's low cost if no connections exist.
// But we should clean up if node is deleted.

// Force an update on a specific node (e.g. when a new connection is made)
function updateNodeInputs(targetNodeId) {
    console.log(`[NodeSystem] updateNodeInputs called for: ${targetNodeId}`);

    if (!window.getNodeConnections) {
        console.warn('[NodeSystem] getNodeConnections not available');
        return;
    }
    const connections = window.getNodeConnections();

    // Find all nodes connected TO this target node
    const incomingConnections = connections.filter(conn => conn.target === targetNodeId);
    console.log(`[NodeSystem] Found ${incomingConnections.length} incoming connections for ${targetNodeId}`);

    incomingConnections.forEach(conn => {
        const sourceNodeId = conn.source;
        console.log(`[NodeSystem] Processing connection from ${sourceNodeId} -> ${targetNodeId}`);

        const callbacks = nodeRegistry.get(targetNodeId);

        // 1. Start watching the source if it's legacy
        startWatchingLegacyNode(sourceNodeId);

        // 2. Propagate initial data
        if (callbacks && callbacks.onInputUpdate) {
            const data = getNodeData(sourceNodeId);
            console.log(`[NodeSystem] Retrieved data from ${sourceNodeId}:`, data ? 'Data Present' : 'Null');
            callbacks.onInputUpdate(targetNodeId, data, sourceNodeId);
        } else {
            console.warn(`[NodeSystem] No onInputUpdate callback registered for ${targetNodeId}`);
        }
    });
}

// Trigger a disconnect event to the target node
function triggerNodeDisconnect(targetNodeId, sourceNodeId) {
    // console.log(`[NodeSystem] Triggering disconnect: ${targetNodeId} < ${sourceNodeId}`);

    const callbacks = nodeRegistry.get(targetNodeId);
    if (callbacks && callbacks.onInputDisconnect) {
        callbacks.onInputDisconnect(targetNodeId, sourceNodeId);
    }
}

// Initialize the system
function initNodeSystem() {
    console.log('Node System Initialized');
}

// Reset the system (Clear all registries)
function resetNodeSystem() {
    nodeRegistry.clear();
    // Stop all observers
    nodeObservers.forEach(obs => obs.disconnect());
    nodeObservers.clear();
    console.log('[NodeSystem] System Reset (Registry and Observers cleared).');
}

// Expose globally
window.nodeSystem = {
    registerNode,
    unregisterNode,
    getNodeData,
    triggerNodeUpdate,
    updateNodeInputs,
    triggerNodeDisconnect,
    init: initNodeSystem,
    reset: resetNodeSystem
};
