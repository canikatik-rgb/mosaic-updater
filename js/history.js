/**
 * Action History Management
 * Handles undo/redo functionality for the mindmap
 */

// Main history manager
class ActionHistory {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50; // Limit stack size to prevent memory issues
        this.isPerformingAction = false; // Flag to prevent recording during undo/redo
    }

    // Add an action to the history
    addAction(action) {
        if (this.isPerformingAction) return; // Don't record actions during undo/redo

        // Add the action to the undo stack
        this.undoStack.push(action);

        // Clear redo stack when a new action is performed
        this.redoStack = [];

        // Limit stack size
        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift(); // Remove oldest action
        }

        // Update button states
        this.updateButtonStates();
    }

    // Undo the most recent action
    undo() {
        if (this.undoStack.length === 0) return;

        this.isPerformingAction = true;

        const action = this.undoStack.pop();
        this.redoStack.push(action);

        // Execute the undo operation
        action.undo();

        this.isPerformingAction = false;
        this.updateButtonStates();

        // Schedule auto-save after undo
        if (window.scheduleAutoSave) window.scheduleAutoSave();
    }

    // Redo the most recently undone action
    redo() {
        if (this.redoStack.length === 0) return;

        this.isPerformingAction = true;

        const action = this.redoStack.pop();
        this.undoStack.push(action);

        // Execute the redo operation
        action.redo();

        this.isPerformingAction = false;
        this.updateButtonStates();

        // Schedule auto-save after redo
        if (window.scheduleAutoSave) window.scheduleAutoSave();
    }

    // Update undo/redo button states based on stack availability
    updateButtonStates() {
        const undoBtn = document.getElementById('undo-button');
        const redoBtn = document.getElementById('redo-button');

        if (undoBtn) {
            undoBtn.disabled = this.undoStack.length === 0;
            undoBtn.classList.toggle('disabled', this.undoStack.length === 0);
        }

        if (redoBtn) {
            redoBtn.disabled = this.redoStack.length === 0;
            redoBtn.classList.toggle('disabled', this.redoStack.length === 0);
        }
    }

    // Clear history stacks
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.updateButtonStates();
    }
}

// Base action class
class Action {
    constructor(type) {
        this.type = type;
        this.timestamp = Date.now();
    }

    undo() {
        console.warn('Undo not implemented for this action type');
    }

    redo() {
        console.warn('Redo not implemented for this action type');
    }
}

// Node creation action
class NodeCreateAction extends Action {
    constructor(nodeId, position, content, nodeType, stripColor) {
        super('nodeCreate');
        this.nodeId = nodeId;
        this.position = position; // {x, y}
        this.content = content;
        this.nodeType = nodeType || 'default'; // Store node type
        this.stripColor = stripColor;         // Store strip color
    }

    undo() {
        const node = document.getElementById(this.nodeId);
        if (node) {
            // Use the existing node deletion code (we need to make sure 
            // deleteNode itself doesn't add another action to history)
            // Temporarily disable history recording during undo/redo is a good practice
            const wasPerformingAction = window.actionHistory ? window.actionHistory.isPerformingAction : false;
            if (window.actionHistory) window.actionHistory.isPerformingAction = true;

            if (window.deleteNode) {
                // Call a version of deleteNode or modify deleteNode 
                // to skip adding history action if isPerformingAction is true
                window.deleteNode(node);
            } else {
                // Fallback if deleteNode isn't available
                if (window.removeNodeConnections) {
                    window.removeNodeConnections(node);
                }
                node.remove();
            }

            if (window.actionHistory) window.actionHistory.isPerformingAction = wasPerformingAction;
        }
    }

