/**
 * Action Bar (Island) Management
 * Handles the floating action bar at the bottom of the screen
 */

class ActionBar {
    constructor() {
        this.element = document.getElementById('action-bar');
        this.selectedCount = 0;
        this.selectedGroupCount = 0;
        this.selectedSticker = null;
        this.selectedConnection = null; // Track selected connection
        this.init();
    }

    init() {
        console.log('ActionBar: init called');
        if (!this.element) {
            console.error('ActionBar: #action-bar element not found!');
            return;
        }
        this.render();

        // Listen for selection changes
        window.addEventListener('selectionChanged', (e) => {
            this.selectedCount = e.detail.count;
            this.selectedGroupCount = 0; // Clear group count when nodes selected
            this.selectedSticker = null; // Clear sticker
            this.render();
        });

        // Listen for group selection changes
        window.addEventListener('groupSelectionChanged', (e) => {
            this.selectedGroupCount = e.detail.count;
            this.selectedCount = 0; // Clear node count when groups selected
            this.selectedSticker = null; // Clear sticker
            this.render();
        });

        // Listen for sticker selection changes
        window.addEventListener('stickerSelectionChanged', (e) => {
            this.selectedSticker = e.detail.sticker;
            this.selectedCount = 0;
            this.selectedGroupCount = 0;
            this.selectedConnection = null;
            this.render();
        });

        // Listen for connection selection changes
        window.addEventListener('connectionSelectionChanged', (e) => {
            this.selectedConnection = e.detail.connection;
            this.selectedConnections = e.detail.selectedConnections; // Sync the set

            if (this.selectedConnection || (this.selectedConnections && this.selectedConnections.size > 0)) {
                // Clear other selections when connection is selected
                this.selectedCount = 0;
                this.selectedGroupCount = 0;
                this.selectedSticker = null;
            }
            this.render();
        });
    }

    render() {
        if (!this.element) return;

        // Capture current width before clearing content
        const currentWidth = this.element.offsetWidth;

        // Temporarily disable transition and set fixed width to prevent jump
        this.element.style.transition = 'none';
        this.element.style.width = `${currentWidth}px`;

        this.element.innerHTML = '';

        // 1. Context Actions - Show if nodes, groups, sticker, OR connection selected
        if (this.selectedCount > 0 || this.selectedGroupCount > 0 || this.selectedSticker || this.selectedConnection) {
            if (this.selectedConnection) {
                this.renderConnectionActions();
            } else {
                this.renderContextActions();
            }
        }

        // Always show selection count
        this.renderSelectionCount();
        this.addSeparator();

        // 2. Persistent Actions (Right) - Always visible
        this.renderPersistentActions();

        // Calculate new natural width
        this.element.style.width = 'auto';
        const newWidth = this.element.offsetWidth;

        // Animate from old width to new width
        this.element.style.width = `${currentWidth}px`;

        // Force reflow to ensure the transition works
        this.element.offsetHeight;

        // Re-enable transition and animate to new width
        this.element.style.transition = '';
        requestAnimationFrame(() => {
            this.element.style.width = `${newWidth}px`;

            // After animation completes, reset to auto for flexibility
            setTimeout(() => {
                this.element.style.width = 'auto';
            }, 300);
        });
    }

    renderSelectionCount() {
        const countDisplay = document.createElement('div');
        countDisplay.className = 'selection-count';

        let text = '';
        if (this.selectedSticker) {
            text = '1 Sticker';
        } else {
            const count = this.selectedCount + this.selectedGroupCount;
            text = `${count} ${getText('actionBarSelected')}`;
        }

        countDisplay.textContent = text;
        this.element.appendChild(countDisplay);
    }

    renderContextActions() {
        // CASE A: Sticker Selected -> Show Sticker Controls
        if (this.selectedSticker) {
            // Decrease Size
            const decreaseBtn = this.createButton('fa-minus', 'Decrease Size');
            decreaseBtn.onclick = () => {
                if (window.stickerPanel) window.stickerPanel.resizeSticker(this.selectedSticker, -0.1);
            };
            this.element.appendChild(decreaseBtn);

            // Increase Size
            const increaseBtn = this.createButton('fa-plus', 'Increase Size');
            increaseBtn.onclick = () => {
                if (window.stickerPanel) window.stickerPanel.resizeSticker(this.selectedSticker, 0.1);
            };
            this.element.appendChild(increaseBtn);

            this.addSeparator();

            // Delete Sticker
            const deleteBtn = this.createButton('fa-trash', getText('actionBarDelete') || 'Delete');
            deleteBtn.style.color = '#ff4444';
            deleteBtn.onclick = () => {
                if (window.stickerPanel) window.stickerPanel.deleteSticker(this.selectedSticker);
            };
            this.element.appendChild(deleteBtn);

            return; // Stop here, don't show node/group actions
        }

        // CASE B: Nodes or Groups Selected -> Show Standard Controls

        // Color Picker
        const colorBtn = this.createButton('fa-palette', getText('actionBarColor'));
        colorBtn.onclick = (e) => {
            e.stopPropagation();
            this.showColorPicker(colorBtn);
        };
        this.element.appendChild(colorBtn);

        // Visibility Toggle (Nodes only)
        if (this.selectedCount > 0 && this.selectedGroupCount === 0) {
            const visibilityBtn = this.createButton('fa-eye', getText('actionBarVisibility'));
            visibilityBtn.onclick = () => {
                if (window.selectedNodes) {
                    window.selectedNodes.forEach(node => {
                        node.classList.toggle('content-only-mode');
                        const toggleBtn = node.querySelector('.node-visibility-toggle');
                        if (toggleBtn) {
                            const icon = toggleBtn.querySelector('i');
                            if (icon) {
                                if (node.classList.contains('content-only-mode')) {
                                    icon.classList.remove('fa-eye');
                                    icon.classList.add('fa-eye-slash');
                                } else {
                                    icon.classList.remove('fa-eye-slash');
                                    icon.classList.add('fa-eye');
                                }
                            }
                        }
                    });
                    if (window.scheduleAutoSave) window.scheduleAutoSave();
                }
            };
            this.element.appendChild(visibilityBtn);
        }

        // Lock/Unlock Button
        let hasLocked = false;
        if (this.selectedCount > 0) {
            hasLocked = window.selectedNodes && Array.from(window.selectedNodes).some(node => node.dataset.locked === 'true');
        } else if (this.selectedGroupCount > 0) {
            hasLocked = window.selectedGroups && Array.from(window.selectedGroups).some(grp => grp.locked === true);
        }

        const lockBtn = this.createButton(
            hasLocked ? 'fa-unlock' : 'fa-lock',
            hasLocked ? getText('unlockNodes') : getText('lockNodes')
        );

        lockBtn.onclick = () => {
            const newLockedState = !hasLocked;

            // Nodes
            if (this.selectedCount > 0 && window.selectedNodes) {
                const allLocked = Array.from(window.selectedNodes).every(node => node.dataset.locked === 'true');
                const stateToApply = (allLocked === hasLocked) ? newLockedState : true;

                window.selectedNodes.forEach(node => {
                    node.dataset.locked = stateToApply.toString();
                    if (this.updateLockIndicator) this.updateLockIndicator(node, stateToApply);
                });
            }

            // Groups
            if (this.selectedGroupCount > 0 && window.selectedGroups) {
                window.selectedGroups.forEach(grp => {
                    grp.locked = newLockedState;
                    if (window.renderGroup) window.renderGroup(grp);
                });
            }

            this.render();
            if (window.scheduleAutoSave) window.scheduleAutoSave();
        };
        this.element.appendChild(lockBtn);

        // Compress/Expand (Single Node)
        if (this.selectedCount === 1) {
            const node = Array.from(window.selectedNodes)[0];
            if (node) {
                const isFocused = node.classList.contains('focused-mode');

                const focusBtn = this.createButton(
                    isFocused ? 'fa-compress' : 'fa-expand',
                    isFocused ? (getText('actionBarExitFocus') || 'Exit Focus') : (getText('actionBarFocus') || 'Focus')
                );
                if (isFocused) focusBtn.style.color = '#ff9900';

                focusBtn.onclick = () => {
                    this.toggleFocusMode(node);
                };
                this.element.appendChild(focusBtn);
            }
        }

        // Group/Ungroup Button
        const isUngroupMode = this.selectedGroupCount > 0;
        const groupBtnIcon = isUngroupMode ? 'fa-object-ungroup' : 'fa-object-group';
        const groupBtnText = isUngroupMode ? (getText('actionBarUngroup') || 'Ungroup') : (getText('actionBarGroup') || 'Group');

        const groupBtn = this.createButton(groupBtnIcon, groupBtnText);

        groupBtn.onclick = () => {
            if (this.selectedGroupCount > 0 && window.selectedGroups) {
                Array.from(window.selectedGroups).forEach(grp => window.deleteGroup(grp.id));
            } else if (window.selectedNodes && window.selectedNodes.size >= 2) {
                window.createGroup(window.selectedNodes);
            }
        };
        this.element.appendChild(groupBtn);

        // Delete Button
        const deleteBtn = this.createButton('fa-trash', getText('actionBarDelete'));
        deleteBtn.style.color = '#ff4444';
        deleteBtn.onclick = () => {
            // Groups
            if (this.selectedGroupCount > 0 && window.selectedGroups) {
                const groupsToDelete = Array.from(window.selectedGroups);
                const confirmed = confirm(`Delete ${groupsToDelete.length} group(s) and all their nodes?`);
                if (confirmed) {
                    groupsToDelete.forEach(grp => {
                        // Delete nodes in group
                        [...grp.nodeIds].forEach(nodeId => {
                            const node = document.getElementById(nodeId);
                            if (node) window.deleteNode(node, false);
                        });
                        // Delete group
                        window.deleteGroup(grp.id);
                    });

                    if (window.scheduleAutoSave) window.scheduleAutoSave();
                    window.clearGroupSelections();
                }
            }
            // Nodes
            else if (window.selectedNodes && window.selectedNodes.size > 0) {
                if (window.deleteSelectedNodes) {
                    window.deleteSelectedNodes();
                } else {
                    Array.from(window.selectedNodes).forEach(node => window.deleteNode(node));
                }
            }
        };
        this.element.appendChild(deleteBtn);
    }

