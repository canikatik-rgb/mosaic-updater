
// Mock DOM and Window
const window = {
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
        console.log(`[Mock] renderGroup called for ${group.id} with ${group.nodeIds.length} nodes`);
        group.element = { style: {} };
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

// Simulate switchToProject logic for groups
function simulateSwitchToProject() {
    console.log('--- Starting Simulation ---');

    // 1. Clear MindMap (Mock)
    document.elements = {};
    window.groups.clear();
    console.log('[Mock] Cleared MindMap');

    // 2. Restore Nodes
    project.nodes.forEach(nodeData => {
        window.createNode(nodeData.x, nodeData.y, nodeData.content, 'default', nodeData.id, null);
    });

    // 3. Restore Groups
    if (Array.isArray(project.groups) && project.groups.length > 0) {
        console.log(`[Mock] Restoring ${project.groups.length} groups`);

        // Clear existing groups (again, as per code)
        window.groups.clear();

        project.groups.forEach(groupData => {
            // Verify nodes
            const validNodeIds = groupData.nodeIds.filter(id => document.getElementById(id));
            const missingNodes = groupData.nodeIds.filter(id => !document.getElementById(id));

            if (missingNodes.length > 0) {
                console.warn(`[Mock] Group "${groupData.name}" has missing nodes:`, missingNodes);
            } else {
                console.log(`[Mock] Group "${groupData.name}" all nodes found.`);
            }

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
}

simulateSwitchToProject();
