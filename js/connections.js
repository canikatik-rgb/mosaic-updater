/**
 * Connection Management
 * Handles creating, updating, and removing connections between nodes
 */

// Global connection variables
let currentConnection = null;
let startNode = null;
let startPin = null;
let isDraggingPin = false;
let isRemovingConnections = false;
let removalStart = null;
let foundIntersection = false;

let removalLineStart = null; // Add variable for removal line tracking

// Connection selection state
window.selectedConnection = null;

// Connection type constants
const CONNECTION_TYPES = {
    CURVED: 'curved',
    STRAIGHT: 'straight',
    SINGLE_ELBOW: 'single-elbow',
    MULTI_ELBOW: 'multi-elbow'
};
window.CONNECTION_TYPES = CONNECTION_TYPES;

// Global connections array for V2 NodeLoader routing
window.connections = window.connections || [];

window.clearConnections = () => {
    window.connections = [];
    console.log('[Connections] Cleared global connections array.');
};

// Start creating a connection from a pin
function startConnection(e, node, pin) {
    if (isRemovingConnections) return;

    e.stopPropagation();
    isDraggingPin = true;
    startNode = node;
    startPin = pin.classList.contains('left') ? 'left' : 'right';

    // Create SVG element for the connection
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '5'; // Below pins (z-index 10) but above other elements

    // Create path element for the connection line
    currentConnection = document.createElementNS("http://www.w3.org/2000/svg", "path");
    currentConnection.setAttribute('stroke', 'var(--connection-color)');
    currentConnection.setAttribute('stroke-width', '2');
    currentConnection.setAttribute('fill', 'none');
    svg.appendChild(currentConnection);

    // Add to canvas-content instead of canvas
    document.getElementById('canvas-content').appendChild(svg);

    // Add event listeners for updating and finishing the connection
    document.addEventListener('mousemove', updateConnection);
    document.addEventListener('mouseup', finishConnection);

    // Cursor style for connection mode
    document.body.classList.add('connecting');

    // Update the connection initially if mouse position is available
    if (e && e.clientX) {
        updateConnection(e);
    }
}

// Update the connection path while dragging
function updateConnection(e) {
    if (!isDraggingPin || !currentConnection) return;

    // Get canvas position accounting for scaling and panning
    const canvasPosition = window.getCanvasPosition(e);

    // Calculate start point based on pin position
    const startX = (startPin === 'left') ?
        parseInt(startNode.style.left) :
        parseInt(startNode.style.left) + startNode.offsetWidth;
    const startY = parseInt(startNode.style.top) + startNode.offsetHeight / 2;

    // End point is the current mouse position
    const endX = canvasPosition.x;
    const endY = canvasPosition.y;

    // Calculate the curve control points
    const dx = Math.abs(endX - startX) / 2;
    let cp1X, cp2X;

    if (startPin === 'left') {
        cp1X = startX - dx;
        cp2X = endX + dx;
    } else {
        cp1X = startX + dx;
        cp2X = endX - dx;
    }

    // Set the path data for the bezier curve
    const pathData = `M ${startX},${startY} C ${cp1X},${startY} ${cp2X},${endY} ${endX},${endY}`;
    currentConnection.setAttribute('d', pathData);
}

// Finish creating a connection when mouse is released
function finishConnection(e) {
    if (!isDraggingPin) return;

    // Find if we're hovering over a node or a pin
    const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
    const pinElement = elementUnderMouse?.closest('.pin');
    let endNode = pinElement ? pinElement.closest('.node') : null;

    // If we're not directly over a pin, check if we're over a node
    if (!endNode) {
        endNode = elementUnderMouse?.closest('.node');
    }

    // Only create connection if end node exists and is different from start node
    if (endNode && endNode !== startNode) {
        // Determine which pin to connect to based on the relative position
        let endPin;

        if (pinElement) {
            // If dropped on a pin, use that pin
            endPin = pinElement.classList.contains('left') ? 'left' : 'right';
        } else {
            // Otherwise determine the best pin based on position
            const endNodeRect = endNode.getBoundingClientRect();
            const endNodeCenterX = endNodeRect.left + endNodeRect.width / 2;

            // Default pin assignment
            endPin = (startPin === 'left') ? 'right' : 'left';

            // Adjust if needed based on relative positions
            if (startPin === 'left' && e.clientX < endNodeCenterX) {
                endPin = 'left';
            } else if (startPin === 'right' && e.clientX > endNodeCenterX) {
                endPin = 'right';
            }
        }

        createFinalConnection(startNode, endNode, startPin, endPin);
    } else {
        // No valid end node - create a new node at the mouse position
        // Get the canvas position for the new node
        const canvasPosition = window.getCanvasPosition(e);

        // Create new node at mouse position
        if (window.createNode) {
            // Create a node with default content in the current language
            // Explicitly use 'text_node' as requested by user
            const newNode = window.createNode(
                canvasPosition.x,
                canvasPosition.y,
                null, // content
                'text_node' // type
            );

            // Copy color from source node if possible
            if (startNode) {
                const sourceStrip = startNode.querySelector('.strip');
                const targetStrip = newNode.querySelector('.strip');
                if (sourceStrip && targetStrip && window.setStripColor) {
                    const sourceColor = sourceStrip.style.backgroundColor;
                    if (sourceColor) {
                        window.setStripColor(targetStrip, sourceColor);
                    }
                }

                // Copy visibility mode (content-only-mode) from source node if it has that mode
                if (startNode.classList.contains('content-only-mode')) {
                    newNode.classList.add('content-only-mode');

                    // Update the visibility toggle icon if it exists
                    const visibilityToggle = newNode.querySelector('.node-visibility-toggle');
                    if (visibilityToggle) {
                        const icon = visibilityToggle.querySelector('i');
                        if (icon) {
                            icon.classList.remove('fa-eye');
                            icon.classList.add('fa-eye-slash');
                            visibilityToggle.title = 'Show node frame';
                        }
                    }
                }
            }

            // Determine which pin to connect to based on the source pin
            const endPin = (startPin === 'left') ? 'right' : 'left';

            // Create connection between source node and new node
            createFinalConnection(startNode, newNode, startPin, endPin);

            console.log('Created new node at mouse position with connection from source node');
        }
    }

    // Clean up temporary connection
    if (currentConnection && currentConnection.parentNode) {
        currentConnection.parentNode.remove();
    }

    // Reset connection variables
    isDraggingPin = false;
    currentConnection = null;
    startNode = null;
    startPin = null;

    // Remove event listeners
    document.removeEventListener('mousemove', updateConnection);
    document.removeEventListener('mouseup', finishConnection);

    // Reset cursor
    document.body.classList.remove('connecting');
}