    redo() {
        // Recreate the node using stored type and color
        if (window.createNode) {
            const wasPerformingAction = window.actionHistory ? window.actionHistory.isPerformingAction : false;
            if (window.actionHistory) window.actionHistory.isPerformingAction = true;

            const node = window.createNode(
                this.position.x,
                this.position.y,
                this.content,
                this.nodeType,     // Pass node type
                this.nodeId,       // Use the same ID
                this.stripColor    // Pass strip color
            );

            // No need to manually set color here, createNode handles it

            if (window.actionHistory) window.actionHistory.isPerformingAction = wasPerformingAction;
        }
    }
}

// Node deletion action
class NodeDeleteAction extends Action {
    constructor(nodeId, nodeData) {
        super('nodeDelete');
        this.nodeId = nodeId;
        // nodeData should now contain position, content, stripColor, nodeType, connections
        this.nodeData = nodeData;
    }

    undo() {
        // Recreate the deleted node using all captured data
        if (window.createNode) {
            const wasPerformingAction = window.actionHistory ? window.actionHistory.isPerformingAction : false;
            if (window.actionHistory) window.actionHistory.isPerformingAction = true;

            const node = window.createNode(
                this.nodeData.position.x,
                this.nodeData.position.y,
                this.nodeData.content,
                this.nodeData.nodeType,      // Pass captured node type
                this.nodeId,                 // Use the same ID
                this.nodeData.stripColor     // Pass captured strip color
            );

            // Recreate connections
            if (this.nodeData.connections && window.createFinalConnection) {
                this.nodeData.connections.forEach(conn => {
                    const startNode = document.getElementById(conn.startNodeId);
                    const endNode = document.getElementById(conn.endNodeId);
                    if (startNode && endNode) {
                        // Ensure createFinalConnection doesn't add its own history action during undo/redo
                        window.createFinalConnection(startNode, endNode, conn.startPin, conn.endPin);
                    }
                });
            }

            if (window.actionHistory) window.actionHistory.isPerformingAction = wasPerformingAction;
        }
    }

    redo() {
        const node = document.getElementById(this.nodeId);
        if (node) {
            const wasPerformingAction = window.actionHistory ? window.actionHistory.isPerformingAction : false;
            if (window.actionHistory) window.actionHistory.isPerformingAction = true;

            if (window.deleteNode) {
                // Ensure deleteNode doesn't add history action during redo
                window.deleteNode(node);
            } else {
                // Fallback
                if (window.removeNodeConnections) {
                    window.removeNodeConnections(node);
                }
                node.remove();
            }

            if (window.actionHistory) window.actionHistory.isPerformingAction = wasPerformingAction;
        }
    }
}

// Node move action
class NodeMoveAction extends Action {
    constructor(nodeId, oldPosition, newPosition) {
        super('nodeMove');
        this.nodeId = nodeId;
        this.oldPosition = oldPosition; // {x, y}
        this.newPosition = newPosition; // {x, y}
    }

    undo() {
        const node = document.getElementById(this.nodeId);
        if (node) {
            // Move node back to old position
            node.style.left = `${this.oldPosition.x}px`;
            node.style.top = `${this.oldPosition.y}px`;

            // Update connections
            if (window.updateNodeConnections) {
                window.updateNodeConnections();
            }
        }
    }

    redo() {
        const node = document.getElementById(this.nodeId);
        if (node) {
            // Move node to new position
            node.style.left = `${this.newPosition.x}px`;
            node.style.top = `${this.newPosition.y}px`;

            // Update connections
            if (window.updateNodeConnections) {
                window.updateNodeConnections();
            }
        }
    }
}

// Node content edit action
class NodeContentEditAction extends Action {
    constructor(nodeId, oldContent, newContent) {
        super('nodeContentEdit');
        this.nodeId = nodeId;
        this.oldContent = oldContent;
        this.newContent = newContent;
    }

    undo() {
        const node = document.getElementById(this.nodeId);
        if (node) {
            const contentDiv = node.querySelector('.content');
            if (contentDiv) {
                contentDiv.innerHTML = this.oldContent;
            }
        }
    }

