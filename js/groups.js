/**
 * Group Management
 * Handles creation, rendering, and interaction with node groups
 */

// Global group variables
let groups = new Map(); // Map of groupId -> groupData
let selectedGroup = null;
let selectedGroups = new Set(); // Set of selected group objects
let isDraggingGroup = false;
let groupDragStartPos = {}; // Stores clientX, clientY, groupX, groupY, nodePositions
let groupCounter = 1;

// Group Data Structure
class Group {
    constructor(id, name, color, nodeIds = []) {
        this.id = id || `group-${Date.now()}-${groupCounter++}`;
        this.name = name || 'Untitled Group';
        this.color = color || '#FFD166';
        this.nodeIds = nodeIds;
        this.bounds = { x: 0, y: 0, width: 0, height: 0 };
        this.element = null;
    }
}

// Create a new group from selected nodes
function createGroup(nodeSet, name = null, color = null) {
    if (!nodeSet || nodeSet.size < 2) {
        console.warn('Cannot create group: need at least 2 nodes');
        return null;
    }

    // Check if any of the selected nodes are already in a group
    const nodeIds = Array.from(nodeSet).map(node => node.id);
    const alreadyGrouped = nodeIds.filter(nodeId => getGroupForNode(nodeId) !== null);

    if (alreadyGrouped.length > 0) {
        alert(getText('nodesAlreadyGrouped') || 'Some nodes are already in a group. Ungroup them first.');
        console.warn('Cannot create group: some nodes already grouped', alreadyGrouped);
        return null;
    }

    // Create group data
    const groupName = name || `Group ${groups.size + 1}`;
    const groupColor = color || window.stripColors[Math.floor(Math.random() * window.stripColors.length)];

    const group = new Group(null, groupName, groupColor, nodeIds);

    // Calculate bounds from nodes
    updateGroupBounds(group);

    // Store group
    groups.set(group.id, group);

    // Render group
    renderGroup(group);

    console.log(`Created group: ${group.id} with ${nodeIds.length} nodes`);

    // Schedule auto-save
    if (window.scheduleAutoSave) window.scheduleAutoSave();

    return group;
}

// Delete a group (but not its nodes)
function deleteGroup(groupId) {
    const group = groups.get(groupId);
    if (!group) return;

    // Capture group data for history BEFORE deletion
    const groupData = {
        name: group.name,
        color: group.color,
        nodeIds: [...group.nodeIds], // Copy array
        bounds: { ...group.bounds }
    };

    // Add to history (if not already performing an action)
    if (window.actionHistory && !window.actionHistory.isPerformingAction && window.GroupUngroupAction) {
        const action = new window.GroupUngroupAction(groupId, groupData);
        window.actionHistory.addAction(action);
        console.log('[deleteGroup] Added GroupUngroupAction for:', groupId);
    }

    // Remove DOM element
    if (group.element) {
        group.element.remove();
    }

    // Remove from groups map
    groups.delete(groupId);

    console.log(`Deleted group: ${groupId}`);

    // Clear selection if this group was selected
    if (selectedGroup === group) {
        selectedGroup = null;
    }

    // Schedule auto-save
    if (window.scheduleAutoSave) window.scheduleAutoSave();
}

// Add a node to an existing group
function addNodeToGroup(nodeId, groupId) {
    const group = groups.get(groupId);
    if (!group) return;

    if (!group.nodeIds.includes(nodeId)) {
        group.nodeIds.push(nodeId);
        updateGroupBounds(group);
        renderGroup(group);

        // Schedule auto-save
        if (window.scheduleAutoSave) window.scheduleAutoSave();
    }
}

// Remove a node from a group
function removeNodeFromGroup(nodeId, groupId) {
    const group = groups.get(groupId);
    if (!group) return;

    const index = group.nodeIds.indexOf(nodeId);
    if (index > -1) {
        group.nodeIds.splice(index, 1);

        // If group is empty or has only 1 node, delete it
        if (group.nodeIds.length < 2) {
            deleteGroup(groupId);
        } else {
            updateGroupBounds(group);
            renderGroup(group);

            // Schedule auto-save
            if (window.scheduleAutoSave) window.scheduleAutoSave();
        }
    }
}

// Find which group (if any) contains a node
function getGroupForNode(nodeId) {
    for (const [groupId, group] of groups) {
        if (group.nodeIds.includes(nodeId)) {
            return group;
        }
    }
    return null;
}