// Create the final connection between two nodes
function createFinalConnection(startNode, endNode, startPin, endPin) {
    // Check if connection already exists between these nodes with these pins
    const existingConnections = document.querySelectorAll('.connection');
    for (const conn of existingConnections) {
        if ((conn.dataset.startNode === startNode.id &&
            conn.dataset.endNode === endNode.id &&
            conn.dataset.startPin === startPin &&
            conn.dataset.endPin === endPin) ||
            (conn.dataset.startNode === endNode.id &&
                conn.dataset.endNode === startNode.id &&
                conn.dataset.startPin === endPin &&
                conn.dataset.endPin === startPin)) {
            // Connection already exists, don't create a duplicate
            return null;
        }
    }

    // Create connection SVG container
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add('connection-container');
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '5';

    // Create the connection path (Visible line)
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add('connection');
    path.setAttribute('stroke', 'var(--connection-color)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');

    // Create hit path (Invisible, wide click area)
    const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitPath.classList.add('connection-hit-path');

    // Store node and pin info as data attributes on both paths
    [path, hitPath].forEach(p => {
        p.dataset.startNode = startNode.id;
        p.dataset.endNode = endNode.id;
        p.dataset.startPin = startPin;
        p.dataset.endPin = endPin;
        p.dataset.connectionType = CONNECTION_TYPES.CURVED; // Default type
    });

    // Link paths together reference
    hitPath.visiblePath = path;
    path.hitPath = hitPath;

    // Add click handler to hit path
    hitPath.addEventListener('click', (e) => {
        e.stopPropagation();
        // Pass shift key for multi-select
        const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
        selectConnection(path, isMulti); // Select the visible path
    });

    // Add paths to SVG (ordered: hit path on top of visible path visually via z-index, but in DOM order matters less due to CSS z-index)
    // Actually, appending hitPath AFTER path ensures it's on top in SVG rendering order (if no z-index)
    svg.appendChild(path);
    svg.appendChild(hitPath);

    // Add SVG to canvas
    document.getElementById('canvas-content').appendChild(svg);

    // Update the path immediately
    updateConnectionPath(path);

    // Update global connections array (Critical for NodeLoader)
    window.connections.push({
        source: startNode.id,
        target: endNode.id,
        sourcePin: startPin,
        targetPin: endPin,
        connectionType: CONNECTION_TYPES.CURVED // Default type
    });

    console.log('[Connections] Added connection:', { source: startNode.id, target: endNode.id });

    // Add to action history
    if (window.actionHistory && !window.actionHistory.isPerformingAction) {
        const connectionData = {
            startNodeId: startNode.id,
            endNodeId: endNode.id,
            startPin: startPin,
            endPin: endPin
        };

        const action = new window.ConnectionCreateAction(connectionData);
        window.actionHistory.addAction(action);
    }

    // Trigger node system update
    if (window.nodeSystem && window.nodeSystem.updateNodeInputs) {
        window.nodeSystem.updateNodeInputs(endNode.id);
    }

    // NEW: Trigger data card repropagation to ensure immediate data flow
    if (window.dataCardStore && window.dataCardStore.repropagateNodeOutputs) {
        window.dataCardStore.repropagateNodeOutputs(startNode.id);
    }

    // Schedule auto-save after creating a connection
    if (window.scheduleAutoSave) window.scheduleAutoSave();

    // Update viewport visibility
    if (window.viewportManager) {
        window.viewportManager.scheduleUpdate();
    }

    // Broadcast connection creation for P2P sync
    if (window.p2pManager && window.p2pManager.connections.size > 0 && !window._applyingRemoteChange) {
        window.p2pManager.broadcast({
            type: 'connection-create',
            sourceNodeId: startNode.id,
            targetNodeId: endNode.id,
            sourcePin: startPin,
            targetPin: endPin
        });
    }

    return path;
}

// Update the positions of all connections
function updateNodeConnections() {
    const connections = document.querySelectorAll('.connection');
    connections.forEach(updateConnectionPath);
}

