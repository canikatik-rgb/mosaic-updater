/**
 * Drawing System
 * Handles freehand drawing on the canvas using SVG and manages the Drawing Toolbar
 */

class DrawingSystem {
    constructor() {
        this.isDrawing = false;
        this.isActive = false;
        this.currentPathId = null;
        this.points = [];
        this.startPoint = null;
        this.drawings = [];

        // Tool Settings
        this.tool = 'brush';
        this.brushType = 'solid';
        this.strokeWidth = 4;
        this.color = '#000000'; // Initial default

        // Constants
        this.ERASER_WIDTH_MULTIPLIER = 4;

        // DOM Elements
        this.svgLayer = null;
        this.pathElement = null; // Currently being drawn
        this.toolbar = null;
        this.anchorBtn = null;
        this.eraserCursor = null;

        this.init();
    }

    init() {
        // Don't auto-setup on load - wait for canvas to be created
        // The setup will be triggered by calling reinitialize() after canvas is ready
        window.drawingSystem = this;

        // Inject styles immediately (they don't need canvas)
        this.injectStyles();
    }

    /**
     * Reinitialize the drawing system after canvas-content is created.
     * This should be called from initializeAppUI() after initCanvas().
     */
    reinitialize() {
        console.log('[DrawingSystem] Reinitializing...');

        // Check if SVG layer already exists and remove it
        const existingSvg = document.getElementById('drawing-layer');
        if (existingSvg) {
            existingSvg.remove();
            this.svgLayer = null;
        }

        this.setup();
    }