    redo() {
        const node = document.getElementById(this.nodeId);
        if (node) {
            const contentDiv = node.querySelector('.content');
            if (contentDiv) {
                contentDiv.innerHTML = this.newContent;
            }
        }
    }
}

// Connection creation action
class ConnectionCreateAction extends Action {
    constructor(connectionData) {
        super('connectionCreate');
        this.connectionData = connectionData;
    }

    undo() {
        const startNode = document.getElementById(this.connectionData.startNodeId);
        const endNode = document.getElementById(this.connectionData.endNodeId);
        const connectionPath = document.querySelector(
            `.connection[data-start-node="${this.connectionData.startNodeId}"][data-end-node="${this.connectionData.endNodeId}"][data-start-pin="${this.connectionData.startPin}"][data-end-pin="${this.connectionData.endPin}"]`
        );

        if (connectionPath && connectionPath.parentNode) {
            connectionPath.parentNode.remove();
        }
    }

    redo() {
        const startNode = document.getElementById(this.connectionData.startNodeId);
        const endNode = document.getElementById(this.connectionData.endNodeId);

        if (startNode && endNode && window.createFinalConnection) {
            window.createFinalConnection(
                startNode,
                endNode,
                this.connectionData.startPin,
                this.connectionData.endPin
            );
        }
    }
}

// Connection deletion action
class ConnectionDeleteAction extends Action {
    constructor(connectionData) {
        super('connectionDelete');
        this.connectionData = connectionData;
    }

    undo() {
        const startNode = document.getElementById(this.connectionData.startNodeId);
        const endNode = document.getElementById(this.connectionData.endNodeId);

        if (startNode && endNode && window.createFinalConnection) {
            window.createFinalConnection(
                startNode,
                endNode,
                this.connectionData.startPin,
                this.connectionData.endPin
            );
        }
    }

    redo() {
        const connectionPath = document.querySelector(
            `.connection[data-start-node="${this.connectionData.startNodeId}"][data-end-node="${this.connectionData.endNodeId}"][data-start-pin="${this.connectionData.startPin}"][data-end-pin="${this.connectionData.endPin}"]`
        );

        if (connectionPath && connectionPath.parentNode) {
            connectionPath.parentNode.remove();
        }
    }
}

// Group deletion action (saves group metadata for restoration)
class GroupDeleteAction extends Action {
    constructor(groupId, groupData, nodeActions) {
        super('groupDelete');
        this.groupId = groupId;
        this.groupData = groupData; // {name, color, nodeIds, bounds}
        this.nodeActions = nodeActions; // Array of NodeDeleteAction for nodes in group
    }

    undo() {
        // First, restore all nodes
        if (this.nodeActions) {
            for (let i = this.nodeActions.length - 1; i >= 0; i--) {
                this.nodeActions[i].undo();
            }
        }

        // Then recreate the group with saved metadata
        if (window.createGroup && this.groupData) {
            // Get the restored nodes
            const nodes = this.groupData.nodeIds
                .map(id => document.getElementById(id))
                .filter(node => node !== null);

            if (nodes.length >= 2) {
                const nodeSet = new Set(nodes);
                const group = window.createGroup(
                    nodeSet,
                    this.groupData.name,
                    this.groupData.color
                );

                console.log('[GroupDeleteAction] Restored group:', this.groupId, 'with', nodes.length, 'nodes');
            }
        }
    }

    redo() {
        // Delete the group first (this will ungroup but not delete nodes)
        if (window.deleteGroup) {
            window.deleteGroup(this.groupId);
        }

        // Then delete all nodes
        if (this.nodeActions) {
            for (let i = 0; i < this.nodeActions.length; i++) {
                this.nodeActions[i].redo();
            }
        }
    }
}

// Node color change action
class NodeColorChangeAction extends Action {
    constructor(nodeIds, oldColors, newColor) {
        super('nodeColorChange');
        this.nodeIds = nodeIds;       // Array of node IDs
        this.oldColors = oldColors;   // Object: nodeId -> oldColor
        this.newColor = newColor;
    }