    // Render connection-specific actions when a connection is selected
    renderConnectionActions() {
        const hasSelection = (this.selectedConnection) || (this.selectedConnections && this.selectedConnections.size > 0);
        if (!hasSelection) return;

        // Color Picker for connections
        const colorBtn = this.createButton('fa-palette', getText('actionBarColor') || 'Color');
        colorBtn.onclick = (e) => {
            e.stopPropagation();
            this.showConnectionColorPicker(colorBtn);
        };
        this.element.appendChild(colorBtn);

        this.addSeparator();

        // Determine current type (use first selected if multiple)
        let currentType = 'curved';
        if (this.selectedConnection) {
            currentType = this.selectedConnection.dataset.connectionType || 'curved';
        } else if (this.selectedConnections && this.selectedConnections.size > 0) {
            currentType = this.selectedConnections.values().next().value.dataset.connectionType || 'curved';
        }

        // Connection Type Buttons
        const types = [
            { type: 'curved', icon: 'fa-bezier-curve', label: 'Eğri' },
            { type: 'straight', icon: 'fa-minus', label: 'Direkt' },
            { type: 'single-elbow', icon: 'fa-turn-down', label: 'Tek Kırılım' },
            { type: 'multi-elbow', icon: 'fa-wave-square', label: 'Köşeli' }
        ];

        types.forEach(({ type, icon, label }) => {
            const btn = this.createButton(icon, label);

            // Highlight current type (if single, or if representative of group)
            if (currentType === type) {
                btn.style.backgroundColor = 'var(--primary-btn-bg)';
                btn.style.color = 'white';
            }

            btn.onclick = () => {
                if (window.setConnectionType) {
                    // Passed parameters: connection (ignored if multi), type
                    // setConnectionType logic handles bulk update via window.selectedConnections
                    window.setConnectionType(null, type);
                    this.render(); // Re-render to update button states
                }
            };

            this.element.appendChild(btn);
        });

        this.addSeparator();

        // Delete Connection Button
        const deleteBtn = this.createButton('fa-trash', getText('actionBarDelete') || 'Delete');
        deleteBtn.style.color = '#ff4444';
        deleteBtn.onclick = () => {
            if (window.deleteSelectedConnection) {
                window.deleteSelectedConnection();
            }
        };
        this.element.appendChild(deleteBtn);
    }

    renderPersistentActions() {
        // Draw Button
        const drawBtn = this.createButton('fa-pen', window.getText ? window.getText('actionBarDraw', 'Draw') : 'Draw');
        drawBtn.id = 'action-draw';
        drawBtn.onclick = () => {
            if (window.drawingSystem) {
                window.drawingSystem.toggleToolbar(drawBtn);
            } else {
                console.warn('DrawingSystem not found');
            }
        };
        this.element.appendChild(drawBtn);

        // Sticker Button
        const stickerBtn = this.createButton('fa-smile', getText('actionBarStickers') || 'Stickers');
        stickerBtn.classList.add('sticker-btn');
        stickerBtn.onclick = () => {
            if (window.stickerPanel) {
                window.stickerPanel.toggle();
            }
        };
        this.element.appendChild(stickerBtn);

        // Spotlight Button (Add + Search)
        const spotlightBtn = this.createButton('fa-search-plus', getText('actionBarSpotlight'), 'primary');
        spotlightBtn.onclick = () => {
            if (window.commandPalette) {
                window.commandPalette.toggle();
            }
        };
        this.element.appendChild(spotlightBtn);
    }