// Update connections for a specific node
function updateNodeConnectionsForNode(node) {
    if (!node) return;

    const nodeId = node.id;
    const connections = document.querySelectorAll(`.connection[data-start-node="${nodeId}"], .connection[data-end-node="${nodeId}"]`);
    connections.forEach(updateConnectionPath);
}

// Remove all connections associated with a node
function removeNodeConnections(node) {
    if (!node) return;

    const nodeId = node.id;
    const connections = document.querySelectorAll(`.connection[data-start-node="${nodeId}"], .connection[data-end-node="${nodeId}"]`);

    connections.forEach(conn => {
        const targetId = conn.dataset.endNode;
        if (conn.parentNode) {
            conn.parentNode.remove();
        }

        // Notify target node if it's not the one being deleted
        if (targetId !== nodeId && window.nodeSystem) {
            if (window.nodeSystem.triggerNodeDisconnect) {
                window.nodeSystem.triggerNodeDisconnect(targetId, conn.dataset.startNode);
            }
            if (window.nodeSystem.updateNodeInputs) {
                window.nodeSystem.updateNodeInputs(targetId);
            }
        }
    });

    // Update global connections array
    window.connections = window.connections.filter(conn => conn.source !== nodeId && conn.target !== nodeId);
    console.log('[Connections] Connections updated after removal, count:', window.connections.length);
}

// Update position of a specific connection
function updateConnectionPath(connection) {
    const startNode = document.getElementById(connection.dataset.startNode);
    const endNode = document.getElementById(connection.dataset.endNode);

    if (!startNode || !endNode) {
        // If either node is missing, remove the connection
        if (connection.parentNode) {
            connection.parentNode.remove();
        }
        return;
    }

    // Calculate start point
    const startX = (connection.dataset.startPin === 'left') ?
        parseInt(startNode.style.left) :
        parseInt(startNode.style.left) + startNode.offsetWidth;
    const startY = parseInt(startNode.style.top) + startNode.offsetHeight / 2;

    // Calculate end point
    const endX = (connection.dataset.endPin === 'left') ?
        parseInt(endNode.style.left) :
        parseInt(endNode.style.left) + endNode.offsetWidth;
    const endY = parseInt(endNode.style.top) + endNode.offsetHeight / 2;

    // Get connection type (default to curved)
    const connectionType = connection.dataset.connectionType || CONNECTION_TYPES.CURVED;

    // Generate path based on type
    let pathData;
    switch (connectionType) {
        case CONNECTION_TYPES.STRAIGHT:
            pathData = generateStraightPath(startX, startY, endX, endY);
            break;
        case CONNECTION_TYPES.SINGLE_ELBOW:
            pathData = generateSingleElbowPath(startX, startY, endX, endY, connection.dataset.startPin, connection.dataset.endPin);
            break;
        case CONNECTION_TYPES.MULTI_ELBOW:
            pathData = generateMultiElbowPath(startX, startY, endX, endY, connection.dataset.startPin, connection.dataset.endPin);
            break;
        case CONNECTION_TYPES.CURVED:
        default:
            pathData = generateCurvedPath(startX, startY, endX, endY, connection.dataset.startPin, connection.dataset.endPin);
            break;
    }

    connection.setAttribute('d', pathData);

    // Update hit path if it exists
    if (connection.hitPath) {
        connection.hitPath.setAttribute('d', pathData);
    }
}

// Path generator: Curved (Bezier) - Original style
function generateCurvedPath(startX, startY, endX, endY, startPin, endPin) {
    const dx = Math.abs(endX - startX) / 2;
    let cp1X, cp2X;

    if (startPin === 'left') {
        cp1X = startX - dx;
    } else {
        cp1X = startX + dx;
    }

    if (endPin === 'left') {
        cp2X = endX - dx;
    } else {
        cp2X = endX + dx;
    }

    return `M ${startX},${startY} C ${cp1X},${startY} ${cp2X},${endY} ${endX},${endY}`;
}

// Path generator: Straight line
function generateStraightPath(startX, startY, endX, endY) {
    return `M ${startX},${startY} L ${endX},${endY}`;
}

// Path generator: Single Elbow (one 90° turn with rounded corner)
function generateSingleElbowPath(startX, startY, endX, endY, startPin, endPin) {
    const radius = 8; // Corner radius

    // Determine turn direction based on relative positions
    const goingRight = (startPin === 'right');
    const targetLeft = (endPin === 'left');

    // Calculate midpoint X (where the turn happens)
    const midX = (startX + endX) / 2;

    // For right-to-left or left-to-right connections
    if ((goingRight && targetLeft) || (!goingRight && !targetLeft)) {
        // Horizontal first, then vertical
        const turnX = midX;
        const turnY = startY;

        // Direction vectors
        const hDir = endX > startX ? 1 : -1;
        const vDir = endY > startY ? 1 : -1;

        // Clamp radius to prevent overlap
        const maxRadius = Math.min(radius, Math.abs(endX - startX) / 2, Math.abs(endY - startY) / 2);
        const r = Math.max(0, maxRadius);

        if (r > 0 && Math.abs(endY - startY) > r * 2) {
            // With rounded corner
            return `M ${startX},${startY} ` +
                `L ${turnX - hDir * r},${startY} ` +
                `Q ${turnX},${startY} ${turnX},${startY + vDir * r} ` +
                `L ${turnX},${endY - vDir * r} ` +
                `Q ${turnX},${endY} ${turnX + hDir * r},${endY} ` +
                `L ${endX},${endY}`;
        } else {
            // Sharp corner (no room for radius)
            return `M ${startX},${startY} L ${turnX},${startY} L ${turnX},${endY} L ${endX},${endY}`;
        }
    } else {
        // Vertical first, then horizontal
        const turnX = startX;
        const turnY = (startY + endY) / 2;

        const hDir = endX > startX ? 1 : -1;
        const vDir = endY > startY ? 1 : -1;

        const maxRadius = Math.min(radius, Math.abs(endX - startX) / 2, Math.abs(endY - startY) / 2);
        const r = Math.max(0, maxRadius);

        if (r > 0) {
            return `M ${startX},${startY} ` +
                `L ${startX},${turnY - vDir * r} ` +
                `Q ${startX},${turnY} ${startX + hDir * r},${turnY} ` +
                `L ${endX - hDir * r},${turnY} ` +
                `Q ${endX},${turnY} ${endX},${turnY + vDir * r} ` +
                `L ${endX},${endY}`;
        } else {
            return `M ${startX},${startY} L ${startX},${turnY} L ${endX},${turnY} L ${endX},${endY}`;
        }
    }
}