    undo() {
        this.nodeIds.forEach(id => {
            const node = document.getElementById(id);
            if (node) {
                const iconWrapper = node.querySelector('.node-icon-wrapper');
                const strip = node.querySelector('.strip');
                const oldColor = this.oldColors[id];
                if (iconWrapper) iconWrapper.style.backgroundColor = oldColor;
                if (strip) strip.style.backgroundColor = oldColor;
                node.dataset.color = oldColor;
            }
        });

        // Update connections if needed
        if (window.updateNodeConnections) {
            window.updateNodeConnections();
        }
    }

    redo() {
        this.nodeIds.forEach(id => {
            const node = document.getElementById(id);
            if (node) {
                const iconWrapper = node.querySelector('.node-icon-wrapper');
                const strip = node.querySelector('.strip');
                if (iconWrapper) iconWrapper.style.backgroundColor = this.newColor;
                if (strip) strip.style.backgroundColor = this.newColor;
                node.dataset.color = this.newColor;
            }
        });

        // Update connections if needed
        if (window.updateNodeConnections) {
            window.updateNodeConnections();
        }
    }
}

// Group ungroup action (for when a group is disbanded but nodes remain)
class GroupUngroupAction extends Action {
    constructor(groupId, groupData) {
        super('groupUngroup');
        this.groupId = groupId;
        this.groupData = groupData; // {name, color, nodeIds, bounds}
    }

    undo() {
        // Recreate the group
        if (window.createGroup && this.groupData) {
            const nodes = this.groupData.nodeIds
                .map(id => document.getElementById(id))
                .filter(node => node !== null);

            if (nodes.length >= 2) {
                const nodeSet = new Set(nodes);
                const wasPerformingAction = window.actionHistory ? window.actionHistory.isPerformingAction : false;
                if (window.actionHistory) window.actionHistory.isPerformingAction = true;

                window.createGroup(nodeSet, this.groupData.name, this.groupData.color);

                if (window.actionHistory) window.actionHistory.isPerformingAction = wasPerformingAction;
                console.log('[GroupUngroupAction] Restored group:', this.groupId);
            }
        }
    }

    redo() {
        // Delete the group (just ungroup, don't delete nodes)
        if (window.deleteGroup) {
            const wasPerformingAction = window.actionHistory ? window.actionHistory.isPerformingAction : false;
            if (window.actionHistory) window.actionHistory.isPerformingAction = true;

            window.deleteGroup(this.groupId);

            if (window.actionHistory) window.actionHistory.isPerformingAction = wasPerformingAction;
        }
    }
}

// Group of actions (for multiple nodes moved together, etc.)
class ActionGroup extends Action {
    constructor(type, actions) {
        super(type);
        this.actions = actions;
    }

    undo() {
        // Undo all actions in reverse order
        for (let i = this.actions.length - 1; i >= 0; i--) {
            this.actions[i].undo();
        }
    }

    redo() {
        // Redo all actions in original order
        for (let i = 0; i < this.actions.length; i++) {
            this.actions[i].redo();
        }
    }
}

// Initialize the history system
function initActionHistory() {
    console.log('Initializing action history system');

    // Create the global history manager
    window.actionHistory = new ActionHistory();

    // Create UI buttons for undo/redo
    createHistoryButtons();

    // Set up keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Undo: Ctrl+Z / Cmd+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            window.actionHistory.undo();
        }

        // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            window.actionHistory.redo();
        }
    });

    console.log('Action history system initialized');
}

