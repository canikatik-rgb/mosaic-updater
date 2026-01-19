
// Mock Window and Document
const window = {
    isRestoringProject: false,
    groups: new Map(),
    stripColors: ['#c2f8cb'],
    canvasScale: 1,
    createNode: (x, y, content, type, id, color) => {
        console.log(`[Mock] createNode called for ${id}`);
        const node = {
            id: id,
            style: { left: x + 'px', top: y + 'px' },
            classList: {
                add: () => { },
                contains: () => false
            },
            querySelector: () => ({ style: {} })
        };
        document.elements[id] = node;
        return node;
    },
    renderGroup: (group) => {
        console.log(`[Mock] renderGroup called for ${group.id}`);
    },
    scheduleAutoSave: () => {
        if (window.isRestoringProject) {
            console.log("[Mock] scheduleAutoSave SKIPPED due to isRestoringProject flag.");
        } else {
            console.log("[Mock] scheduleAutoSave EXECUTED.");
        }
    },
    createFinalConnection: (startNode, endNode) => {
        console.log(`[Mock] createFinalConnection called between ${startNode.id} and ${endNode.id}`);
        // Simulate side effect of triggering auto-save
        window.scheduleAutoSave();
    },
    updateNodeConnections: () => { },
    actionHistory: {
        clear: () => { },
        isPerformingAction: false
    }
};

const document = {
    elements: {},
    getElementById: (id) => {
        return document.elements[id] || null;
    },
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add: () => { } }, appendChild: () => { } })
};

// Mock Project Data
const project = {
    name: 'Test Project',
    nodes: [
        { id: 'node-1', x: 100, y: 100, content: 'Node 1' },
        { id: 'node-2', x: 300, y: 100, content: 'Node 2' }
    ],
    connections: [
        { source: 'node-1', target: 'node-2' }
    ],
    groups: [
        {
            id: 'group-1',
            name: 'Group 1',
            color: '#FFD166',
            nodeIds: ['node-1', 'node-2'],
            bounds: { x: 80, y: 80, width: 300, height: 100 }
        }
    ]
};

// Simulate switchToProject logic with the fix
function simulateSwitchToProjectWithFix() {
    console.log('--- Starting Verification Simulation ---');

    // 1. Set Restoration Flag
    window.isRestoringProject = true;
    console.log('[Mock] isRestoringProject set to TRUE');

    try {
        // 2. Clear MindMap (Mock)
        document.elements = {};
        window.groups.clear();
        console.log('[Mock] Cleared MindMap');

        // 3. Restore Nodes
        project.nodes.forEach(nodeData => {
            window.createNode(nodeData.x, nodeData.y, nodeData.content, 'default', nodeData.id, null);
        });

        // 4. Restore Connections (Triggers Auto-Save)
        project.connections.forEach(connData => {
            const startNode = document.getElementById(connData.source);
            const endNode = document.getElementById(connData.target);
            if (startNode && endNode) {
                window.createFinalConnection(startNode, endNode);
            }
        });

        // 5. Restore Groups
        if (Array.isArray(project.groups) && project.groups.length > 0) {
            console.log(`[Mock] Restoring ${project.groups.length} groups`);
            window.groups.clear();

            project.groups.forEach(groupData => {
                const validNodeIds = groupData.nodeIds.filter(id => document.getElementById(id));
                const group = {
                    id: groupData.id,
                    name: groupData.name,
                    color: groupData.color,
                    nodeIds: validNodeIds,
                    bounds: groupData.bounds,
                    element: null
                };
                window.groups.set(group.id, group);
                window.renderGroup(group);
            });
        }

    } finally {
        // 6. Reset Restoration Flag
        window.isRestoringProject = false;
        console.log('[Mock] isRestoringProject set to FALSE');
    }
}

simulateSwitchToProjectWithFix();