// Path generator: Multi-Elbow (dynamic steps based on distance)
function generateMultiElbowPath(startX, startY, endX, endY, startPin, endPin) {
    const radius = 8; // Corner radius
    const minStepHeight = 40; // Minimum vertical distance for a step

    // Direction based on pin positions
    const startDir = (startPin === 'right') ? 1 : -1;
    const endDir = (endPin === 'left') ? -1 : 1;

    const dx = endX - startX;
    const dy = endY - startY;
    const absDy = Math.abs(dy);

    // Determine number of steps based on vertical distance
    // More steps for longer vertical distances
    let steps = 1;
    if (absDy > 150) steps = 2;
    if (absDy > 300) steps = 3;

    // Initial offset from pins
    const startOffset = 30 * startDir;
    const endOffset = 30 * endDir;

    let path = `M ${startX},${startY}`;
    let currentX = startX;
    let currentY = startY;

    // 1. First horizontal move away from start pin
    let nextX = startX + startOffset;
    path += lineTo(nextX, currentY);
    currentX = nextX;

    // Calculate vertical step size
    const totalV = endY - startY;
    const stepV = totalV / (steps + 1); // +1 because we need to reach the end too

    // Zig-zag generation
    for (let i = 0; i < steps; i++) {
        // Vertical move
        let nextY = startY + (stepV * (i + 1));

        // Horizontal move destination (zigzag)
        // If it's the last step, align with end connection point (minus offset)
        // Otherwise, oscillate around the center
        let nextHorizX;
        if (i === steps - 1) {
            nextHorizX = endX + endOffset;
        } else {
            // Oscillate X roughly between start and end
            const progress = (i + 1) / steps;
            nextHorizX = startX + (dx * progress) + (i % 2 === 0 ? 20 : -20);
        }

        // Draw Corner 1 (Vertical start)
        path += cornerTo(currentX, nextY, radius);
        currentY = nextY;

        // Draw Corner 2 (Horizontal starts)
        path += cornerTo(nextHorizX, currentY, radius);
        currentX = nextHorizX;
    }

    // Final vertical move to align with end Y
    path += cornerTo(currentX, endY, radius);
    currentY = endY;

    // Final horizontal move to end pin
    path += cornerTo(endX, endY, radius);

    return path;
}

// Helper to draw a line to a point (simplifies string concat)
function lineTo(x, y) {
    return ` L ${x},${y}`;
}

// Helper to draw a rounded corner to a destination point
// This assumes we are moving either purely horizontally or vertically to reaching (x,y)
// But corners need 3 points: Current, Corner, Destination.
// This helper is a bit complex for general use, let's stick to explicit SVG commands in the main loop for clarity
// actually, let's rewrite the generator loop to be more robust with explicit segments
// Re-implementing generateMultiElbowPath completely with a simpler segment list approach