// Update group bounds based on member nodes
function updateGroupBounds(group) {
    if (!group.nodeIds || group.nodeIds.length === 0) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    group.nodeIds.forEach(nodeId => {
        const node = document.getElementById(nodeId);
        if (!node) return;

        const x = parseInt(node.style.left) || 0;
        const y = parseInt(node.style.top) || 0;
        const width = node.offsetWidth;
        const height = node.offsetHeight;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
    });

    // Add padding (increased from 20px to 40px to prevent label overlap)
    const padding = 40;
    group.bounds = {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + (padding * 2),
        height: (maxY - minY) + (padding * 2)
    };

    // Update DOM if element exists
    if (group.element) {
        group.element.style.left = `${group.bounds.x}px`;
        group.element.style.top = `${group.bounds.y}px`;
        group.element.style.width = `${group.bounds.width}px`;
        group.element.style.height = `${group.bounds.height}px`;
    }
}

// Render or update a group's DOM element
function renderGroup(group) {
    const canvasContent = document.getElementById('canvas-content');
    if (!canvasContent) return;

    // Create element if it doesn't exist
    if (!group.element) {
        group.element = document.createElement('div');
        group.element.className = 'group';
        group.element.id = group.id;
        group.element.dataset.groupId = group.id;

        // Add label
        const label = document.createElement('div');
        label.className = 'group-label';
        label.textContent = group.name;
        group.element.appendChild(label);

        // Add to canvas (before nodes so it appears behind them)
        const firstNode = canvasContent.querySelector('.node');
        if (firstNode) {
            canvasContent.insertBefore(group.element, firstNode);
        } else {
            canvasContent.appendChild(group.element);
        }

        // Setup event listeners
        setupGroupEvents(group);
    }

    // Update position and size
    group.element.style.left = `${group.bounds.x}px`;
    group.element.style.top = `${group.bounds.y}px`;
    group.element.style.width = `${group.bounds.width}px`;
    group.element.style.height = `${group.bounds.height}px`;
    group.element.style.backgroundColor = hexToRGBA(group.color, 0.1);
    group.element.style.borderColor = hexToRGBA(group.color, 0.4);

    // Update locked state
    if (group.locked) {
        group.element.classList.add('locked');
    } else {
        group.element.classList.remove('locked');
    }

    // Update label with lock icon if locked
    const label = group.element.querySelector('.group-label');
    if (label) {
        if (group.locked) {
            label.innerHTML = `${group.name} <i class="fas fa-lock" style="font-size: 11px; opacity: 0.6; margin-left: 6px;"></i>`;
        } else {
            label.textContent = group.name;
        }
        label.style.color = group.color;
    }
}

// Setup event listeners for a group element
function setupGroupEvents(group) {
    if (!group.element) return;

    // Click to select
    group.element.addEventListener('click', (e) => {
        e.stopPropagation();

        // Multi-select with Shift key
        if (e.shiftKey) {
            if (selectedGroups.has(group)) {
                deselectGroup(group);
            } else {
                selectGroupMulti(group);
            }
        } else {
            // Single select (clear others)
            selectGroup(group);
        }
    });

    // Double-click to edit
    group.element.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        showGroupEditor(group.id);
    });

    // Drag to move
    group.element.addEventListener('mousedown', (e) => {
        // Only start drag if clicking directly on the group, not on nodes
        if (e.target !== group.element && !e.target.classList.contains('group-label')) {
            return;
        }

        // Check if group is locked
        if (group.locked) {
            console.log('[Groups] Group is locked, preventing drag');
            e.stopPropagation();
            e.preventDefault();
            return;
        }

        e.stopPropagation();
        e.preventDefault();

        isDraggingGroup = true;
        selectedGroup = group;

        // Store initial positions - CRITICAL: Use same logic as node dragging
        groupDragStartPos.clientX = e.clientX;
        groupDragStartPos.clientY = e.clientY;
        groupDragStartPos.groupX = group.bounds.x;
        groupDragStartPos.groupY = group.bounds.y;

        // Store initial node positions
        groupDragStartPos.nodePositions = {};
        group.nodeIds.forEach(nodeId => {
            const node = document.getElementById(nodeId);
            if (node) {
                groupDragStartPos.nodePositions[nodeId] = {
                    x: parseInt(node.style.left) || 0,
                    y: parseInt(node.style.top) || 0
                };
            }
        });

        document.addEventListener('mousemove', dragGroup);
        document.addEventListener('mouseup', stopDraggingGroup);
    });
}

