// Debug script to simulate project restoration and check visibility

// Mock necessary globals if they don't exist
if (!window.projects) window.projects = [];
if (!window.nodeTypeLoaders) window.nodeTypeLoaders = {};
if (!window.stripColors) window.stripColors = ['#c2f8cb'];

// Mock DOM elements if running in a headless environment (though we are in browser tool)
if (!document.getElementById('canvas-content')) {
    const cc = document.createElement('div');
    cc.id = 'canvas-content';
    document.body.appendChild(cc);
}

console.log('--- START DEBUGGING ---');

// 1. Check Node Type Loaders
console.log('Checking nodeTypeLoaders:', Object.keys(window.nodeTypeLoaders));
if (!window.nodeTypeLoaders['default']) {
    console.error('FATAL: default node loader missing!');
}

// 2. Create a dummy project
const dummyProject = {
    id: 'debug-project',
    name: 'Debug Project',
    nodes: [
        { id: 'node-1', x: 100, y: 100, content: 'Node 1', type: 'default', color: '#c2f8cb' },
        { id: 'node-2', x: 400, y: 100, content: 'Node 2', type: 'default', color: '#c2f8cb' }
    ],
    connections: [],
    groups: [],
    canvasOffset: { x: 0, y: 0 },
    canvasScale: 1
};

window.projects.push(dummyProject);
const projectIndex = window.projects.length - 1;

// 3. Simulate switchToProject logic (simplified)
console.log('Simulating restoration...');

// Clear existing
document.getElementById('canvas-content').innerHTML = '';

// Restore nodes
dummyProject.nodes.forEach(nodeData => {
    console.log(`Creating node ${nodeData.id}...`);
    try {
        const node = window.createNode(
            nodeData.x,
            nodeData.y,
            nodeData.content,
            nodeData.type || 'default',
            nodeData.id,
            nodeData.color
        );
        if (node) {
            console.log(`Node ${node.id} created successfully. Parent: ${node.parentNode?.id}`);
            console.log(`Node style: left=${node.style.left}, top=${node.style.top}, display=${node.style.display}`);
        } else {
            console.error(`Failed to create node ${nodeData.id}`);
        }
    } catch (e) {
        console.error(`Error creating node ${nodeData.id}:`, e);
    }
});

// 4. Check Canvas Transform
if (window.updateCanvasTransform) {
    window.canvasOffset = dummyProject.canvasOffset;
    window.canvasScale = dummyProject.canvasScale;
    window.updateCanvasTransform();
    const cc = document.getElementById('canvas-content');
    console.log('Canvas Content Transform:', cc.style.transform);
} else {
    console.warn('updateCanvasTransform not found');
}

// 5. Check final DOM state
const nodeCount = document.querySelectorAll('.node').length;
console.log(`Total nodes in DOM: ${nodeCount}`);

if (nodeCount === 0) {
    console.error('FAIL: No nodes found in DOM after restoration.');
} else {
    console.log('SUCCESS: Nodes found in DOM.');
}

console.log('--- END DEBUGGING ---');