function generateMultiElbowPath(startX, startY, endX, endY, startPin, endPin) {
    const r = 8; // Radius
    const startDir = (startPin === 'right') ? 1 : -1;
    const endDir = (endPin === 'left') ? -1 : 1;

    // Define key points
    const pts = [];
    pts.push({ x: startX, y: startY });

    const pad = 30;
    const dy = endY - startY;

    // Logic: 
    // 1. Move out from start
    pts.push({ x: startX + pad * startDir, y: startY });

    // 2. Add intermediate steps
    if (Math.abs(dy) > 100) {
        const midY = startY + dy * 0.5;
        const midX = (startX + endX) * 0.5;

        // Step 1: Vert down to 1/3
        pts.push({ x: pts[pts.length - 1].x, y: startY + dy * 0.33 });
        // Step 2: Horiz to mid
        pts.push({ x: midX, y: pts[pts.length - 1].y });
        // Step 3: Vert down to 2/3
        pts.push({ x: midX, y: startY + dy * 0.66 });
        // Step 4: Horiz to align with end
        pts.push({ x: endX + pad * endDir, y: pts[pts.length - 1].y });
    } else {
        // Simple mid-point turn (classic, but works as 'multi' foundation)
        const midX = (startX + endX) / 2;
        pts.push({ x: midX, y: startY });
        pts.push({ x: midX, y: endY });
        pts.push({ x: endX + pad * endDir, y: endY });
    }

    // 3. Move into end
    pts.push({ x: endX + pad * endDir, y: endY });
    pts.push({ x: endX, y: endY });

    // Render points with rounded corners
    let d = `M ${pts[0].x},${pts[0].y}`;

    for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        const prev = pts[i - 1];

        // If not the last point, check if we can round the *next* corner?
        // Actually, easiest standard radius logic:
        // Draw line to (Target - radius), then Quadratic to Target

        // For this simple grid-like path, we can iterate and look at triplet (prev, curr, next)
        // But simpler: Just draw L to current point.
        // To do radius: Stop radius-distance short, then Q to next line start.

        d += ` L ${p.x},${p.y}`;
        // Note: Implementing true rounded corners on arbitrary polyline is complex script.
        // For now, let's use the explicit logic from before but expanded.
    }

    // Revert to the robust segment-based implementation for now to ensure no syntax errors,
    // but with the requested "more elbows" logic

    const startOffset = 30 * startDir;
    const endOffset = 30 * endDir;

    const absDy = Math.abs(endY - startY);

    // Just force a recognizable "stepped" look
    // Start -> Out -> Vert(1/3) -> Horiz(Mid) -> Vert(2/3) -> Out -> End

    const x1 = startX + startOffset;
    const y1 = startY;

    const y2 = startY + (endY - startY) * 0.33;
    const x2 = x1;

    const x3 = (startX + endX) / 2;
    const y3 = y2;

    const y4 = startY + (endY - startY) * 0.66;
    const x4 = x3;

    const x5 = endX + endOffset;
    const y5 = y4;

    const y6 = endY;
    const x6 = x5;

    // If distance is short, revert to simpler 2-elbow
    if (absDy < 80) {
        const midX = (startX + endX) / 2;
        return `M ${startX},${startY} ` +
            `L ${x1 - startDir * r},${startY} ` +
            `Q ${x1},${startY} ${x1},${startY + (y6 > y1 ? r : -r)} ` +
            `L ${x1},${y6 - (y6 > y1 ? r : -r)} ` +
            `Q ${x1},${y6} ${x1 + (x6 > x1 ? r : -r)},${y6} ` +
            `L ${endX},${endY}`;
    }

    // Prepare direction signs for radius
    const vDir = endY > startY ? 1 : -1;
    const hDir1 = x3 > x2 ? 1 : -1;
    const hDir2 = x5 > x4 ? 1 : -1;

    return `M ${startX},${startY} ` +
        `L ${x1},${y1} ` + // Out

        // Turn 1
        `L ${x2},${y2 - vDir * r} ` +
        `Q ${x2},${y2} ${x2 + hDir1 * r},${y2} ` +

        // To Mid
        `L ${x3 - hDir1 * r},${y3} ` +

        // Turn 2
        `Q ${x3},${y3} ${x3},${y3 + vDir * r} ` +

        // Down
        `L ${x4},${y4 - vDir * r} ` +

        // Turn 3 
        `Q ${x4},${y4} ${x4 + hDir2 * r},${y4} ` +

        // To End Align
        `L ${x5 - hDir2 * r},${y5} ` +

        // Turn 4
        `Q ${x5},${y5} ${x5},${y5 + vDir * r} ` +

        // Down to End Y
        `L ${x6},${y6} ` +

        `L ${endX},${endY}`;
}

// Initialize the connection removal mode
function initConnectionRemoval() {
    // Use the existing removal line SVG from the HTML instead of creating a new one
    const removalSvg = document.getElementById('removal-line');
    const removalPath = document.getElementById('removal-path');

    // Ensure the SVG is appended to the body to stay above all elements
    if (removalSvg && removalSvg.parentNode !== document.body) {
        document.body.appendChild(removalSvg);
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Alt') {
            isRemovingConnections = true;
            document.body.style.cursor = 'crosshair';

            const canvas = document.getElementById('canvas');
            canvas.addEventListener('mousedown', startRemoval);
        }
    });

    document.addEventListener('keyup', function (e) {
        if (e.key === 'Alt') {
            isRemovingConnections = false;
            document.body.style.cursor = '';

            const canvas = document.getElementById('canvas');
            canvas.removeEventListener('mousedown', startRemoval);

            // Hide the removal line
            removalPath.setAttribute('visibility', 'hidden');
            removalLineStart = null;
        }
    });

    function startRemoval(e) {
        if (!isRemovingConnections) return;

        removalLineStart = { x: e.clientX, y: e.clientY };
        removalPath.setAttribute('visibility', 'visible');
        updateRemovalLine(e);

        document.addEventListener('mousemove', updateRemoval);
        document.addEventListener('mouseup', finishRemoval);
    }

    function updateRemoval(e) {
        updateRemovalLine(e);
    }

    function finishRemoval(e) {
        if (removalLineStart) {
            const startX = (removalLineStart.x - window.canvasOffset.x) / window.canvasScale;
            const startY = (removalLineStart.y - window.canvasOffset.y) / window.canvasScale;
            const canvasPos = window.getCanvasPosition(e);
            const endX = canvasPos.x;
            const endY = canvasPos.y;

            removeIntersectingConnections(startX, startY, endX, endY);
        }

        removalPath.setAttribute('visibility', 'hidden');
        removalLineStart = null;

        document.removeEventListener('mousemove', updateRemoval);
        document.removeEventListener('mouseup', finishRemoval);
    }
}