// Drag group (and all member nodes)
function dragGroup(e) {
    if (!isDraggingGroup || !selectedGroup) return;

    // Calculate TOTAL delta from start position (not incremental)
    // This prevents accumulation errors
    const totalDeltaClientX = e.clientX - groupDragStartPos.clientX;
    const totalDeltaClientY = e.clientY - groupDragStartPos.clientY;

    // Convert to canvas coordinates
    const totalDeltaX = totalDeltaClientX / window.canvasScale;
    const totalDeltaY = totalDeltaClientY / window.canvasScale;

    // Move all member nodes to their initial position + total delta
    selectedGroup.nodeIds.forEach(nodeId => {
        const node = document.getElementById(nodeId);
        if (!node || !groupDragStartPos.nodePositions[nodeId]) return;

        // Ensure dragging class is added for performance (CSS transition: none)
        if (!node.classList.contains('dragging')) {
            node.classList.add('dragging');
        }

        const initialPos = groupDragStartPos.nodePositions[nodeId];
        node.style.left = `${initialPos.x + totalDeltaX}px`;
        node.style.top = `${initialPos.y + totalDeltaY}px`;
    });

    // Update group bounds to initial position + total delta
    if (!selectedGroup.element.classList.contains('dragging')) {
        selectedGroup.element.classList.add('dragging');
    }

    selectedGroup.bounds.x = groupDragStartPos.groupX + totalDeltaX;
    selectedGroup.bounds.y = groupDragStartPos.groupY + totalDeltaY;
    selectedGroup.element.style.left = `${selectedGroup.bounds.x}px`;
    selectedGroup.element.style.top = `${selectedGroup.bounds.y}px`;

    // Update connections (throttled)
    if (window.updateNodeConnectionsThrottled) {
        window.updateNodeConnectionsThrottled();
    } else if (window.updateNodeConnections) {
        window.updateNodeConnections();
    }
}

// Stop dragging group
function stopDraggingGroup(e) {
    if (!isDraggingGroup) return;

    // Remove dragging class from all members
    if (selectedGroup) {
        selectedGroup.element.classList.remove('dragging');
        selectedGroup.nodeIds.forEach(nodeId => {
            const node = document.getElementById(nodeId);
            if (node) node.classList.remove('dragging');
        });
    }

    isDraggingGroup = false;

    // Clear stored positions
    groupDragStartPos = {};

    document.removeEventListener('mousemove', dragGroup);
    document.removeEventListener('mouseup', stopDraggingGroup);

    // Schedule auto-save
    if (window.scheduleAutoSave) window.scheduleAutoSave();
}

// Select a group (clear previous selections)
function selectGroup(group) {
    if (!group || !group.element) return;

    // Clear all selections
    clearGroupSelections();
    if (window.clearSelectedNodes) window.clearSelectedNodes();

    // Select this group
    selectedGroup = group;
    selectedGroups.clear();
    selectedGroups.add(group);
    group.element.classList.add('selected');

    // Dispatch event
    dispatchGroupSelectionEvent();
}

// Add group to selection (multi-select)
function selectGroupMulti(group) {
    if (!group || !group.element) return;

    selectedGroups.add(group);
    group.element.classList.add('selected');
    selectedGroup = group; // Keep reference to last selected

    dispatchGroupSelectionEvent();
}

// Deselect a specific group
function deselectGroup(group) {
    if (!group || !group.element) return;

    selectedGroups.delete(group);
    group.element.classList.remove('selected');

    if (selectedGroup === group) {
        selectedGroup = selectedGroups.size > 0 ? Array.from(selectedGroups)[0] : null;
    }

    dispatchGroupSelectionEvent();
}

// Clear all group selections
function clearGroupSelections() {
    selectedGroups.forEach(grp => {
        if (grp.element) {
            grp.element.classList.remove('selected');
        }
    });
    selectedGroups.clear();
    selectedGroup = null;

    dispatchGroupSelectionEvent();
}

// Dispatch selection event for Action Bar
function dispatchGroupSelectionEvent() {
    window.dispatchEvent(new CustomEvent('groupSelectionChanged', {
        detail: {
            count: selectedGroups.size,
            groups: Array.from(selectedGroups)
        }
    }));
}