// Create undo/redo buttons in the UI
function createHistoryButtons() {
    // Create container for the buttons
    const historyButtonsContainer = document.createElement('div');
    historyButtonsContainer.id = 'history-buttons';
    historyButtonsContainer.className = 'history-buttons';

    // Create undo button
    const undoButton = document.createElement('button');
    undoButton.id = 'undo-button';
    undoButton.className = 'history-button disabled';
    undoButton.title = 'Undo (Ctrl+Z)';
    undoButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>';
    undoButton.disabled = true;
    undoButton.addEventListener('click', () => {
        if (window.actionHistory) {
            window.actionHistory.undo();
        }
    });

    // Create redo button
    const redoButton = document.createElement('button');
    redoButton.id = 'redo-button';
    redoButton.className = 'history-button disabled';
    redoButton.title = 'Redo (Ctrl+Y)';
    redoButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>';
    redoButton.disabled = true;
    redoButton.addEventListener('click', () => {
        if (window.actionHistory) {
            window.actionHistory.redo();
        }
    });

    // Add buttons to container
    historyButtonsContainer.appendChild(undoButton);
    historyButtonsContainer.appendChild(redoButton);

    // Add container to the UI controls
    const uiContainer = document.getElementById('ui-controls-container');
    if (uiContainer) {
        uiContainer.appendChild(historyButtonsContainer);
    } else {
        // Add to body if UI container not found
        document.body.appendChild(historyButtonsContainer);
    }
}

// Create node data for saving state before deletion or saving
function captureNodeData(node) {
    if (!node) return null;

    // Get node position
    const x = parseFloat(node.style.left);
    const y = parseFloat(node.style.top);

    // Get node content
    let content = '';
    if (typeof node.getContentData === 'function') {
        // Use specific function if available (e.g., for checklist)
        content = node.getContentData();
        console.log(`Using getContentData for node ${node.id}, type ${node.dataset.nodeType || 'default'}`);
    } else {
        // Fallback to innerHTML for default or other types
        const contentDiv = node.querySelector('.content');
        content = contentDiv ? contentDiv.innerHTML : '';
        console.log(`Using innerHTML for node ${node.id}, type ${node.dataset.nodeType || 'default'}`);
    }

    // Get node color
    const strip = node.querySelector('.strip');
    // Ensure we get a valid color string, fallback to default if needed
    const stripColor = (strip && strip.style.backgroundColor) ? strip.style.backgroundColor : (window.stripColors ? window.stripColors[0] : '#c2f8cb');

    // Get node type
    const nodeType = node.dataset.nodeType || 'default';

    // Get node connections
    const nodeId = node.id;
    const connections = [];
    // Ensure connections.js functions are available
    if (window.getConnectionsForNode) { // Check if a helper exists
        connections = window.getConnectionsForNode(nodeId);
    } else { // Fallback to direct querySelector (might be less reliable)
        document.querySelectorAll(`.connection[data-start-node="${nodeId}"], .connection[data-end-node="${nodeId}"]`).forEach(connPath => {
            const conn = connPath.closest('.connection-container')?.querySelector('.connection'); // Get data from the path element
            if (conn?.dataset) {
                connections.push({
                    startNodeId: conn.dataset.startNode,
                    endNodeId: conn.dataset.endNode,
                    startPin: conn.dataset.startPin,
                    endPin: conn.dataset.endPin
                });
            }
        });
    }

    return {
        id: nodeId, // Include ID in the captured data
        position: { x, y },
        content,
        stripColor,
        nodeType, // Include node type
        connections,
        contentOnly: node.classList.contains('content-only-mode') // Capture content-only state
    };
}

// Export functions to global scope
window.initActionHistory = initActionHistory;
window.captureNodeData = captureNodeData;
window.ActionHistory = ActionHistory;
window.NodeCreateAction = NodeCreateAction;
window.NodeDeleteAction = NodeDeleteAction;
window.NodeMoveAction = NodeMoveAction;
window.NodeContentEditAction = NodeContentEditAction;
window.ConnectionCreateAction = ConnectionCreateAction;
window.ConnectionDeleteAction = ConnectionDeleteAction;
window.GroupDeleteAction = GroupDeleteAction;
window.NodeColorChangeAction = NodeColorChangeAction;
window.GroupUngroupAction = GroupUngroupAction;
window.ActionGroup = ActionGroup; 