// Function to update the removal line for connection deletion
function updateRemovalLine(e) {
    if (!removalLineStart) return;

    const line = document.getElementById('removal-path');
    if (!line) return;

    // Update line coordinates in screen space, not canvas space
    line.setAttribute('x1', removalLineStart.x);
    line.setAttribute('y1', removalLineStart.y);
    line.setAttribute('x2', e.clientX);
    line.setAttribute('y2', e.clientY);
}

// Remove intersecting connections when line is drawn across them
function removeIntersectingConnections(startX, startY, endX, endY) {
    let removed = false;
    const connections = document.querySelectorAll('.connection');
    let intersectingPaths = [];
    let removedConnections = [];

    connections.forEach(path => {
        if (doesLineIntersectPath(startX, startY, endX, endY, path)) {
            intersectingPaths.push(path);

            // Store connection data for undo/redo
            if (window.actionHistory) {
                removedConnections.push({
                    startNodeId: path.dataset.startNode,
                    endNodeId: path.dataset.endNode,
                    startPin: path.dataset.startPin,
                    endPin: path.dataset.endPin
                });
            }

            // Remove the connection SVG
            if (path.parentNode) {
                path.parentNode.remove();
            }

            // Notify target node
            // Notify target node
            const targetId = path.dataset.endNode;
            const sourceId = path.dataset.startNode;

            if (window.nodeSystem && window.nodeSystem.triggerNodeDisconnect) {
                window.nodeSystem.triggerNodeDisconnect(targetId, sourceId);
            }

            // Sync with global connections array (Critical for data flow control)
            window.connections = window.connections.filter(conn =>
                !(conn.source === sourceId && conn.target === targetId &&
                    conn.sourcePin === path.dataset.startPin && conn.targetPin === path.dataset.endPin)
            );
            console.log('[Connections] Removed connection via cut:', { source: sourceId, target: targetId });

            if (window.nodeSystem && window.nodeSystem.updateNodeInputs) {
                window.nodeSystem.updateNodeInputs(path.dataset.endNode);
            }

            removed = true;
        }
    });

    // Add to action history if connections were removed
    if (removedConnections.length > 0 && window.actionHistory) {
        const actions = removedConnections.map(conn =>
            new window.ConnectionDeleteAction(conn)
        );

        if (actions.length === 1) {
            window.actionHistory.addAction(actions[0]);
        } else if (actions.length > 1) {
            const groupAction = new window.ActionGroup('removeConnections', actions);
            window.actionHistory.addAction(groupAction);
        }
    }

    // Schedule auto-save if any connections were removed
    if (removed && window.scheduleAutoSave) {
        window.scheduleAutoSave();
    }

    // Broadcast connection deletions for P2P sync
    if (removedConnections.length > 0 && window.p2pManager && window.p2pManager.connections.size > 0 && !window._applyingRemoteChange) {
        removedConnections.forEach(conn => {
            window.p2pManager.broadcast({
                type: 'connection-delete',
                sourceNodeId: conn.startNodeId,
                targetNodeId: conn.endNodeId,
                sourcePin: conn.startPin,
                targetPin: conn.endPin
            });
        });
    }

    return removed;
}

// Helper function to check if a line intersects with a path
function doesLineIntersectPath(x1, y1, x2, y2, path) {
    // Use point sampling to check for intersection
    const points = getPointsAlongPath(path, 20);

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        if (linesIntersect(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y)) {
            return true;
        }
    }

    return false;
}

// Sample points along a SVG path for intersection testing
function getPointsAlongPath(path, numPoints) {
    const points = [];
    const pathLength = path.getTotalLength ? path.getTotalLength() : 1000;

    for (let i = 0; i <= numPoints; i++) {
        const point = path.getPointAtLength ? path.getPointAtLength(i * pathLength / numPoints) : { x: 0, y: 0 };
        points.push(point);
    }

    return points;
}

// Math helper function to detect line intersection
function linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    // Check if two line segments intersect
    const denominator = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));

    // Lines are parallel if denominator is zero
    if (denominator === 0) return false;

    const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
    const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denominator;

    // Return true if intersection point is within both line segments
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

// Initialize connection handler
function initConnections() {
    initConnectionRemoval();
    initConnectionSelection();
    console.log('Connection system initialized');
}

// Initialize connection selection system
function initConnectionSelection() {
    // Listen for clicks on canvas to deselect connections
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.addEventListener('click', (e) => {
            // Only deselect if clicking on canvas background, not on a connection
            if (!e.target.closest('.connection') && !e.target.closest('.node')) {
                deselectConnection();
            }
        });
    }
    console.log('[Connections] Selection system initialized');
}

// Select a connection
// Initialized multi-select set
if (!window.selectedConnections) {
    window.selectedConnections = new Set();
}