    showColorPicker(targetBtn) {
        // Remove existing color picker
        const existingPicker = document.querySelector('.action-bar-color-picker');
        if (existingPicker) {
            existingPicker.remove();
            return; // Toggle off
        }

        const picker = document.createElement('div');
        picker.className = 'action-bar-color-picker';
        picker.style.position = 'fixed'; // Use fixed to be safe with scroll/transforms

        // Calculate position relative to viewport
        const rect = targetBtn.getBoundingClientRect();
        picker.style.bottom = (window.innerHeight - rect.top + 12) + 'px'; // 12px margin
        picker.style.left = (rect.left + rect.width / 2) + 'px';
        picker.style.transform = 'translateX(-50%)';

        picker.style.background = 'rgba(255, 255, 255, 0.95)';
        picker.style.backdropFilter = 'blur(10px)';
        picker.style.padding = '8px';
        picker.style.borderRadius = '12px';
        picker.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
        picker.style.display = 'flex';
        picker.style.gap = '8px';
        picker.style.zIndex = '9999'; // Very high z-index

        // Add dark mode support
        if (document.body.classList.contains('night-mode')) {
            picker.style.background = 'rgba(40, 40, 40, 0.95)';
            picker.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        }

        const colors = window.stripColors || [
            '#c2f8cb', '#D9FF73', '#FFD166', '#EF767A', '#7D80DA',
            '#49DCB1', '#FB6480', '#F9C3FF', '#7FDEFF', '#FFB865'
        ];

        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.style.width = '24px';
            swatch.style.height = '24px';
            swatch.style.borderRadius = '50%';
            swatch.style.backgroundColor = color;
            swatch.style.cursor = 'pointer';
            swatch.style.border = '2px solid transparent';
            swatch.style.transition = 'transform 0.2s';

            swatch.onmouseover = () => swatch.style.transform = 'scale(1.2)';
            swatch.onmouseout = () => swatch.style.transform = 'scale(1)';

            swatch.onclick = (e) => {
                e.stopPropagation();
                this.applyColorToSelection(color);
                picker.remove();
            };

            picker.appendChild(swatch);
        });

        // Append to BODY instead of button to avoid clipping/event issues
        document.body.appendChild(picker);

        // Close on click outside
        const closeHandler = (e) => {
            if (!picker.contains(e.target) && e.target !== targetBtn && !targetBtn.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        // Use timeout to avoid immediate closing from the current click
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    applyColorToSelection(color) {
        // Capture old colors before any changes (for history)
        const oldColors = {};
        const nodeIds = [];

        // Handle nodes
        if (window.selectedNodes && this.selectedCount > 0) {
            window.selectedNodes.forEach(node => {
                // Capture old color first
                const iconWrapper = node.querySelector('.node-icon-wrapper');
                const strip = node.querySelector('.strip');
                const oldColor = iconWrapper?.style.backgroundColor ||
                    strip?.style.backgroundColor ||
                    node.dataset.color ||
                    '#c2f8cb';

                nodeIds.push(node.id);
                oldColors[node.id] = oldColor;

                // Apply new color
                if (iconWrapper) {
                    iconWrapper.style.backgroundColor = color;
                }
                if (strip) strip.style.backgroundColor = color;

                // Store color in dataset for saving
                node.dataset.color = color;
            });
        }

        // Handle groups
        if (window.selectedGroups && this.selectedGroupCount > 0) {
            window.selectedGroups.forEach(group => {
                group.color = color;
                // Update group rendering
                if (window.renderGroup) {
                    window.renderGroup(group);
                }
            });
        }

        // Add to history (only for nodes, not groups for now)
        if (nodeIds.length > 0 && window.actionHistory && !window.actionHistory.isPerformingAction && window.NodeColorChangeAction) {
            const action = new window.NodeColorChangeAction(nodeIds, oldColors, color);
            window.actionHistory.addAction(action);
        }

        // Schedule auto-save
        if (window.scheduleAutoSave) window.scheduleAutoSave();
    }

    showConnectionColorPicker(targetBtn) {
        // Remove existing color picker
        const existingPicker = document.querySelector('.action-bar-color-picker');
        if (existingPicker) {
            existingPicker.remove();
            return; // Toggle off
        }

        const picker = document.createElement('div');
        picker.className = 'action-bar-color-picker';
        picker.style.position = 'fixed'; // Use fixed to be safe with scroll/transforms

        // Calculate position relative to viewport
        const rect = targetBtn.getBoundingClientRect();
        picker.style.bottom = (window.innerHeight - rect.top + 12) + 'px'; // 12px margin
        picker.style.left = (rect.left + rect.width / 2) + 'px';
        picker.style.transform = 'translateX(-50%)';

        picker.style.background = 'rgba(255, 255, 255, 0.95)';
        picker.style.backdropFilter = 'blur(10px)';
        picker.style.padding = '8px';
        picker.style.borderRadius = '12px';
        picker.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
        picker.style.display = 'flex';
        picker.style.gap = '8px';
        picker.style.zIndex = '9999'; // Very high z-index

        // Add dark mode support
        if (document.body.classList.contains('night-mode')) {
            picker.style.background = 'rgba(40, 40, 40, 0.95)';
            picker.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        }

        // Connection-friendly colors (including darker tones for visibility)
        const colors = [
            'var(--connection-color)', // Default
            '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
            '#f97316', '#eab308', '#22c55e', '#14b8a6',
            '#06b6d4', '#3b82f6'
        ];

        colors.forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.style.width = '24px';
            swatch.style.height = '24px';
            swatch.style.borderRadius = '50%';
            swatch.style.backgroundColor = color;
            swatch.style.cursor = 'pointer';
            swatch.style.border = index === 0 ? '2px dashed rgba(0,0,0,0.3)' : '2px solid transparent';
            swatch.style.transition = 'transform 0.2s';
            swatch.title = index === 0 ? 'Default' : '';

            swatch.onmouseover = () => swatch.style.transform = 'scale(1.2)';
            swatch.onmouseout = () => swatch.style.transform = 'scale(1)';

            swatch.onclick = (e) => {
                e.stopPropagation();
                this.applyColorToConnection(color);
                picker.remove();
            };

            picker.appendChild(swatch);
        });

        // Append to BODY instead of button to avoid clipping/event issues
        document.body.appendChild(picker);

        // Close on click outside
        const closeHandler = (e) => {
            if (!picker.contains(e.target) && e.target !== targetBtn && !targetBtn.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        // Use timeout to avoid immediate closing from the current click
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    applyColorToConnection(color) {
        // Helper
        const applyToSingle = (conn) => {
            if (!conn) return;
            // Apply color to visible path
            conn.setAttribute('stroke', color);
            // Store in dataset for persistence
            conn.dataset.connectionColor = color;
            // Also update dynamic glow if selected
            if (conn.classList.contains('selected')) {
                // Remove existing filters if any to ensure clean state or just rely on CSS var
                conn.style.setProperty('--connection-glow', color === 'var(--connection-color)' ? '#00a8ff' : color);
            }
            // Also update the hit path if it exists (for consistency)
            if (conn.hitPath) {
                conn.hitPath.dataset.connectionColor = color;
            }
        };

        if (this.selectedConnections && this.selectedConnections.size > 0) {
            this.selectedConnections.forEach(applyToSingle);
        } else if (this.selectedConnection) {
            applyToSingle(this.selectedConnection);
        }

        // Schedule auto-save
        if (window.scheduleAutoSave) window.scheduleAutoSave();
    }

    toggleFocusMode(node) {
        if (!node) return;

        // Check if focus overlay exists and is active
        const overlay = document.getElementById('focus-overlay');
        const isFocused = overlay && overlay.classList.contains('active');

        if (isFocused) {
            // --- EXIT FOCUS ---
            this.exitFocusMode();
        } else {
            // --- ENTER FOCUS ---
            this.enterFocusMode(node);
        }

        // Re-render to update icon (Crosshairs vs Times)
        this.render();
    }

    enterFocusMode(node) {
        // Store reference
        this.currentFocusedNode = node;

        // Create or get overlay (for I/O panels only)
        let overlay = document.getElementById('focus-overlay');
        if (!overlay) {
            overlay = this.createFocusOverlay();
        }

        // Reset overlay state
        overlay.classList.remove('panels-auto-hidden');

        // START PANELS AS PINNED (responsive layout) - they resize node content initially
        // This makes it clear to user where they are before panels auto-hide
        this.pinnedPanels = { left: true, right: true };

        // Set pin button and panel visual states to PINNED
        overlay.querySelectorAll('.focus-panel-pin').forEach(btn => {
            btn.classList.add('pinned');
        });
        overlay.querySelectorAll('.focus-io-panel').forEach(panel => {
            panel.classList.add('pinned');
        });

        // Add body classes for responsive layout (node content will resize)
        document.body.classList.add('pinned-left');
        document.body.classList.add('pinned-right');

        // Load I/O data
        this.loadFocusIOData(node, overlay);

        // Store original node state for restoration (NOT canvas state)
        // IMPORTANT: Store both inline styles AND computed dimensions
        // Some nodes don't have inline width/height, so we need offset values as fallback
        this.originalNodeState = {
            parent: node.parentElement, // Store original parent
            position: node.style.position,
            left: node.style.left,
            top: node.style.top,
            width: node.style.width,
            height: node.style.height,
            // Store actual computed dimensions for proper restoration
            offsetWidth: node.offsetWidth,
            offsetHeight: node.offsetHeight,
            zIndex: node.style.zIndex,
            transform: node.style.transform,
            borderRadius: node.style.borderRadius
        };

        // Calculate position between panels
        const panelWidth = 220;
        const titleBarHeight = 38;

        // Show overlay first
        overlay.classList.add('active');
        document.body.classList.add('has-focused-node');

        // Add focus mode class (hides node chrome via CSS)
        node.classList.add('focused-mode');
        node.classList.add('active-app');

        // Trigger canvas transform update - this will disable transform
        // allowing position:fixed to work correctly WITHOUT moving the node
        if (window.updateCanvasTransform) {
            window.updateCanvasTransform();
        }

        // Make node fixed and fullscreen using inline styles
        // CRITICAL: Must set ALL position values explicitly because CSS !important 
        // may not override inline styles from original node state
        node.style.position = 'fixed';
        node.style.zIndex = '4000';
        node.style.transform = 'none';
        node.style.borderRadius = '0';

        // Set ALL position values explicitly for fullscreen
        node.style.top = '44px';  // Title bar height
        node.style.bottom = '0';
        node.style.left = '0';
        node.style.right = '0';
        node.style.width = 'auto';
        node.style.height = 'auto';
        node.style.minWidth = '0';
        node.style.minHeight = '0';
        node.style.maxWidth = 'none';
        node.style.maxHeight = 'none';

        console.log('[ActionBar] Focus mode - node styled fixed:', {
            node: node.id,
            top: node.style.top,
            bottom: node.style.bottom
        });

        // Hide action bar and unified bar
        if (this.element) this.element.style.display = 'none';
        const unifiedBar = document.getElementById('unified-bar');
        if (unifiedBar) unifiedBar.style.display = 'none';
        const minimap = document.querySelector('.canvas-minimap');
        if (minimap) minimap.style.display = 'none';

        // Attach exit listeners - use capture to get ESC before iframe
        this.boundExitHandler = this.handleFocusExit.bind(this);
        document.addEventListener('keydown', this.boundExitHandler, true);

        // Attach mousemove listener for waking up panels
        this.boundMouseMoveHandler = this.handleFocusMouseMove.bind(this);
        document.addEventListener('mousemove', this.boundMouseMoveHandler);

        // Auto-hide panels after 3 seconds
        this.resetFocusAutoHideTimer();

        // CRITICAL: Capture wheel events on focused node to prevent canvas from handling them
        // This allows gestures to propagate to the webview inside the node
        this.boundWheelHandler = (e) => {
            // Stop event from reaching canvas wheel handler
            e.stopPropagation();
            // Don't preventDefault() - let the event reach webview
        };
        node.addEventListener('wheel', this.boundWheelHandler, { passive: true, capture: false });

        // Setup live data updates
        this.setupFocusSubscriptions(node.id);
    }

    exitFocusMode() {
        const overlay = document.getElementById('focus-overlay');
        const node = this.currentFocusedNode;

        // Unsubscribe from data updates
        if (this._storeUnsubscribe) {
            this._storeUnsubscribe();
            this._storeUnsubscribe = null;
        }

        // Clear all auto-hide timers
        if (this.panelAutoHideTimer) {
            clearTimeout(this.panelAutoHideTimer);
            this.panelAutoHideTimer = null;
        }
        if (this.leftPanelHideTimer) {
            clearTimeout(this.leftPanelHideTimer);
            this.leftPanelHideTimer = null;
        }
        if (this.rightPanelHideTimer) {
            clearTimeout(this.rightPanelHideTimer);
            this.rightPanelHideTimer = null;
        }

        // Restore original node state (no DOM move needed)
        if (node && this.originalNodeState) {
            node.style.position = this.originalNodeState.position || 'absolute';
            node.style.left = this.originalNodeState.left || '100px';
            node.style.top = this.originalNodeState.top || '100px';

            // For width/height, prefer inline style values
            // If no inline style was set, use the stored offset dimensions (actual computed size)
            const origWidth = this.originalNodeState.width;
            const origHeight = this.originalNodeState.height;

            // Check if width/height are valid pixel values (not 'auto', '', 'none', etc.)
            const isValidWidth = origWidth && origWidth !== 'auto' && origWidth !== '' && !origWidth.includes('none');
            const isValidHeight = origHeight && origHeight !== 'auto' && origHeight !== '' && !origHeight.includes('none');

            // Use inline style if valid, otherwise use stored offset dimensions (actual pre-focus size)
            if (isValidWidth) {
                node.style.width = origWidth;
            } else if (this.originalNodeState.offsetWidth) {
                node.style.width = `${this.originalNodeState.offsetWidth}px`;
            }
            // If no offset stored, leave width unset to let CSS handle it

            if (isValidHeight) {
                node.style.height = origHeight;
            } else if (this.originalNodeState.offsetHeight) {
                node.style.height = `${this.originalNodeState.offsetHeight}px`;
            }
            // If no offset stored, leave height unset to let CSS handle it

            // Clear any conflicting position styles set during focus mode
            node.style.right = '';
            node.style.bottom = '';
            node.style.minWidth = '';
            node.style.minHeight = '';
            node.style.maxWidth = '';
            node.style.maxHeight = '';

            node.style.zIndex = this.originalNodeState.zIndex || '';
            node.style.transform = this.originalNodeState.transform || '';
            node.style.borderRadius = this.originalNodeState.borderRadius || '';

            node.classList.remove('active-app');
            node.classList.remove('focused-mode');

            console.log('[ActionBar] Focus mode exit - node styles restored:', {
                node: node.id,
                width: node.style.width,
                height: node.style.height
            });

            this.originalNodeState = null;
        }

        if (this.boundExitHandler) {
            document.removeEventListener('keydown', this.boundExitHandler, true);
            this.boundExitHandler = null;
        }

        if (this.boundMouseMoveHandler) {
            document.removeEventListener('mousemove', this.boundMouseMoveHandler);
            this.boundMouseMoveHandler = null;
        }

        // Clean up wheel handler from focused node
        if (this.boundWheelHandler && node) {
            node.removeEventListener('wheel', this.boundWheelHandler, { passive: true, capture: false });
            this.boundWheelHandler = null;
        }

        // Clean up body classes
        document.body.classList.remove('has-focused-node');
        document.body.classList.remove('panels-auto-hidden');
        document.body.classList.remove('pinned-left');
        document.body.classList.remove('pinned-right');

        if (overlay) {
            overlay.classList.remove('active');
            overlay.classList.remove('panels-auto-hidden');
        }

        // Restore canvas transform (re-enable it)
        if (window.updateCanvasTransform) {
            window.updateCanvasTransform();
        }

        // Show action bar and unified bar again
        if (this.element) this.element.style.display = '';
        const unifiedBar = document.getElementById('unified-bar');
        if (unifiedBar) unifiedBar.style.display = '';
        const minimap = document.querySelector('.canvas-minimap');
        if (minimap) minimap.style.display = '';

        // Keep the node selected
        const nodeToSelect = node;

        // Remove listeners
        document.removeEventListener('keydown', this.boundExitHandler);
        this.currentFocusedNode = null;
        this.pinnedPanels = null;

        // Re-select the node and render action bar
        if (nodeToSelect && window.selectNode) {
            window.selectNode(nodeToSelect, false);
        }
        setTimeout(() => this.render(), 50);
    }

    handleFocusExit(e) {
        // ESC Key - capture mode ensures we get it before iframe
        console.log('[FocusMode] Key pressed:', e.key, 'in focus mode');
        if (e.key === 'Escape') {
            console.log('[FocusMode] ESC detected! Exiting focus mode...');
            e.preventDefault();
            e.stopPropagation();
            this.exitFocusMode();
            this.render();
        }
    }

    resetFocusAutoHideTimer() {
        if (this.panelAutoHideTimer) {
            clearTimeout(this.panelAutoHideTimer);
            this.panelAutoHideTimer = null;
        }

        console.log('[FocusMode] Starting auto-hide timer (3s)');

        this.panelAutoHideTimer = setTimeout(() => {
            const overlay = document.getElementById('focus-overlay');
            console.log('[FocusMode] Timer fired! Unpinning panels and adding auto-hidden class');

            if (overlay) {
                // UNPIN PANELS - switch from responsive to overlay mode
                this.pinnedPanels = { left: false, right: false };

                // Remove pinned visual states
                overlay.querySelectorAll('.focus-panel-pin').forEach(btn => {
                    btn.classList.remove('pinned');
                });
                overlay.querySelectorAll('.focus-io-panel').forEach(panel => {
                    panel.classList.remove('pinned');
                });

                // Remove body pinned classes (node will expand to full width)
                document.body.classList.remove('pinned-left');
                document.body.classList.remove('pinned-right');

                // Add auto-hidden state (panels collapse to edge)
                overlay.classList.add('panels-auto-hidden');
                document.body.classList.add('panels-auto-hidden');

                console.log('[FocusMode] Panels unpinned and auto-hidden');
            }
        }, 3000);
    }

    handleFocusMouseMove(e) {
        const overlay = document.getElementById('focus-overlay');
        if (!overlay || !overlay.classList.contains('active')) return;

        // Get panel elements
        const leftPanel = overlay.querySelector('#focus-panel-incoming');
        const rightPanel = overlay.querySelector('#focus-panel-outgoing');

        // Check if panels are in auto-hidden state
        const isAutoHidden = overlay.classList.contains('panels-auto-hidden');

        // If not auto-hidden yet, nothing to do
        if (!isAutoHidden) return;

        // Panel trigger zones - ONLY in the panel area, not over the node content
        // Panel width is 220px when expanded, 8px when collapsed
        const panelWidth = 220;
        const collapsedWidth = 8;
        const edgeThreshold = 40; // Small edge trigger zone

        // Y-axis check: Only trigger panels if mouse is in the main content area
        // Exclude the toolbar area (approximately top 38px of node) and info bar (bottom 28px)
        // The focus overlay starts at y=44 (below title bar)
        const minY = 44 + 50;  // Title bar + toolbar
        const maxY = window.innerHeight - 40; // Above the hint/info area
        const isInValidYZone = e.clientY > minY && e.clientY < maxY;

        // Don't trigger panels if mouse is over the node's toolbar area
        if (!isInValidYZone) {
            // Remove hover-visible if we're in the toolbar area
            if (leftPanel && leftPanel.classList.contains('hover-visible')) {
                leftPanel.classList.remove('hover-visible');
            }
            if (rightPanel && rightPanel.classList.contains('hover-visible')) {
                rightPanel.classList.remove('hover-visible');
            }
            return;
        }

        // Check if mouse is near the left edge OR directly over the left panel
        const isNearLeftEdge = e.clientX < edgeThreshold;
        const isOverLeftPanel = leftPanel && e.clientX < (leftPanel.classList.contains('hover-visible') || leftPanel.classList.contains('pinned') ? panelWidth : collapsedWidth);

        // Check if mouse is near the right edge OR directly over the right panel  
        const isNearRightEdge = e.clientX > (window.innerWidth - edgeThreshold);
        const isOverRightPanel = rightPanel && e.clientX > (window.innerWidth - (rightPanel.classList.contains('hover-visible') || rightPanel.classList.contains('pinned') ? panelWidth : collapsedWidth));

        // Handle LEFT panel independently
        if (isNearLeftEdge || isOverLeftPanel) {
            if (leftPanel && !leftPanel.classList.contains('pinned')) {
                leftPanel.classList.add('hover-visible');
            }
            // Clear and reset left panel auto-hide timer
            if (this.leftPanelHideTimer) {
                clearTimeout(this.leftPanelHideTimer);
            }
            this.leftPanelHideTimer = setTimeout(() => {
                if (leftPanel && !leftPanel.classList.contains('pinned')) {
                    leftPanel.classList.remove('hover-visible');
                }
            }, 100);
        } else {
            // Not near left - remove hover-visible after short delay
            if (!this.leftPanelHideTimer && leftPanel && leftPanel.classList.contains('hover-visible')) {
                this.leftPanelHideTimer = setTimeout(() => {
                    if (leftPanel && !leftPanel.classList.contains('pinned')) {
                        leftPanel.classList.remove('hover-visible');
                    }
                    this.leftPanelHideTimer = null;
                }, 50);
            }
        }

        // Handle RIGHT panel independently
        if (isNearRightEdge || isOverRightPanel) {
            if (rightPanel && !rightPanel.classList.contains('pinned')) {
                rightPanel.classList.add('hover-visible');
            }
            // Clear and reset right panel auto-hide timer
            if (this.rightPanelHideTimer) {
                clearTimeout(this.rightPanelHideTimer);
            }
            this.rightPanelHideTimer = setTimeout(() => {
                if (rightPanel && !rightPanel.classList.contains('pinned')) {
                    rightPanel.classList.remove('hover-visible');
                }
            }, 100);
        } else {
            // Not near right - remove hover-visible after short delay
            if (!this.rightPanelHideTimer && rightPanel && rightPanel.classList.contains('hover-visible')) {
                this.rightPanelHideTimer = setTimeout(() => {
                    if (rightPanel && !rightPanel.classList.contains('pinned')) {
                        rightPanel.classList.remove('hover-visible');
                    }
                    this.rightPanelHideTimer = null;
                }, 50);
            }
        }
    }

    createFocusOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'focus-overlay';
        overlay.className = 'focus-overlay';

        overlay.innerHTML = `
            <!-- Left Panel: Incoming Data -->
            <div class="focus-io-panel left-panel" id="focus-panel-incoming">
                <div class="focus-panel-header">
                    <div class="focus-panel-title">
                        <i class="fas fa-sign-in-alt"></i>
                        <span>Incoming</span>
                    </div>
                    <button class="focus-panel-pin" data-panel="left" title="Pin panel (prevent auto-hide)">
                        <i class="fas fa-thumbtack"></i>
                    </button>
                </div>
                <div class="focus-panel-content" id="focus-incoming-cards">
                    <div class="focus-panel-empty">
                        <i class="fas fa-plug"></i>
                        Connect a node to receive data
                    </div>
                </div>
            </div>

            <!-- Center: Content Wrapper (flexible) -->
            <div class="focus-content-wrapper">
                <!-- Content (iframe/webview) will be placed here -->
            </div>

            <!-- Right Panel: Outgoing Data -->
            <div class="focus-io-panel right-panel" id="focus-panel-outgoing">
                <div class="focus-panel-header">
                    <div class="focus-panel-title">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Outgoing</span>
                    </div>
                    <button class="focus-panel-paste" id="focus-paste-btn" title="Paste from clipboard (Cmd+V)">
                        <i class="fas fa-paste"></i>
                    </button>
                    <button class="focus-panel-pin" data-panel="right" title="Pin panel (prevent auto-hide)">
                        <i class="fas fa-thumbtack"></i>
                    </button>
                </div>
                <div class="focus-panel-content" id="focus-outgoing-cards">
                    <div class="focus-panel-empty">
                        <i class="fas fa-mouse-pointer"></i>
                        Select content to capture
                    </div>
                </div>
            </div>

            <div class="focus-hint">
                Press <kbd>ESC</kbd> to exit
            </div>
        `;

        // Setup pin button click handlers
        overlay.querySelectorAll('.focus-panel-pin').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const panelSide = btn.dataset.panel;
                const panel = btn.closest('.focus-io-panel');

                // Toggle pinned state
                if (!window.actionBar.pinnedPanels) {
                    window.actionBar.pinnedPanels = { left: false, right: false };
                }

                window.actionBar.pinnedPanels[panelSide] = !window.actionBar.pinnedPanels[panelSide];

                if (window.actionBar.pinnedPanels[panelSide]) {
                    btn.classList.add('pinned');
                    panel.classList.add('pinned');
                    // Add body class for CSS resizing of the node
                    document.body.classList.add(`pinned-${panelSide}`);

                    // We DO NOT force remove 'panels-auto-hidden' from overlay here anymore.
                    // Instead, we let the active/hover logic continue.
                    // The CSS will ensure .focus-io-panel.pinned stays visible even if overlay has .panels-auto-hidden

                    // However, we should ensure the overlay itself allows interaction if something is pinned.
                    // Actually, the overlay container pointer-events are 'none' usually, and panels are 'auto'.
                    // So we just need to ensure the pinned panel's opacity stays 1.

                } else {
                    btn.classList.remove('pinned');
                    panel.classList.remove('pinned');
                    // Remove body class
                    document.body.classList.remove(`pinned-${panelSide}`);

                    // If no panels are pinned, re-enable auto-hide logic (will hide after timeout if user moves mouse away)
                    if (!window.actionBar.pinnedPanels.left && !window.actionBar.pinnedPanels.right) {
                        // We don't hide immediately, just ensure 'pinned' state is gone.
                        // The existing auto-hide logic in action-bar.js timer handles the rest if user moves mouse away
                    }
                }
            });
        });

        // Setup Drag-to-Add for Outgoing Panel (Append mode)
        const outgoingPanel = overlay.querySelector('#focus-outgoing-cards');
        if (outgoingPanel) {
            outgoingPanel.addEventListener('dragover', (e) => {
                e.preventDefault();
                outgoingPanel.classList.add('drag-over-panel');
            });

            outgoingPanel.addEventListener('dragleave', () => {
                outgoingPanel.classList.remove('drag-over-panel');
            });

            outgoingPanel.addEventListener('drop', (e) => {
                e.preventDefault();
                outgoingPanel.classList.remove('drag-over-panel');

                console.log('[FocusMode] Drop event triggered on outgoing panel');
                console.log('[FocusMode] DataTransfer types:', e.dataTransfer.types);

                const packetDataStr = e.dataTransfer.getData('application/mosaic-packet');
                console.log('[FocusMode] Packet data string:', packetDataStr ? 'exists' : 'empty');

                if (packetDataStr) {
                    try {
                        const newPacket = JSON.parse(packetDataStr);
                        console.log('[FocusMode] Parsed packet:', newPacket);

                        // Append as NEW card
                        if (window.dataCardStore && this.currentFocusedNode?.id) {
                            console.log('[FocusMode] Adding to node:', this.currentFocusedNode.id);
                            window.dataCardStore.addPacket(this.currentFocusedNode.id, {
                                type: newPacket.type,
                                data: newPacket.data,
                                value: newPacket.value || newPacket.data?.value,
                                content: newPacket.content || newPacket.data?.content,
                                width: newPacket.width,
                                height: newPacket.height
                            }); // Default is append (manual add)
                            this.showToast('Card added to outgoing');
                            // Reload the panel to show new card
                            this.loadFocusIOData(this.currentFocusedNode, document.querySelector('.focus-mode-overlay'));
                        }
                    } catch (err) {
                        console.error('Failed to parse dropped packet:', err);
                    }
                } else {
                    // Try other data types (from webview/external sources)
                    const textData = e.dataTransfer.getData('text/plain');
                    const htmlData = e.dataTransfer.getData('text/html');
                    const uriData = e.dataTransfer.getData('text/uri-list');

                    console.log('[FocusMode] Text data:', textData ? textData.substring(0, 100) : 'none');
                    console.log('[FocusMode] HTML data:', htmlData ? htmlData.substring(0, 200) : 'none');
                    console.log('[FocusMode] URI data:', uriData || 'none');

                    const nodeId = this.currentFocusedNode?.id;
                    if (!nodeId || !window.dataCardStore) return;

                    // Priority: Image URL > SVG > URI > Text > HTML content

                    // Check for image in HTML
                    if (htmlData) {
                        const imgMatch = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i);
                        const svgMatch = htmlData.match(/<svg[^>]*>[\s\S]*?<\/svg>/i);

                        if (imgMatch && imgMatch[1]) {
                            // It's an image
                            const imgSrc = imgMatch[1];
                            console.log('[FocusMode] Detected image:', imgSrc.substring(0, 100));
                            window.dataCardStore.addPacket(nodeId, {
                                type: 'image',
                                data: { dataUrl: imgSrc, value: imgSrc },
                                value: imgSrc
                            });
                            this.showToast('Image card added');
                            this.loadFocusIOData(this.currentFocusedNode, document.querySelector('.focus-mode-overlay'));
                            return;
                        }

                        if (svgMatch) {
                            // It's SVG
                            console.log('[FocusMode] Detected SVG');
                            window.dataCardStore.addPacket(nodeId, {
                                type: 'svg',
                                data: { content: svgMatch[0], value: svgMatch[0] },
                                value: svgMatch[0]
                            });
                            this.showToast('SVG card added');
                            this.loadFocusIOData(this.currentFocusedNode, document.querySelector('.focus-mode-overlay'));
                            return;
                        }
                    }

                    // Check URI (could be image URL)
                    if (uriData) {
                        const url = uriData.trim().split('\n')[0]; // First URL
                        if (/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(url)) {
                            // Image URL
                            window.dataCardStore.addPacket(nodeId, {
                                type: 'image',
                                data: { dataUrl: url, value: url },
                                value: url
                            });
                            this.showToast('Image card added');
                        } else {
                            // Regular URL
                            window.dataCardStore.addPacket(nodeId, {
                                type: 'url',
                                data: { content: url, value: url },
                                value: url
                            });
                            this.showToast('URL card added');
                        }
                        this.loadFocusIOData(this.currentFocusedNode, document.querySelector('.focus-mode-overlay'));
                        return;
                    }

                    // Plain text fallback
                    if (textData) {
                        window.dataCardStore.addPacket(nodeId, {
                            type: 'text',
                            data: { content: textData },
                            value: textData
                        });
                        this.showToast('Text card added');
                        this.loadFocusIOData(this.currentFocusedNode, document.querySelector('.focus-mode-overlay'));
                        return;
                    }

                    // HTML content as last resort
                    if (htmlData) {
                        // Strip HTML tags for text content
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = htmlData;
                        const textContent = tempDiv.textContent || tempDiv.innerText || '';

                        if (textContent.trim()) {
                            window.dataCardStore.addPacket(nodeId, {
                                type: 'text',
                                data: { content: textContent.trim(), html: htmlData },
                                value: textContent.trim()
                            });
                            this.showToast('Content card added');
                            this.loadFocusIOData(this.currentFocusedNode, document.querySelector('.focus-mode-overlay'));
                        }
                    }
                }
            });
        }

        // ========== PASTE BUTTON CLICK HANDLER ==========
        const pasteBtn = overlay.querySelector('#focus-paste-btn');
        if (pasteBtn) {
            pasteBtn.addEventListener('click', async () => {
                const nodeId = window.actionBar?.currentFocusedNode?.id;
                if (!nodeId) {
                    console.warn('[FocusMode] Paste: No focused node');
                    return;
                }

                try {
                    // Try using Electron API first
                    if (window.electronAPI && window.electronAPI.readClipboard) {
                        const clipboardData = await window.electronAPI.readClipboard();

                        if (clipboardData) {
                            // Check for image
                            if (clipboardData.hasImage && clipboardData.image) {
                                if (window.dataCardStore) {
                                    window.dataCardStore.addPacket(nodeId, {
                                        type: 'image',
                                        dataUrl: clipboardData.image,
                                        value: clipboardData.image
                                    }, 'local', { append: true });
                                    console.log('[FocusMode] Image pasted to Outgoing (Electron)');
                                    window.actionBar?.showToast('Image added to Outgoing panel');
                                }
                                return;
                            }

                            // Check for text
                            if (clipboardData.text && clipboardData.text.trim()) {
                                if (window.dataCardStore) {
                                    const text = clipboardData.text.trim();
                                    // Basic SVG detection
                                    const isSvg = text.toLowerCase().startsWith('<svg');
                                    const type = isSvg ? 'svg' : 'text';

                                    window.dataCardStore.addPacket(nodeId, {
                                        type: type,
                                        content: text,
                                        value: text
                                    }, 'local', { append: true });

                                    console.log(`[FocusMode] ${type} pasted to Outgoing (Electron)`);
                                    window.actionBar?.showToast(`${type} added to Outgoing panel`);
                                }
                                return;
                            }
                        }
                    }

                    // Fallback to Web API (navigator.clipboard)
                    // ... (keep existing logic as fallback or remove if confident)

                    window.actionBar?.showToast('Clipboard is empty');
                } catch (e) {
                    console.warn('[FocusMode] Clipboard read failed:', e);
                    window.actionBar?.showToast('Cannot read clipboard');
                }
            });
        }

        // ========== PASTE HANDLER: Cmd+V → Outgoing Panel ==========
        overlay.addEventListener('paste', async (e) => {
            const nodeId = window.actionBar?.currentFocusedNode?.id;
            if (!nodeId) {
                console.warn('[FocusMode] Paste: No focused node');
                return;
            }

            const clipboardData = e.clipboardData;
            if (!clipboardData) return;

            console.log('[FocusMode] Paste event detected');

            // Handle images first
            for (const item of clipboardData.items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            window.dataCardStore?.addPacket(nodeId, {
                                type: 'image',
                                dataUrl: event.target.result,
                                value: event.target.result
                            });
                            console.log('[FocusMode] Image pasted to Outgoing');
                            window.actionBar?.showToast('Image added to Outgoing panel');
                        };
                        reader.readAsDataURL(file);
                        return; // Only handle first image
                    }
                }
            }

            // Handle text/html
            const html = clipboardData.getData('text/html');
            const text = clipboardData.getData('text/plain');
            if (html || text) {
                window.dataCardStore?.addPacket(nodeId, {
                    type: html ? 'html' : 'text',
                    value: html || text,
                    content: html || text
                });
                console.log('[FocusMode] Text/HTML pasted to Outgoing');
                window.actionBar?.showToast('Content added to Outgoing panel');
            }
        });

        // Make overlay focusable for paste events
        overlay.tabIndex = -1;

        document.body.appendChild(overlay);
        return overlay;
    }

    loadFocusIOData(node, overlay) {
        // Guard clause for null parameters
        if (!node || !overlay) {
            console.warn('[ActionBar] loadFocusIOData: node or overlay is null');
            return;
        }

        const nodeId = node.id;
        const incomingContainer = overlay.querySelector('#focus-incoming-cards');
        const outgoingContainer = overlay.querySelector('#focus-outgoing-cards');

        // Empty state HTML templates
        const emptyIncomingHTML = `
            <div class="focus-panel-empty">
                <i class="fas fa-plug"></i>
                Connect a node to receive data
            </div>
        `;
        const emptyOutgoingHTML = `
            <div class="focus-panel-empty">
                <i class="fas fa-mouse-pointer"></i>
                No data output yet
            </div>
        `;

        // Always reset panels first
        if (incomingContainer) incomingContainer.innerHTML = emptyIncomingHTML;
        if (outgoingContainer) outgoingContainer.innerHTML = emptyOutgoingHTML;

        // Get data packets from DataCardStore
        const incomingPackets = window.dataCardStore?.getIncomingPackets(nodeId) || [];
        const outgoingPackets = window.dataCardStore?.getOutgoingPackets(nodeId) || [];

        // Render incoming data cards (actual data from connected nodes)
        if (incomingPackets.length > 0 && incomingContainer) {
            incomingContainer.innerHTML = '';
            incomingPackets.forEach(packet => {
                const card = this.createDataCard(packet, 'incoming');
                incomingContainer.appendChild(card);
            });
        }

        // Render outgoing data cards (data produced by this node)
        if (outgoingPackets.length > 0 && outgoingContainer) {
            outgoingContainer.innerHTML = '';
            outgoingPackets.forEach(packet => {
                const card = this.createDataCard(packet, 'outgoing');
                outgoingContainer.appendChild(card);
            });
        }

        // Subscribe to updates for pulse animation
        // MOVED: Subscription should be handled in enterFocusMode, not here!
        // this.subscribeToPanelUpdates(nodeId);
    }

    /**
     * Setup subscriptions for focus mode updates
     * Should be called ONCE when entering focus mode
     */
    setupFocusSubscriptions(nodeId) {
        // Remove existing subscription
        if (this._storeUnsubscribe) {
            this._storeUnsubscribe();
            this._storeUnsubscribe = null;
        }

        if (!window.dataCardStore) return;

        // Debounce update function to prevent CPU spiking
        const handleUpdate = (updatedNodeId, packet, eventType) => {
            // Check if this update affects our focused node
            const overlay = document.getElementById('focus-overlay');
            if (!overlay || !overlay.classList.contains('active')) return;
            if (!this.currentFocusedNode) return;

            const focusedId = this.currentFocusedNode.id;

            // 1. Check Incoming - if the update is FOR our focused node (target)
            // AND the packet is from a different node (source)
            if (updatedNodeId === focusedId && packet.sourceNodeId && packet.sourceNodeId !== focusedId) {
                const container = overlay.querySelector('#focus-incoming-cards');
                this.updateOrAddCard(container, packet, 'incoming');
            }

            // 2. Check Outgoing - ONLY data produced by the focused node
            if (updatedNodeId === focusedId && packet.sourceNodeId === focusedId) {
                const container = overlay.querySelector('#focus-outgoing-cards');
                this.updateOrAddCard(container, packet, 'outgoing');
            }
        };

        // Throttle updates to max 10 per second per node
        let updateTimeout;
        this._storeUnsubscribe = window.dataCardStore.subscribe((updatedNodeId, packet, eventType) => {
            // Immediate update for UI responsiveness, but prevent stack overflow loops
            // Using requestAnimationFrame to decouple from data loop
            requestAnimationFrame(() => handleUpdate(updatedNodeId, packet, eventType));
        });
    }

    /**
     * Efficiently update or add a single card without rebuilding entire panel
     */
    updateOrAddCard(container, packet, direction) {
        if (!container) return;

        // Remove empty state message if present
        const emptyState = container.querySelector('.focus-panel-empty');
        if (emptyState) emptyState.remove();

        // 1. Try to find existing card
        const existingCard = container.querySelector(`[data-packet-id="${packet.id}"]`);

        if (existingCard) {
            // Update existing card
            existingCard.classList.add('updated');
            setTimeout(() => existingCard.classList.remove('updated'), 500);

            // Refresh content (preview)
            const preview = existingCard.querySelector('.focus-data-card-preview');
            if (preview) {
                // Re-generate preview content based on type
                // Use a helper method or duplicate logic from createDataCard for preview generation
                // Ideally extract preview generation to a separate method: this.generateCardPreview(packet)
                const newPreviewHTML = this.generateCardPreviewHTML(packet);
                preview.innerHTML = newPreviewHTML;
            }

            // Update source info for timestamp/updates if needed
            // const source = existingCard.querySelector('.focus-data-card-source');
            // ...
        } else {
            // 2. Create new card
            const card = this.createDataCard(packet, direction);
            card.classList.add('updated'); // Flash on enter
            container.appendChild(card);
            setTimeout(() => card.classList.remove('updated'), 500);
        }
    }

    /**
     * Generate HTML for card preview properly
     */
    generateCardPreviewHTML(packet) {
        switch (packet.type) {
            case 'image':
                // Support both dataUrl (base64) and regular URL
                const imageSource = packet.data.dataUrl || packet.data.value || packet.data.content;
                if (imageSource) {
                    // Check if it's a valid URL or dataUrl
                    const isValidSrc = imageSource.startsWith('data:') ||
                        imageSource.startsWith('http://') ||
                        imageSource.startsWith('https://');
                    if (isValidSrc) {
                        // Use onerror to handle CORS blocked images
                        return `<img src="${imageSource}" alt="Preview" 
                                style="max-width:100%;max-height:80px;border-radius:4px;object-fit:contain;"
                                onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                                <span style="display:none;align-items:center;gap:4px;color:#888;font-size:11px;">
                                    <i class="fas fa-image"></i> Image (preview unavailable)
                                </span>`;
                    }
                }
                return '<i class="fas fa-image"></i> Image';

            case 'text':
                const textContent = packet.data.content || packet.data.value || '';
                const truncatedText = textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;
                return truncatedText || 'Empty text';

            case 'svg':
                const svgContent = packet.data.content || packet.data.value || '';
                if (svgContent.includes('<svg')) {
                    return `<div style="max-width:100%;max-height:60px;overflow:hidden;">${svgContent}</div>`;
                } else {
                    return '<i class="fas fa-bezier-curve"></i> SVG';
                }

            case 'html':
                return '<i class="fas fa-code"></i> HTML Content';

            case 'file':
                const fileName = packet.data.name || 'File';
                const fileSize = packet.data.size ? this.formatFileSize(packet.data.size) : '';
                return `<i class="fas fa-file"></i> ${fileName} ${fileSize ? `(${fileSize})` : ''}`;

            case 'color':
                const hex = packet.data.hex || packet.data.value || '#000000';
                return `
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div style="width:24px;height:24px;background:${hex};border-radius:4px;border:1px solid rgba(255,255,255,0.2);"></div>
                        <span>${hex}</span>
                    </div>
                `;

            case 'url':
                const urlValue = packet.data.value || packet.data.content || '';
                const truncatedUrl = urlValue.length > 50 ? urlValue.substring(0, 50) + '...' : urlValue;
                return `<i class="fas fa-link"></i> ${truncatedUrl}`;

            default:
                const rawValue = packet.data.value || packet.data.content || JSON.stringify(packet.data);
                const truncated = String(rawValue).substring(0, 80);
                return truncated + (rawValue.length > 80 ? '...' : '');
        }
    }

    /**
     * Create a data card with type-aware preview and drag support
     */
    createDataCard(packet, direction) {
        const card = document.createElement('div');
        card.className = 'focus-data-card';
        card.draggable = true;
        card.dataset.packetId = packet.id;
        card.dataset.packetType = packet.type;

        // Type badge with appropriate color
        const typeColors = {
            image: 'image',
            text: 'text',
            svg: 'svg',
            html: 'html',
            file: 'file',
            color: 'color'
        };
        const typeClass = typeColors[packet.type] || 'text';

        // Create header
        const header = document.createElement('div');
        header.className = 'focus-data-card-header';
        header.innerHTML = `<span class="focus-data-card-type ${typeClass}">${packet.type.toUpperCase()}</span>`;

        // Add delete button and Drop handlers for outgoing cards only
        if (direction === 'outgoing') {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'focus-data-card-delete';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.title = 'Remove from Outgoing';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Get node ID from focused node
                const nodeId = this.currentFocusedNode?.id;
                if (nodeId && window.dataCardStore) {
                    window.dataCardStore.removePacket(nodeId, packet.id, 'outgoing');
                    card.remove();
                    this.showToast('Card removed', 'info');
                }
            });
            header.appendChild(deleteBtn);

            // Add Drop Listener for Replace Functionality
            card.addEventListener('dragover', (e) => {
                e.preventDefault(); // Allow drop
                e.stopPropagation();
                card.classList.add('drag-replace-target');
            });

            card.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                card.classList.remove('drag-replace-target');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                card.classList.remove('drag-replace-target');

                console.log('[FocusMode] Drop on card - replace attempt');
                console.log('[FocusMode] Target packet id:', packet.id);

                const packetDataStr = e.dataTransfer.getData('application/mosaic-packet');
                if (packetDataStr) {
                    try {
                        const newPacket = JSON.parse(packetDataStr);
                        console.log('[FocusMode] New packet to replace with:', newPacket);

                        const nodeId = this.currentFocusedNode?.id;
                        console.log('[FocusMode] Node ID:', nodeId);

                        if (window.dataCardStore && nodeId) {
                            // Use addPacket with replaceId option
                            window.dataCardStore.addPacket(nodeId, {
                                type: newPacket.type,
                                data: newPacket.data,
                                value: newPacket.value || newPacket.data?.value,
                                content: newPacket.content || newPacket.data?.content,
                                width: newPacket.width,
                                height: newPacket.height
                            }, 'local', { replaceId: packet.id });

                            this.showToast('Card replaced successfully');
                            // Reload panel
                            this.loadFocusIOData(this.currentFocusedNode, document.querySelector('.focus-mode-overlay'));
                        }
                    } catch (err) {
                        console.error('Failed to parse dropped packet:', err);
                    }
                } else {
                    // Try other data types (from webview/external sources)
                    const htmlData = e.dataTransfer.getData('text/html');
                    const uriData = e.dataTransfer.getData('text/uri-list');
                    const textData = e.dataTransfer.getData('text/plain');

                    const nodeId = this.currentFocusedNode?.id;
                    if (!nodeId || !window.dataCardStore) return;

                    let newData = null;

                    // Check Files first (Native Drag / OS Drop)
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const file = e.dataTransfer.files[0];
                        if (file.path) {
                            if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.name)) {
                                newData = { type: 'image', data: { dataUrl: file.path, value: file.path }, value: file.path };
                            } else {
                                newData = { type: 'file', data: { fileName: file.name, path: file.path }, fileName: file.name };
                            }
                        }
                    }

                    // Check for image in HTML
                    if (htmlData) {
                        const imgMatch = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i);
                        if (imgMatch && imgMatch[1]) {
                            newData = { type: 'image', data: { dataUrl: imgMatch[1], value: imgMatch[1] }, value: imgMatch[1] };
                        }
                    }

                    // Check URI
                    if (!newData && uriData) {
                        const url = uriData.trim().split('\n')[0];
                        if (/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(url)) {
                            newData = { type: 'image', data: { dataUrl: url, value: url }, value: url };
                        } else {
                            newData = { type: 'url', data: { content: url, value: url }, value: url };
                        }
                    }

                    // Text fallback
                    if (!newData && textData) {
                        newData = { type: 'text', data: { content: textData }, value: textData };
                    }

                    if (newData) {
                        window.dataCardStore.addPacket(nodeId, newData, 'local', { replaceId: packet.id });
                        this.showToast('Card replaced successfully');
                        this.loadFocusIOData(this.currentFocusedNode, document.querySelector('.focus-mode-overlay'));
                    }
                }
            });
        }

        // Create preview based on data type
        const preview = document.createElement('div');
        preview.className = 'focus-data-card-preview';
        preview.innerHTML = this.generateCardPreviewHTML(packet);

        // Create source info
        const source = document.createElement('div');
        source.className = 'focus-data-card-source';
        if (direction === 'incoming') {
            source.innerHTML = `<i class="fas fa-arrow-left"></i> From: ${packet.sourceTitle}`;
        } else {
            source.innerHTML = `<i class="fas fa-arrow-right"></i> Ready to share`;
        }

        card.append(header, preview, source);

        // Ensure file backing BEFORE setting up drag handlers
        // This way the file is ready when user starts dragging
        const fileBackedTypes = ['image', 'svg', 'text', 'html'];
        if (fileBackedTypes.includes(packet.type)) {
            // Start file backing process (don't await - let it run in background)
            this.prepareFileForDrag(packet).then(() => {
                console.log('[ActionBar] Card file ready:', packet.id, packet.filePath);
            });
        }

        // Setup drag handlers for native file drag
        this.setupCardDrag(card, packet);

        return card;
    }

    /**
     * Prepare file for drag - creates file and caches absolute path
     */
    async prepareFileForDrag(packet) {
        // Create file if not exists
        if (!packet.filePath) {
            await this.ensureFileBackedCard(packet);
        }

        // Cache absolute path for fast drag access
        if (packet.filePath && window.electronAPI?.getCardFilePath && !packet._absolutePath) {
            try {
                const result = await window.electronAPI.getCardFilePath(packet.filePath);
                if (result?.success && result.absolutePath && result.exists) {
                    packet._absolutePath = result.absolutePath;
                    packet._fileReady = true;
                }
            } catch (err) {
                console.warn('[ActionBar] Failed to cache file path:', err);
            }
        }
    }

    /**
     * Ensure card has file backing for native drag
     * Writes content to temp file and sets packet.filePath
     */
    async ensureFileBackedCard(packet) {
        // Skip if already has file path
        if (packet.filePath) {
            console.log('[ActionBar] Card already file-backed:', packet.filePath);
            return;
        }

        // Skip if no electronAPI
        if (!window.electronAPI?.writeCardFile) {
            console.log('[ActionBar] electronAPI not available, skipping file backing');
            return;
        }

        try {
            let content = null;
            let type = packet.type;

            if (type === 'image') {
                // Get image data (base64 or URL)
                let imageData = packet._cachedBase64 || packet.data?.dataUrl || packet.data?.value || packet.value;

                // If URL, convert to base64 first
                if (imageData && !imageData.startsWith('data:')) {
                    console.log('[ActionBar] Converting URL image to base64 for file...');
                    const response = await fetch(imageData);
                    const blob = await response.blob();
                    imageData = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    packet._cachedBase64 = imageData;
                }

                content = imageData;
            } else if (type === 'svg') {
                content = packet.data?.content || packet.data?.value || packet.value || '';
            } else if (type === 'text') {
                content = packet.data?.content || packet.data?.value || packet.value || '';
            } else if (type === 'html') {
                content = packet.data?.content || packet.data?.html || packet.value || '';
            }

            if (!content) {
                console.log('[ActionBar] No content to write for', type);
                return;
            }

            console.log('[ActionBar] Writing file for card:', packet.id, type);
            const result = await window.electronAPI.writeCardFile(packet.id, type, content);

            if (result?.success) {
                packet.filePath = result.filePath;
                console.log('[ActionBar] Card file created:', packet.filePath);
            } else {
                console.warn('[ActionBar] Failed to create card file:', result?.error);
            }
        } catch (err) {
            console.error('[ActionBar] Error ensuring file-backed card:', err);
        }
    }

    /**
     * Pre-load URL image as base64 for sync drag access (legacy, calls ensureFileBackedCard)
     */
    async preloadImageAsBase64(packet) {
        // Use the new comprehensive method
        await this.ensureFileBackedCard(packet);
    }

    /**
     * Format file size to human readable
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Setup drag handlers for native file drag to external apps (Figma, Finder, etc.)
     */
    setupCardDrag(card, packet) {
        // Ensure draggable is true
        card.draggable = true;

        card.addEventListener('dragstart', (e) => {
            // CRITICAL FIX: Use Native Drag exclusively when file is ready AND NOT TEXT.
            // Prevents HTML5 drag conflict that locks UI cursor
            // Exception: Text cards should use HTML5 drag to allow content drop into external apps
            if (packet.type !== 'text' && packet._fileReady && packet._absolutePath && window.electronAPI?.startNativeDrag) {
                e.preventDefault(); // Stop HTML5 drag engine

                console.log('[ActionBar] Starting NATIVE drag (HTML5 prevented):', packet.filePath);
                window.electronAPI.startNativeDrag(packet.filePath)
                    .then(result => {
                        if (result?.success) console.log('[ActionBar] Native drag started');
                        else console.warn('[ActionBar] Native drag failed:', result?.error);
                    })
                    .catch(err => console.error('[ActionBar] Native drag error:', err));
            } else {
                // Fallback: Standard HTML5 drag (Internal only)
                card.classList.add('dragging');
                document.body.classList.add('mosaic-dragging');

                e.dataTransfer.setData('application/mosaic-packet', JSON.stringify(packet));

                if (packet.type === 'image') {
                    const dataUrl = packet._cachedBase64 || packet.data?.dataUrl || packet.data?.value;
                    if (dataUrl) {
                        e.dataTransfer.setData('text/html', `<img src="${dataUrl}">`);
                        e.dataTransfer.setData('text/uri-list', dataUrl);
                        if (!dataUrl.startsWith('data:')) {
                            e.dataTransfer.setData('text/plain', dataUrl);
                        }
                    }
                } else if (packet.type === 'text') {
                    const text = packet.data?.content || packet.data?.value || '';
                    e.dataTransfer.setData('text/plain', text);
                    // Also set HTML format for better compatibility
                    e.dataTransfer.setData('text/html', `<p>${text}</p>`);
                } else if (packet.type === 'svg') {
                    const svg = packet.data?.content || packet.data?.value || '';
                    e.dataTransfer.setData('image/svg+xml', svg);
                    e.dataTransfer.setData('text/html', svg);
                    e.dataTransfer.setData('text/plain', svg);
                } else if (packet.type === 'color') {
                    const hex = packet.data?.hex || packet.data?.value || '';
                    e.dataTransfer.setData('text/plain', hex);
                } else if (packet.type === 'file') {
                    const fileName = packet.fileName || packet.data?.fileName || 'file';
                    e.dataTransfer.setData('text/plain', fileName);
                }

                console.log('[ActionBar] HTML5 Drag started (fallback)');

                // Safety: Cleanup on window focus (fixes stuck state if drop outside misses dragend)
                const fallbackCleanup = () => {
                    card.classList.remove('dragging');
                    document.body.classList.remove('mosaic-dragging');
                    window.removeEventListener('focus', fallbackCleanup);
                };
                window.addEventListener('focus', fallbackCleanup);
            }
        });

        card.addEventListener('dragend', (e) => {
            // Only fires for HTML5 fallback
            card.classList.remove('dragging');
            document.body.classList.remove('mosaic-dragging');
            console.log('[ActionBar] HTML5 Drag ended');
        });

        // Click to copy to clipboard
        card.addEventListener('click', async () => {
            await this.copyPacketToClipboard(packet);
            this.showToastForPacket(packet);
            card.classList.add('updated');
            setTimeout(() => card.classList.remove('updated'), 500);
        });
    }

    /**
     * Copy packet data to system clipboard
     */
    async copyPacketToClipboard(packet) {
        try {
            if (packet.type === 'image') {
                let dataUrl = packet.data.dataUrl || packet.data.value;

                if (!dataUrl) {
                    console.warn('[ActionBar] No image data to copy');
                    return;
                }

                // If it's a URL (not base64), fetch and convert to base64
                if (!dataUrl.startsWith('data:')) {
                    console.log('[ActionBar] Converting URL image to base64...');
                    try {
                        const response = await fetch(dataUrl);
                        const blob = await response.blob();
                        dataUrl = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                        console.log('[ActionBar] URL converted to base64 successfully');
                    } catch (fetchErr) {
                        console.error('[ActionBar] Failed to fetch image URL:', fetchErr);
                        // Fallback: copy URL as text
                        if (window.electronAPI?.writeClipboardText) {
                            window.electronAPI.writeClipboardText(packet.data.dataUrl || packet.data.value);
                            console.log('[ActionBar] Copied image URL as text instead');
                        }
                        return;
                    }
                }

                // Now dataUrl is guaranteed to be base64
                if (window.electronAPI?.writeClipboardImage) {
                    const result = await window.electronAPI.writeClipboardImage(dataUrl);
                    if (result?.success) {
                        console.log('[ActionBar] Image copied to clipboard (Electron)');
                    } else {
                        console.warn('[ActionBar] Clipboard write failed:', result?.error);
                    }
                } else {
                    // Fallback to web API
                    const response = await fetch(dataUrl);
                    const blob = await response.blob();
                    await navigator.clipboard.write([
                        new ClipboardItem({ [blob.type]: blob })
                    ]);
                    console.log('[ActionBar] Image copied to clipboard (Web API)');
                }
            } else if (packet.type === 'text' || packet.type === 'color') {
                const text = packet.data.content || packet.data.value || packet.data.hex || '';
                if (window.electronAPI?.writeClipboardText) {
                    window.electronAPI.writeClipboardText(text);
                    console.log('[ActionBar] Text copied to clipboard (Electron)');
                } else {
                    await navigator.clipboard.writeText(text);
                }
            } else if (packet.type === 'svg') {
                const svg = packet.data.content || packet.data.value || '';
                if (window.electronAPI?.writeClipboardText) {
                    window.electronAPI.writeClipboardText(svg);
                } else {
                    await navigator.clipboard.writeText(svg);
                }
                console.log('[ActionBar] SVG copied to clipboard');
            }
        } catch (e) {
            console.warn('[ActionBar] Clipboard write failed:', e);
        }
    }

    /**
     * Show toast feedback for copied packet
     */
    showToastForPacket(packet) {
        let msg = 'Copied to clipboard!';
        if (packet.type === 'image') {
            msg = 'Image copied! <br>In Figma: Select image and <b>Cmd+V</b> to replace.';
        } else if (packet.type === 'color') {
            msg = `Color copied: ${packet.data.hex || packet.data.value}`;
        }

        this.showToast(msg);
    }

    /**
     * Display a toast notification
     */
    showToast(html) {
        const toast = document.createElement('div');
        toast.className = 'mosaic-toast';
        toast.innerHTML = html;
        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => toast.classList.add('visible'));

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Subscribe to DataCardStore updates for pulse animation
     */
    subscribeToPanelUpdates(nodeId) {
        // Remove existing subscription
        if (this._storeUnsubscribe) {
            this._storeUnsubscribe();
        }

        if (!window.dataCardStore) return;

        this._storeUnsubscribe = window.dataCardStore.subscribe((updatedNodeId, packet, eventType) => {
            // Check if this update affects our focused node
            const overlay = document.getElementById('focus-overlay');
            if (!overlay || !overlay.classList.contains('active')) return;
            if (!this.currentFocusedNode) return;

            const focusedId = this.currentFocusedNode.id;

            // If incoming packet source is connected to focused node
            // Incoming should ONLY show data from connected nodes, NOT from self
            if (packet.sourceNodeId && packet.sourceNodeId !== focusedId && window.connections) {
                const isConnected = window.connections.some(
                    c => c.source === packet.sourceNodeId && c.target === focusedId
                );
                if (isConnected) {
                    // Pulse the relevant card
                    const container = overlay.querySelector('#focus-incoming-cards');
                    const card = container?.querySelector(`[data-packet-id="${packet.id}"]`);
                    if (card) {
                        card.classList.add('updated');
                        setTimeout(() => card.classList.remove('updated'), 500);
                    } else {
                        // Reload panels to show new card
                        this.loadFocusIOData(this.currentFocusedNode, overlay);
                    }
                }
            }

            // If outgoing from focused node
            if (updatedNodeId === focusedId) {
                const container = overlay.querySelector('#focus-outgoing-cards');
                const card = container?.querySelector(`[data-packet-id="${packet.id}"]`);
                if (card) {
                    card.classList.add('updated');
                    setTimeout(() => card.classList.remove('updated'), 500);
                } else {
                    // Reload panels
                    this.loadFocusIOData(this.currentFocusedNode, overlay);
                }
            }
        });
    }

    updateLockIndicator(node, isLocked) {
        // Remove existing lock indicator (backward compatibility)
        const existingIndicator = node.querySelector('.lock-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        const iconWrapper = node.querySelector('.node-icon-wrapper');
        const icon = node.querySelector('.node-icon-wrapper i');

        if (!iconWrapper || !icon) return;

        if (isLocked) {
            // Save original icon class if not already saved
            if (!node.dataset.originalIconClass) {
                node.dataset.originalIconClass = icon.className;
            }

            // Change icon to lock
            icon.className = 'fas fa-lock';

            // Add locked class to node for CSS styling (gray background)
            node.classList.add('locked');
        } else {
            // Restore original icon
            if (node.dataset.originalIconClass) {
                icon.className = node.dataset.originalIconClass;
                delete node.dataset.originalIconClass;
            }

            // Remove locked class
            node.classList.remove('locked');
        }
    }

    createButton(icon, title) {
        const btn = document.createElement('div');
        btn.className = 'action-bar-item';
        btn.setAttribute('data-tooltip', title);
        btn.innerHTML = `<i class="fas ${icon}"></i>`;
        return btn;
    }

    addSeparator() {
        const sep = document.createElement('div');
        sep.className = 'action-bar-separator';
        this.element.appendChild(sep);
    }

    getViewportCenter() {
        // Calculate center based on canvas offset and scale
        // This logic might need to be adjusted based on canvas.js implementation
        const canvas = document.getElementById('canvas');
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const centerX = (window.innerWidth / 2 - window.canvasOffset.x) / window.canvasScale;
        const centerY = (window.innerHeight / 2 - window.canvasOffset.y) / window.canvasScale;

        return { x: centerX, y: centerY };
    }

    // Method to manually update state (can be called from nodes.js)
    update(count) {
        this.selectedCount = count;
        this.render();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('ActionBar: DOM fully loaded, initializing ActionBar.');
    window.actionBar = new ActionBar();
});