// Show group editor panel with glassmorphism design
function showGroupEditor(groupId) {
    const group = groups.get(groupId);
    if (!group) return;

    // Remove existing editor if any
    const existingEditor = document.querySelector('.group-editor-panel');
    if (existingEditor) existingEditor.remove();

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'group-editor-backdrop';
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 3000;
        display: flex;
        justify-content: center;
        align-items: center;
        opacity: 0;
        transition: opacity 0.2s;
    `;

    // Create editor panel
    const panel = document.createElement('div');
    panel.className = 'group-editor-panel';
    panel.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 20px;
        padding: 28px 32px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        min-width: 400px;
        max-width: 500px;
        transform: translateY(20px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    // Add night mode support
    if (document.body.classList.contains('night-mode')) {
        panel.style.background = 'rgba(40, 40, 40, 0.95)';
        panel.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
    }

    panel.innerHTML = `
        <h2 style="margin: 0 0 24px 0; font-size: 20px; font-weight: 600;">Edit Group</h2>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; opacity: 0.8;">Group Name</label>
            <input type="text" id="group-name-input" value="${group.name}" 
                   style="width: 100%; padding: 12px 16px; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; font-size: 15px; background: rgba(255, 255, 255, 0.5); transition: all 0.2s;" />
        </div>
        
        <div style="margin-bottom: 24px;">
            <label style="display: block; margin-bottom: 12px; font-size: 14px; font-weight: 500; opacity: 0.8;">Color</label>
            <div id="group-color-picker" style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${window.stripColors.map(color =>
        `<div class="color-swatch ${color === group.color ? 'selected' : ''}" 
                      data-color="${color}" 
                      style="width: 36px; height: 36px; border-radius: 50%; background: ${color}; cursor: pointer; border: 3px solid ${color === group.color ? '#007bff' : 'transparent'}; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" 
                      onmouseover="this.style.transform='scale(1.1)'" 
                      onmouseout="this.style.transform='scale(1)'"></div>`
    ).join('')}
            </div>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="group-delete-btn" style="padding: 10px 18px; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; background: rgba(255, 68, 68, 0.1); color: #ff4444; transition: all 0.2s;">Ungroup</button>
            <button id="group-cancel-btn" style="padding: 10px 18px; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; background: transparent; transition: all 0.2s;">Cancel</button>
            <button id="group-save-btn" class="primary-btn" style="padding: 10px 24px; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; background: #67a772; color: white; transition: all 0.2s;">Save</button>
        </div>
    `;

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    // Trigger animation
    requestAnimationFrame(() => {
        backdrop.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
        panel.style.opacity = '1';
    });

    // Color picker interaction
    let selectedColor = group.color;
    panel.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            panel.querySelectorAll('.color-swatch').forEach(s => {
                s.classList.remove('selected');
                s.style.border = '3px solid transparent';
            });
            swatch.classList.add('selected');
            swatch.style.border = '3px solid #007bff';
            selectedColor = swatch.dataset.color;
        });
    });

    // Close function with animation
    const closeEditor = () => {
        backdrop.style.opacity = '0';
        panel.style.transform = 'translateY(20px)';
        panel.style.opacity = '0';
        setTimeout(() => backdrop.remove(), 200);
    };

    // Save button
    panel.querySelector('#group-save-btn').addEventListener('click', () => {
        const newName = panel.querySelector('#group-name-input').value.trim();
        if (newName) {
            group.name = newName;
            group.color = selectedColor;
            renderGroup(group);

            // Schedule auto-save
            if (window.scheduleAutoSave) window.scheduleAutoSave();
        }
        closeEditor();
    });

    // Cancel button
    panel.querySelector('#group-cancel-btn').addEventListener('click', closeEditor);

    // Ungroup button (formerly Delete)
    panel.querySelector('#group-delete-btn').addEventListener('click', () => {
        // Direct action, no confirmation needed as content is preserved
        deleteGroup(groupId);
        closeEditor();
    });

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            closeEditor();
        }
    });

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeEditor();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus name input after animation
    setTimeout(() => panel.querySelector('#group-name-input').focus(), 100);
}

// Helper: Convert hex color to RGBA
function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Expose globally
window.createGroup = createGroup;
window.deleteGroup = deleteGroup;
window.groups = groups;
window.renderGroup = renderGroup;
window.selectedGroup = function () { return selectedGroup; };
window.selectedGroups = selectedGroups;
window.clearGroupSelections = clearGroupSelections;
window.selectGroup = selectGroup;
window.selectGroupMulti = selectGroupMulti;
window.deselectGroup = deselectGroup;
window.getGroupForNode = getGroupForNode;
window.updateGroupBounds = updateGroupBounds;

console.log('Group management system initialized');