    setup() {
        const canvasContent = document.getElementById('canvas-content');
        if (!canvasContent) {
            console.warn('[DrawingSystem] canvas-content not found. Call reinitialize() after canvas is created.');
            return;
        }

        this.createSvgLayer();

        if (!this.svgLayer) {
            console.error('[DrawingSystem] Failed to create SVG layer');
            return;
        }

        this.defineSvgMarkers();
        this.setupEventListeners();

        // Set default color based on theme
        this.color = document.body.classList.contains('night-mode') ? '#ffffff' : '#000000';

        console.log('[DrawingSystem] Setup complete, SVG layer:', this.svgLayer);
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .drawing-toolbar {
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--ui-bg, #ffffff);
                color: var(--ui-text, #333333);
                backdrop-filter: blur(10px);
                padding: 12px;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10000;
                border: 1px solid var(--modal-border, #e0e0e0);
                min-width: 320px;
                max-width: 90vw;
                transition: background-color 0.3s, color 0.3s;
            }
            .drawing-toolbar.hidden {
                display: none;
            }
            /* Row 1: Tools & Size */
            .dt-row-tools {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
            .dt-group {
                display: flex;
                gap: 4px;
                align-items: center;
                background: var(--bg-color, #f7f9fb);
                padding: 4px;
                border-radius: 8px;
                border: 1px solid var(--modal-border, transparent);
            }
            .dt-btn {
                width: 32px;
                height: 32px;
                border-radius: 6px;
                border: 1px solid transparent;
                background: transparent;
                color: var(--ui-text, #333333);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                transition: all 0.2s;
            }
            .dt-btn:hover {
                background: var(--button-hover, #efefef);
            }
            .dt-btn.active {
                background: var(--primary-color, #00a8ff);
                color: white !important;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            /* Row 2: Colors */
            .dt-row-colors {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-wrap: wrap;
                gap: 8px;
                padding-top: 8px;
                border-top: 1px solid var(--modal-border, #e0e0e0);
            }
            .dt-color-circle {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                border: 1px solid rgba(0,0,0,0.1);
                transition: transform 0.2s;
                position: relative;
            }
            .dt-color-circle:hover {
                transform: scale(1.2);
                z-index: 2;
            }
            .dt-color-circle.active {
                border-color: var(--ui-text, #333333);
                transform: scale(1.1);
                box-shadow: 0 0 0 2px var(--primary-color, #00a8ff);
                z-index: 1;
            }
            .fa-dashed-rotated {
                transform: rotate(-45deg);
            }
        `;
        document.head.appendChild(style);
    }

    createSvgLayer() {
        const canvasContent = document.getElementById('canvas-content');
        if (!canvasContent) return;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'drawing-layer';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        // Match canvas-content dimensions (100000px x 100000px from canvas.js)
        // Using 100% doesn't work because it only covers viewport, not the transformed canvas
        svg.style.width = '100000px';
        svg.style.height = '100000px';
        svg.style.pointerEvents = 'none';
        // Ensure high index to be on top and clickable when active
        svg.style.zIndex = '9999';

        canvasContent.appendChild(svg);
        this.svgLayer = svg;
    }

    defineSvgMarkers() {
        if (!this.svgLayer) return;

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.id = 'arrow-head';
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('fill', 'context-stroke');

        marker.appendChild(path);
        defs.appendChild(marker);
        this.svgLayer.appendChild(defs);
    }

    setupEventListeners() {
        // We bind 'mousedown' to the SVG layer itself to ensure we capture the event
        // This solves issues where other elements might capture or block the event
        if (!this.svgLayer) return;

        this.svgLayer.addEventListener('mousedown', (e) => {
            if (!this.isActive) return;
            if (e.button !== 0) return; // Only left click

            // Critical: Prevent default and Propagation to stop Canvas Pan/Zoom
            e.preventDefault();
            e.stopPropagation();

            this.startDrawing(e);
        });

        // Mouse Move and Up should be on window to handle dragging outside element
        window.addEventListener('mousemove', (e) => {
            if (!this.isActive || !this.isDrawing) return;
            this.draw(e);
        });

        window.addEventListener('mouseup', () => {
            if (this.isDrawing) {
                this.stopDrawing();
            }
        });
    }

    createToolbar() {
        if (this.toolbar) return;

        const toolbar = document.createElement('div');
        toolbar.className = 'drawing-toolbar hidden';

        // --- ROW 1: Tools ---
        const toolsRow = document.createElement('div');
        toolsRow.className = 'dt-row-tools';

        // Group 1: Pens
        const penGroup = document.createElement('div');
        penGroup.className = 'dt-group';

        const types = [
            { id: 'solid', icon: 'fa-pen', title: 'Solid Pen' },
            { id: 'dashed', icon: 'fa-grip-lines fa-dashed-rotated', title: 'Dashed Pen' },
            { id: 'marker', icon: 'fa-highlighter', title: 'Marker' }
        ];

        types.forEach(t => {
            const btn = this.createBtn(t.icon, t.title, () => {
                this.setTool('brush');
                this.setBrushType(t.id);
            });
            btn.dataset.tool = 'brush';
            btn.dataset.id = t.id;
            penGroup.appendChild(btn);
        });

        // Arrow
        const arrowBtn = this.createBtn('fa-long-arrow-alt-right', 'Arrow', () => {
            this.setTool('arrow');
        });
        arrowBtn.dataset.tool = 'arrow';
        penGroup.appendChild(arrowBtn);

        toolsRow.appendChild(penGroup);

        // Group 2: Eraser
        const eraserGroup = document.createElement('div');
        eraserGroup.className = 'dt-group';
        const eraserBtn = this.createBtn('fa-eraser', 'Eraser', () => {
            this.setTool('eraser');
        });
        eraserBtn.dataset.tool = 'eraser';
        eraserGroup.appendChild(eraserBtn);
        toolsRow.appendChild(eraserGroup);

        // Group 3: Size
        const sizeGroup = document.createElement('div');
        sizeGroup.className = 'dt-group';
        const sizes = [4, 8, 16];
        sizes.forEach(s => {
            const btn = document.createElement('button');
            btn.className = 'dt-btn size-btn';
            btn.dataset.width = s;
            const dot = document.createElement('div');
            dot.style.width = Math.min(s, 16) + 'px';
            dot.style.height = Math.min(s, 16) + 'px';
            dot.style.borderRadius = '50%';
            dot.style.background = 'currentColor';
            btn.appendChild(dot);
            btn.onclick = () => {
                this.setStrokeWidth(s);
                this.updateToolbarUI();
            };
            sizeGroup.appendChild(btn);
        });
        toolsRow.appendChild(sizeGroup);

        toolbar.appendChild(toolsRow);

        // --- ROW 2: Colors ---
        const colorsRow = document.createElement('div');
        colorsRow.className = 'dt-row-colors';

        const colors = [
            '#000000', '#ffffff', '#ff3b30', '#ff9500', '#ffcc00',
            '#4cd964', '#5ac8fa', '#007aff', '#5856d6', '#ff2d55'
        ];

        colors.forEach(c => {
            const circle = document.createElement('div');
            circle.className = 'dt-color-circle';
            circle.dataset.color = c;
            circle.style.backgroundColor = c;
            circle.onclick = () => {
                this.setColor(c);
                if (this.tool === 'eraser') this.setTool('brush');
                this.updateToolbarUI();
            };
            colorsRow.appendChild(circle);
        });

        toolbar.appendChild(colorsRow);

        document.body.appendChild(toolbar);
        this.toolbar = toolbar;
    }

    createBtn(iconClass, title, onClick) {
        const btn = document.createElement('button');
        btn.className = 'dt-btn tool-btn';
        btn.innerHTML = `<i class="fas ${iconClass}"></i>`;
        btn.title = title;
        btn.onclick = () => {
            onClick();
            this.updateToolbarUI();
        };
        return btn;
    }

    updateToolbarUI() {
        if (!this.toolbar) return;

        // Tools
        const toolBtns = this.toolbar.querySelectorAll('.tool-btn');
        toolBtns.forEach(btn => {
            const cat = btn.dataset.tool;
            const id = btn.dataset.id;
            let active = false;

            if (this.tool === 'eraser') active = cat === 'eraser';
            else if (this.tool === 'arrow') active = cat === 'arrow';
            else active = (cat === 'brush' && id === this.brushType);

            btn.classList.toggle('active', active);
        });

        // Sizes
        const sizeBtns = this.toolbar.querySelectorAll('.size-btn');
        sizeBtns.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.width) === this.strokeWidth);
        });

        // Colors
        const colorCircles = this.toolbar.querySelectorAll('.dt-color-circle');
        colorCircles.forEach(c => {
            c.classList.toggle('active', c.dataset.color === this.color);
        });

        this.updateCursor();
    }

    toggleToolbar(anchorBtn) {
        if (!this.toolbar) this.createToolbar();
        this.anchorBtn = anchorBtn;

        if (this.isActive) {
            this.deactivate();
            this.toolbar.classList.add('hidden');
            if (anchorBtn) anchorBtn.classList.remove('active');
        } else {
            this.activate();
            this.toolbar.classList.remove('hidden');
            this.updateToolbarUI();
            if (anchorBtn) anchorBtn.classList.add('active');
        }
    }

    activate() {
        this.isActive = true;
        document.body.classList.add('drawing-mode');

        if (this.svgLayer) {
            this.svgLayer.style.pointerEvents = 'all'; // Capture mouse events
        }

        this.updateCursor();
    }

    deactivate() {
        this.isActive = false;
        this.isDrawing = false;
        document.body.classList.remove('drawing-mode');

        if (this.svgLayer) {
            this.svgLayer.style.pointerEvents = 'none'; // Passthrough
        }

        document.body.style.cursor = 'default';
        if (this.eraserCursor) this.eraserCursor.style.display = 'none';

        // Remove active visual trail if stuck
        if (this.pathElement) {
            this.pathElement.remove();
            this.pathElement = null;
        }
    }

    updateCursor() {
        if (!this.isActive) return;

        if (this.tool === 'eraser') {
            document.body.style.cursor = 'cell';
        } else {
            document.body.style.cursor = 'crosshair';
        }
    }

    getCanvasCoordinates(e) {
        // Use global canvas helper for consistent coordinates
        if (window.getCanvasPosition) {
            return window.getCanvasPosition(e);
        }

        // Fallback
        const rect = this.svgLayer.getBoundingClientRect();
        const scale = window.canvasScale || 1;
        return {
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale
        };
    }

    startDrawing(e) {
        this.isDrawing = true;

        const pos = this.getCanvasCoordinates(e);
        this.startPoint = pos;

        // If Eraser, Start Red Trail
        if (this.tool === 'eraser') {
            this.points = [[pos.x, pos.y]];
            this.currentPathId = 'eraser-' + Date.now();
            this.createPathElement(this.currentPathId);
            this.updatePathD(this.pathElement, this.points);
            return;
        }

        if (this.tool === 'arrow') {
            this.points = [[pos.x, pos.y], [pos.x, pos.y]];
        } else {
            this.points = [[pos.x, pos.y]];
        }

        this.currentPathId = 'draw-' + Date.now();
        this.createPathElement(this.currentPathId);
        this.updatePathD(this.pathElement, this.points);
    }

    draw(e) {
        if (!this.isDrawing) return;
        e.preventDefault();

        const pos = this.getCanvasCoordinates(e);

        if (this.tool === 'eraser') {
            const last = this.points[this.points.length - 1];
            if (Math.hypot(pos.x - last[0], pos.y - last[1]) > 5) {
                this.points.push([pos.x, pos.y]);
                this.updatePathD(this.pathElement, this.points);
            }
            return;
        }

        if (this.tool === 'arrow') {
            this.points[1] = [pos.x, pos.y];
            this.updatePathD(this.pathElement, this.points);
        } else {
            const last = this.points[this.points.length - 1];
            if (Math.hypot(pos.x - last[0], pos.y - last[1]) > 2) {
                this.points.push([pos.x, pos.y]);
                this.updatePathD(this.pathElement, this.points);
            }
        }
    }

    stopDrawing() {
        this.isDrawing = false;

        if (this.tool === 'eraser') {
            this.performEraseFromTrail(this.points);
            if (this.pathElement) this.pathElement.remove();
            this.pathElement = null;
            this.points = [];
            return;
        }

        const isTooSmall = this.points.length < 2 ||
            (this.tool === 'arrow' && Math.hypot(this.points[0][0] - this.points[1][0], this.points[0][1] - this.points[1][1]) < 5);

        if (!isTooSmall) {
            const drawing = {
                id: this.currentPathId,
                points: [...this.points], // Clone the points array
                tool: this.tool,
                type: this.tool === 'arrow' ? 'arrow' : this.brushType,
                width: this.strokeWidth,
                color: this.color,
                opacity: (this.tool === 'brush' && this.brushType === 'marker') ? 0.3 : 1.0
            };
            this.drawings.push(drawing);
            console.log('[DrawingSystem] Drawing added:', drawing.id, 'Total drawings:', this.drawings.length);

            if (this.pathElement) {
                this.pathElement.dataset.id = drawing.id;
                if (drawing.type === 'marker') {
                    this.pathElement.setAttribute('stroke-opacity', drawing.opacity);
                }
            }

            // P2P Broadcast: Send new drawing to connected peers
            this.broadcastDrawingAdd(drawing);
        } else {
            console.log('[DrawingSystem] Drawing too small, not saved');
            if (this.pathElement) this.pathElement.remove();
        }

        this.points = [];
        this.pathElement = null;
        this.startPoint = null;
    }

    createPathElement(id) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.id = id;
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');

        if (this.tool === 'eraser') {
            path.setAttribute('stroke', 'rgba(255, 50, 50, 0.5)'); // Red transparent trail
            path.setAttribute('stroke-width', this.strokeWidth * this.ERASER_WIDTH_MULTIPLIER);
        } else if (this.tool === 'arrow') {
            path.setAttribute('stroke', this.color);
            path.setAttribute('stroke-width', this.strokeWidth);
            path.setAttribute('marker-end', 'url(#arrow-head)');
            path.setAttribute('stroke-opacity', '1');
        } else {
            path.setAttribute('stroke', this.color);
            path.setAttribute('stroke-width', this.strokeWidth);

            if (this.brushType === 'dashed') {
                path.setAttribute('stroke-dasharray', `${this.strokeWidth * 2}, ${this.strokeWidth * 2}`);
            }
            if (this.brushType === 'marker') {
                path.setAttribute('stroke-opacity', '0.3');
                path.setAttribute('stroke-width', this.strokeWidth * 3);
            } else {
                path.setAttribute('stroke-opacity', '1');
            }
        }
        this.svgLayer.appendChild(path);
        this.pathElement = path;
    }

    updatePathD(pathEl, points) {
        if (!pathEl || points.length < 1) return;
        if (this.tool === 'arrow') {
            pathEl.setAttribute('d', `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`);
        } else {
            let d = `M ${points[0][0]} ${points[0][1]}`;
            for (let i = 1; i < points.length; i++) {
                d += ` L ${points[i][0]} ${points[i][1]}`;
            }
            pathEl.setAttribute('d', d);
        }
    }

    performEraseFromTrail(trailPoints) {
        const radius = (this.strokeWidth * this.ERASER_WIDTH_MULTIPLIER) / 1.5;
        const radiusSq = radius * radius;

        if (trailPoints.length < 2) return;

        const erasedIds = []; // Track erased drawing IDs for P2P

        for (let i = this.drawings.length - 1; i >= 0; i--) {
            const drawing = this.drawings[i];
            const dPoints = drawing.points;

            if (!dPoints || dPoints.length < 2) continue;

            let intersected = false;

            // Check approximate intersection
            for (let t = 0; t < trailPoints.length - 1; t += 2) { // Skip-step optimization
                const t1 = trailPoints[t];

                for (let d = 0; d < dPoints.length - 1; d += 2) {
                    const p1 = dPoints[d];
                    const distSq = (p1[0] - t1[0]) ** 2 + (p1[1] - t1[1]) ** 2;
                    if (distSq < radiusSq) {
                        intersected = true;
                        break;
                    }
                }
                if (intersected) break;
            }

            if (intersected) {
                erasedIds.push(drawing.id);
                const el = document.getElementById(drawing.id);
                if (el) el.remove();
                this.drawings.splice(i, 1);
            }
        }

        // P2P Broadcast: Send erased drawing IDs to connected peers
        if (erasedIds.length > 0) {
            this.broadcastDrawingErase(erasedIds);
        }
    }

    setTool(tool) {
        this.tool = tool;
        this.updateCursor();
    }
    setBrushType(type) {
        this.brushType = type;
    }
    setStrokeWidth(w) {
        this.strokeWidth = w;
    }
    setColor(c) {
        this.color = c;
    }

    // Persistence Methods
    getDrawingsData() {
        console.log('[DrawingSystem] getDrawingsData called, returning', this.drawings.length, 'drawings');
        return this.drawings;
    }
    loadDrawingsData(data) {
        console.log('[DrawingSystem] loadDrawingsData called with', data?.length || 0, 'drawings');

        // Clear existing drawings
        this.drawings = [];

        // Validate SVG layer
        if (!this.svgLayer) {
            console.warn('[DrawingSystem] SVG layer is null, attempting reinitialize...');
            this.reinitialize();
            if (!this.svgLayer) {
                console.error('[DrawingSystem] Failed to create SVG layer, cannot load drawings');
                return;
            }
        }

        // Clear SVG layer and re-add markers
        this.svgLayer.innerHTML = '';
        this.defineSvgMarkers();

        if (!Array.isArray(data) || data.length === 0) {
            console.log('[DrawingSystem] No drawings to load');
            return;
        }

        this.drawings = data;
        console.log('[DrawingSystem] Restoring', this.drawings.length, 'drawings...');

        this.drawings.forEach((d, index) => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.id = d.id;
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            path.setAttribute('stroke', d.color);
            path.setAttribute('stroke-width', d.width);

            if (d.type === 'dashed') path.setAttribute('stroke-dasharray', `${d.width * 2}, ${d.width * 2}`);
            if (d.type === 'marker') {
                path.setAttribute('stroke-opacity', d.opacity || 0.3);
                path.setAttribute('stroke-width', d.width * 3);
            } else if (d.type === 'arrow') {
                path.setAttribute('stroke-opacity', '1');
                path.setAttribute('marker-end', 'url(#arrow-head)');
            } else {
                path.setAttribute('stroke-opacity', d.opacity || 1);
            }

            this.svgLayer.appendChild(path);
            this.updatePathD(path, d.points);
        });

        console.log('[DrawingSystem] Successfully restored', this.drawings.length, 'drawings');
    }

    clear(broadcast = true) {
        this.drawings = [];
        if (this.svgLayer) {
            this.svgLayer.innerHTML = '';
            this.defineSvgMarkers();
        }

        // P2P Broadcast: Notify peers to clear their drawings too
        if (broadcast) {
            this.broadcastDrawingClear();
        }
    }

    // ========== P2P Methods ==========

    /**
     * Broadcast a new drawing to connected peers
     */
    broadcastDrawingAdd(drawing) {
        if (window.p2pManager && window.p2pManager.connections.size > 0) {
            console.log('[DrawingSystem] Broadcasting drawing-add:', drawing.id);
            window.p2pManager.broadcast({
                type: 'drawing-add',
                drawing: drawing
            });
        }
    }

    /**
     * Broadcast erased drawing IDs to connected peers
     */
    broadcastDrawingErase(drawingIds) {
        if (window.p2pManager && window.p2pManager.connections.size > 0) {
            console.log('[DrawingSystem] Broadcasting drawing-erase:', drawingIds);
            window.p2pManager.broadcast({
                type: 'drawing-erase',
                drawingIds: drawingIds
            });
        }
    }

    /**
     * Broadcast clear all drawings to connected peers
     */
    broadcastDrawingClear() {
        if (window.p2pManager && window.p2pManager.connections.size > 0) {
            console.log('[DrawingSystem] Broadcasting drawing-clear');
            window.p2pManager.broadcast({
                type: 'drawing-clear'
            });
        }
    }

    /**
     * Add a drawing received from a P2P peer (no broadcast back)
     */
    addRemoteDrawing(drawing) {
        if (!this.svgLayer) {
            console.warn('[DrawingSystem] Cannot add remote drawing - SVG layer not initialized');
            return;
        }

        // Check if already exists
        if (this.drawings.some(d => d.id === drawing.id)) {
            console.log('[DrawingSystem] Remote drawing already exists:', drawing.id);
            return;
        }

        console.log('[DrawingSystem] Adding remote drawing:', drawing.id);

        // Add to drawings array
        this.drawings.push(drawing);

        // Create path element
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.id = drawing.id;
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('stroke', drawing.color);
        path.setAttribute('stroke-width', drawing.width);

        if (drawing.type === 'dashed') path.setAttribute('stroke-dasharray', `${drawing.width * 2}, ${drawing.width * 2}`);
        if (drawing.type === 'marker') {
            path.setAttribute('stroke-opacity', drawing.opacity || 0.3);
            path.setAttribute('stroke-width', drawing.width * 3);
        } else if (drawing.type === 'arrow') {
            path.setAttribute('stroke-opacity', '1');
            path.setAttribute('marker-end', 'url(#arrow-head)');
        } else {
            path.setAttribute('stroke-opacity', drawing.opacity || 1);
        }

        this.svgLayer.appendChild(path);
        this.updatePathD(path, drawing.points);
    }

    /**
     * Remove drawings by ID (received from P2P peer)
     */
    removeRemoteDrawings(drawingIds) {
        console.log('[DrawingSystem] Removing remote drawings:', drawingIds);

        drawingIds.forEach(id => {
            // Remove from DOM
            const el = document.getElementById(id);
            if (el) el.remove();

            // Remove from array
            const index = this.drawings.findIndex(d => d.id === id);
            if (index !== -1) {
                this.drawings.splice(index, 1);
            }
        });
    }

    /**
     * Clear all drawings (received from P2P peer, no broadcast back)
     */
    clearRemote() {
        console.log('[DrawingSystem] Clearing drawings (remote command)');
        this.drawings = [];
        if (this.svgLayer) {
            this.svgLayer.innerHTML = '';
            this.defineSvgMarkers();
        }
    }
}

// Create instance but don't auto-setup (canvas doesn't exist yet)
// reinitialize() must be called after canvas is created
const drawingSystem = new DrawingSystem();