// Select a connection
function selectConnection(connectionPath, additive = false) {
    if (!connectionPath) return;

    // Default to handling shift key if not explicitly passed
    // But we need the event for that. Usually additive is passed as boolean.
    // If called without additive arg, check window.shiftKeyDown or similar if available,
    // but typically the caller (click handler) determines this.

    // Clear nodes whenever we select connections
    if (window.clearSelectedNodes && window.selectedNodes.size > 0) {
        window.clearSelectedNodes();
    }

    if (!additive) {
        // If not additive (Shift not held), clear other connections
        // BUT if clicking one that is ALREADY selected, we might adhere to standard behavior
        // Standard behavior: Click on selected -> Deselect others, keep this one.
        deselectConnection(); // Clear all
    }

    // Add to set
    window.selectedConnections.add(connectionPath);
    // Backward compatibility (keep one referenced)
    window.selectedConnection = connectionPath;

    connectionPath.classList.add('selected');

    // Dynamic Glow: Use the connection's color for the glow
    const strokeColor = connectionPath.getAttribute('stroke') || 'var(--connection-color)';
    // We set a property on the element that CSS can use
    // Since SVG elements might not inherit vars easily in all browsers, 
    // we can set the filter directly or use a scoped var if supported.
    // CSS variable approach:
    connectionPath.style.setProperty('--connection-glow', strokeColor);

    // Dispatch event for Action Bar
    window.dispatchEvent(new CustomEvent('connectionSelectionChanged', {
        detail: {
            connection: connectionPath,
            count: window.selectedConnections.size,
            selectedConnections: window.selectedConnections
        }
    }));

    console.log(`[Connections] Selection updated. Count: ${window.selectedConnections.size}`);
}

// Deselect current connection(s)
function deselectConnection(specificConnection = null) {
    if (specificConnection) {
        // Deselect specific
        specificConnection.classList.remove('selected');
        specificConnection.style.removeProperty('--connection-glow');
        window.selectedConnections.delete(specificConnection);
    } else {
        // Deselect ALL
        if (window.selectedConnections) {
            window.selectedConnections.forEach(conn => {
                conn.classList.remove('selected');
                conn.style.removeProperty('--connection-glow');
            });
            window.selectedConnections.clear();
        }
        window.selectedConnection = null;
    }

    // Dispatch event for Action Bar
    window.dispatchEvent(new CustomEvent('connectionSelectionChanged', {
        detail: {
            connection: null,
            count: window.selectedConnections ? window.selectedConnections.size : 0,
            selectedConnections: window.selectedConnections
        }
    }));
}

// Set connection type
function setConnectionType(connectionPath, type) {
    if (!type) { return; }

    const updateConn = (conn) => {
        if (!conn) return;
        conn.dataset.connectionType = type;
        if (conn.hitPath) {
            conn.hitPath.dataset.connectionType = type;
        }
        updateConnectionPath(conn);

        // Update global connections array
        const sourceId = conn.dataset.startNode;
        const targetId = conn.dataset.endNode;
        if (window.connections) {
            const data = window.connections.find(c => c.source === sourceId && c.target === targetId);
            if (data) data.connectionType = type;
        }

        // P2P Broadcast
        if (window.p2pManager && window.p2pManager.connections.size > 0 && !window._applyingRemoteChange) {
            window.p2pManager.broadcast({
                type: 'connection-type-change',
                sourceNodeId: sourceId,
                targetNodeId: targetId,
                connectionType: type
            });
        }
    };

    if (connectionPath) {
        updateConn(connectionPath);
    } else if (window.selectedConnections && window.selectedConnections.size > 0) {
        window.selectedConnections.forEach(updateConn);
    }

    if (window.scheduleAutoSave) window.scheduleAutoSave();
    console.log('[Connections] Set connection type:', type);
}

// Delete selected connection(s)
function deleteSelectedConnection() {
    let connectionsToDelete = [];

    if (window.selectedConnections && window.selectedConnections.size > 0) {
        connectionsToDelete = Array.from(window.selectedConnections);
    } else if (window.selectedConnection) {
        connectionsToDelete = [window.selectedConnection];
    }

    if (connectionsToDelete.length === 0) return;

    // Deselect logic handles UI cleanup, so we do it after gathering the list
    deselectConnection(); // Clear selection UI

    connectionsToDelete.forEach(conn => {
        const sourceId = conn.dataset.startNode;
        const targetId = conn.dataset.endNode;

        // History support would go here (omitted for brevity as it requires complex multi-action support)

        if (conn.parentNode) {
            // Trigger disconnect hooks
            if (window.nodeSystem && window.nodeSystem.triggerNodeDisconnect) {
                window.nodeSystem.triggerNodeDisconnect(targetId, sourceId);
            }
            conn.parentNode.remove();
        }

        // Update global connections array
        if (window.connections) {
            window.connections = window.connections.filter(c => !(c.source === sourceId && c.target === targetId));
        }
    });

    console.log(`[Connections] Deleted ${connectionsToDelete.length} connections.`);

    if (window.scheduleAutoSave) window.scheduleAutoSave();

    // Broadcast deletion (simplified - broadcast one by one or create bulk event)
    if (window.p2pManager && window.p2pManager.connections.size > 0 && !window._applyingRemoteChange) {
        // Can add broadcast logic here
    }
}

// Export functions to window scope
window.startConnection = startConnection;
window.updateNodeConnections = updateNodeConnections;
window.updateNodeConnectionsForNode = updateNodeConnectionsForNode;
window.removeNodeConnections = removeNodeConnections;
window.initConnections = initConnections;
window.updateRemovalLine = updateRemovalLine;
window.removeIntersectingConnections = removeIntersectingConnections;
window.selectConnection = selectConnection;
window.deselectConnection = deselectConnection;
window.setConnectionType = setConnectionType;
window.deleteSelectedConnection = deleteSelectedConnection;

// Function to get all node connections with their source and target IDs
window.getNodeConnections = function getNodeConnections() {
    const connections = document.querySelectorAll('.connection');
    const connectionData = [];

    connections.forEach(conn => {
        if (conn.dataset && conn.dataset.startNode && conn.dataset.endNode) {
            // Get connection color
            const color = conn.getAttribute('stroke') || 'var(--connection-color)';

            connectionData.push({
                source: conn.dataset.startNode,
                target: conn.dataset.endNode,
                startPin: conn.dataset.startPin,
                endPin: conn.dataset.endPin,
                color: color
            });
        }
    });

    return connectionData;
};

// Create a connection between two nodes by their IDs
window.createConnection = function createConnection(sourceNodeId, targetNodeId, sourcePin, targetPin, color) {
    const sourceNode = document.getElementById(sourceNodeId);
    const targetNode = document.getElementById(targetNodeId);

    if (!sourceNode || !targetNode) {
        console.error('Cannot create connection: Node(s) not found', sourceNodeId, targetNodeId);
        return null;
    }

    // Determine which pins to use based on the parameters
    let startPin = 'right'; // Default pins
    let endPin = 'left';

    if (sourcePin && targetPin) {
        // Use provided pins if they're DOM elements
        if (sourcePin instanceof Element && targetPin instanceof Element) {
            startPin = sourcePin.classList.contains('left') ? 'left' : 'right';
            endPin = targetPin.classList.contains('left') ? 'left' : 'right';
        } else if (typeof sourcePin === 'string' && typeof targetPin === 'string') {
            // Use provided pins as strings
            startPin = sourcePin;
            endPin = targetPin;
        }
    }

    // Create the connection
    const connection = createFinalConnection(sourceNode, targetNode, startPin, endPin);

    // Set color if provided
    if (connection && color) {
        connection.setAttribute('stroke', color);
    }

    return connection;
};

// Helper to rebuild connections index from DOM (Useful on load)
window.rebuildConnectionIndex = function () {
    window.connections = [];
    const conns = document.querySelectorAll('.connection');
    conns.forEach(conn => {
        if (conn.dataset.startNode && conn.dataset.endNode) {
            window.connections.push({
                source: conn.dataset.startNode,
                target: conn.dataset.endNode,
                sourcePin: conn.dataset.startPin,
                targetPin: conn.dataset.endPin
            });
        }
    });
    console.log('[Connections] Rebuilt index, count:', window.connections.length);
};

// Call immediately to catch any existing connections
window.rebuildConnectionIndex();

// Expose for NodeSystem
window.getNodeConnections = function () {
    return window.connections;
};

// =====================================================
// P2P Connection Event Handlers
// =====================================================

function initP2PConnectionHandlers() {
    if (!window.p2pManager) {
        setTimeout(initP2PConnectionHandlers, 500);
        return;
    }

    window.p2pManager.on((event, data) => {
        if (window._applyingRemoteChange) return;

        switch (event) {
            case 'connection-create':
                handleRemoteConnectionCreate(data);
                break;
            case 'connection-delete':
                handleRemoteConnectionDelete(data);
                break;
            case 'connection-type-change':
                handleRemoteConnectionTypeChange(data);
                break;
        }
    });

    console.log('[Connections] P2P handlers initialized');
}

function handleRemoteConnectionCreate(data) {
    const { sourceNodeId, targetNodeId, sourcePin, targetPin } = data;

    window._applyingRemoteChange = true;
    try {
        // Use the global createConnection function
        if (window.createConnection) {
            window.createConnection(sourceNodeId, targetNodeId, sourcePin, targetPin);
            console.log('[P2P] Created remote connection:', sourceNodeId, '->', targetNodeId);
        }
    } finally {
        window._applyingRemoteChange = false;
    }
}

function handleRemoteConnectionDelete(data) {
    const { sourceNodeId, targetNodeId, sourcePin, targetPin } = data;

    window._applyingRemoteChange = true;
    try {
        // Find and remove the connection
        const connections = document.querySelectorAll('.connection');
        connections.forEach(conn => {
            if (conn.dataset.startNode === sourceNodeId &&
                conn.dataset.endNode === targetNodeId &&
                conn.dataset.startPin === sourcePin &&
                conn.dataset.endPin === targetPin) {

                if (conn.parentNode) {
                    conn.parentNode.remove();
                }

                // Update global array
                window.connections = window.connections.filter(c =>
                    !(c.source === sourceNodeId && c.target === targetNodeId)
                );

                console.log('[P2P] Deleted remote connection:', sourceNodeId, '->', targetNodeId);
            }
        });
    } finally {
        window._applyingRemoteChange = false;
    }
}

function handleRemoteConnectionTypeChange(data) {
    const { sourceNodeId, targetNodeId, connectionType } = data;

    window._applyingRemoteChange = true;
    try {
        // Find the connection and update its type
        const connPath = document.querySelector(
            `.connection[data-start-node="${sourceNodeId}"][data-end-node="${targetNodeId}"]`
        );
        if (connPath && window.setConnectionType) {
            window.setConnectionType(connPath, connectionType);
            console.log('[P2P] Updated remote connection type:', sourceNodeId, '->', targetNodeId, 'to', connectionType);
        }
    } finally {
        window._applyingRemoteChange = false;
    }
}

// Initialize P2P handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initP2PConnectionHandlers, 1000);
});