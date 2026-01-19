/**
 * Sticker Panel System
 * Manages sticker library, drag-drop, and canvas placement
 */

class StickerPanel {
    constructor() {
        this.element = null;
        this.gridElement = null;
        this.isOpen = false;
        this.categories = {};
        this.init();
    }

    async init() {
        this.createUI();
        await this.loadCategories();
        this.setupCanvasDropZone();
        this.setupStickerSelection();

        // Attach events to any existing stickers (e.g. from page load persistence)
        document.querySelectorAll('.canvas-sticker').forEach(sticker => {
            this.setupStickerDrag(sticker);
        });

        console.log('[Stickers] Panel initialized');
    }

    createUI() {
        // Create panel container
        const panel = document.createElement('div');
        panel.className = 'sticker-panel';
        panel.innerHTML = `
            <div class="sticker-panel-header">
                <span class="sticker-panel-title">Stickers</span>
                <button class="sticker-panel-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="sticker-search-wrapper">
                <input type="text" class="sticker-search" placeholder="Search stickers...">
            </div>
            <div class="sticker-panel-content"></div>
        `;

        document.body.appendChild(panel);
        this.element = panel;
        this.gridElement = panel.querySelector('.sticker-panel-content');
        this.searchInput = panel.querySelector('.sticker-search');

        // Close button
        panel.querySelector('.sticker-panel-close').addEventListener('click', () => this.close());

        // Search functionality
        this.searchInput.addEventListener('input', (e) => this.filterStickers(e.target.value));

        // Click outside to close
        document.addEventListener('mousedown', (e) => {
            if (this.isOpen && !this.element.contains(e.target) && !e.target.closest('.sticker-btn')) {
                this.close();
            }
        });
    }

    filterStickers(query) {
        const normalizedQuery = query.toLowerCase().trim();
        const items = this.element.querySelectorAll('.sticker-item');

        items.forEach(item => {
            const src = item.dataset.src || '';
            const fileName = src.split('/').pop().toLowerCase();
            const matches = normalizedQuery === '' || fileName.includes(normalizedQuery);
            item.style.display = matches ? '' : 'none';
        });
    }

    async loadCategories() {
        // Try manifest.json first (for development without server directory listing)
        try {
            const response = await fetch('stickers/manifest.json');
            if (response.ok) {
                const manifest = await response.json();

                if (manifest.categories && Array.isArray(manifest.categories)) {
                    for (const category of manifest.categories) {
                        const stickers = category.stickers.map(file => `stickers/${category.name}/${file}`);
                        this.categories[category.name] = stickers;
                        this.renderCategory(category.name, stickers);
                    }
                }

                console.log('[Stickers] Loaded from manifest:', Object.keys(this.categories));
                return; // Success - don't try directory listing
            }
        } catch (e) {
            console.log('[Stickers] Manifest not available, trying directory listing...');
        }

        // Fallback: Directory listing (for build/production with server support)
        await this.loadCategoriesFromDirectory();
    }

    async loadCategoriesFromDirectory() {
        // This works when server supports directory listing (e.g., after build)
        try {
            const response = await fetch('stickers/');
            if (!response.ok) return;

            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const links = doc.querySelectorAll('a');

            for (const link of links) {
                const href = link.getAttribute('href');
                if (href && href.endsWith('/') && !href.startsWith('..')) {
                    const categoryName = href.replace('/', '');
                    if (categoryName && categoryName !== '.DS_Store') {
                        await this.loadCategoryFromDirectory(categoryName);
                    }
                }
            }
            console.log('[Stickers] Loaded from directory listing:', Object.keys(this.categories));
        } catch (e) {
            console.warn('[Stickers] Directory listing failed:', e);
        }
    }

    async loadCategoryFromDirectory(categoryName) {
        try {
            const response = await fetch(`stickers/${categoryName}/`);
            if (!response.ok) return;

            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const links = doc.querySelectorAll('a');

            const stickers = [];
            for (const link of links) {
                const href = link.getAttribute('href');
                if (href && (href.endsWith('.png') || href.endsWith('.apng') || href.endsWith('.gif'))) {
                    stickers.push(`stickers/${categoryName}/${href}`);
                }
            }

            if (stickers.length > 0) {
                this.categories[categoryName] = stickers;
                this.renderCategory(categoryName, stickers);
            }
        } catch (e) {
            console.warn(`[Stickers] Could not load category ${categoryName}:`, e);
        }
    }

    renderCategory(name, stickers) {
        // Category header
        const header = document.createElement('div');
        header.className = 'sticker-category-header';
        header.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        this.gridElement.appendChild(header);

        // Sticker grid
        const grid = document.createElement('div');
        grid.className = 'sticker-grid';

        stickers.forEach(src => {
            const item = document.createElement('div');
            item.className = 'sticker-item';
            item.draggable = true;
            item.dataset.src = src;

            const img = document.createElement('img');
            img.src = src;
            img.alt = 'Sticker';
            item.appendChild(img);

            // Drag start
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', src);
                e.dataTransfer.effectAllowed = 'copy';
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });

            grid.appendChild(item);
        });

        this.gridElement.appendChild(grid);
    }

    setupCanvasDropZone() {
        const canvasWrapper = document.getElementById('canvas-wrapper');
        if (!canvasWrapper) return;

        canvasWrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvasWrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            const src = e.dataTransfer.getData('text/plain');

            if (src && src.startsWith('stickers/')) {
                // Calculate canvas position
                const canvasPos = this.getCanvasPosition(e);
                this.placeSticker(src, canvasPos.x, canvasPos.y);
                this.close();
            }
        });
    }

    getCanvasPosition(e) {
        const offsetX = window.canvasOffset?.x || 0;
        const offsetY = window.canvasOffset?.y || 0;
        const scale = window.canvasScale || 1;

        return {
            x: (e.clientX - offsetX) / scale,
            y: (e.clientY - offsetY) / scale
        };
    }

    placeSticker(src, x, y) {
        const canvasContent = document.getElementById('canvas-content');
        if (!canvasContent) return;

        const sticker = document.createElement('div');
        sticker.className = 'canvas-sticker';
        sticker.dataset.sticker = 'true';
        sticker.style.left = `${x - 125}px`; // Center on drop point (half of 250)
        sticker.style.top = `${y - 125}px`;
        sticker.style.width = '250px'; // Increased default width
        // Cursor indicating it can be moved
        sticker.style.cursor = 'move'; // or grab/grabbing

        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Sticker';
        img.draggable = false;
        img.style.width = '100%';
        img.style.height = 'auto'; // Maintain aspect ratio
        img.style.pointerEvents = 'none'; // Let clicks pass to sticker div
        sticker.appendChild(img);

        canvasContent.appendChild(sticker);

        // Auto-select the new sticker
        this.selectSticker(sticker);

        // Setup drag events for this sticker
        this.setupStickerDrag(sticker);

        console.log('[Stickers] Placed sticker at', x, y);

        // Schedule auto-save
        if (window.scheduleAutoSave) window.scheduleAutoSave();
    }

    setupStickerDrag(sticker) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        sticker.addEventListener('mousedown', (e) => {
            // Prevent interference with selection or other interactions
            if (e.button !== 0) return; // Only left click

            e.stopPropagation(); // Stop bubbling to canvas (prevents drag selection box)

            // Select sticker if not already selected
            if (!sticker.classList.contains('selected')) {
                this.selectSticker(sticker);
            }

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = parseFloat(sticker.style.left) || 0;
            initialTop = parseFloat(sticker.style.top) || 0;

            sticker.style.cursor = 'grabbing';
            sticker.classList.add('dragging');

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;

                const dx = (moveEvent.clientX - startX) / window.canvasScale;
                const dy = (moveEvent.clientY - startY) / window.canvasScale;

                sticker.style.left = `${initialLeft + dx}px`;
                sticker.style.top = `${initialTop + dy}px`;
            };

            const onMouseUp = () => {
                isDragging = false;
                sticker.style.cursor = 'move';
                sticker.classList.remove('dragging');

                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                // Save new position
                if (window.scheduleAutoSave) window.scheduleAutoSave();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    setupStickerSelection() {
        // Click handler for sticker selection is handled in mousedown now to support drag-select
        // But we need global click to deselect
        document.addEventListener('click', (e) => {
            // If clicking empty canvas/background, deselect
            if (e.target.id === 'canvas' || e.target.id === 'canvas-background' || e.target.id === 'canvas-content') {
                this.deselectAllStickers();
            }
            // If clicking a node, deselect stickers
            else if (e.target.closest('.node')) {
                this.deselectAllStickers();
            }
        });

        // Keyboard handler for deletion
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.matches('input, textarea, [contenteditable]')) {
                const selected = document.querySelector('.canvas-sticker.selected');
                if (selected) {
                    e.preventDefault();
                    this.deleteSticker(selected);
                }
            }
        });
    }

    selectSticker(sticker) {
        // Clear node selection first
        if (window.clearSelectedNodes) window.clearSelectedNodes();
        if (window.clearGroupSelections) window.clearGroupSelections();

        // Deselect other stickers
        document.querySelectorAll('.canvas-sticker.selected').forEach(s => s.classList.remove('selected'));

        // Select this sticker
        sticker.classList.add('selected');

        // Notify Action Bar
        window.dispatchEvent(new CustomEvent('stickerSelectionChanged', {
            detail: { sticker: sticker }
        }));
    }

    deselectAllStickers() {
        const selected = document.querySelector('.canvas-sticker.selected');
        if (selected) {
            selected.classList.remove('selected');
            // Notify Action Bar (null means no sticker selected)
            window.dispatchEvent(new CustomEvent('stickerSelectionChanged', {
                detail: { sticker: null }
            }));
        }
    }

    deleteSticker(sticker) {
        if (!sticker) return;
        sticker.remove();

        // Notify Action Bar to clear
        window.dispatchEvent(new CustomEvent('stickerSelectionChanged', {
            detail: { sticker: null }
        }));

        console.log('[Stickers] Deleted sticker');
        if (window.scheduleAutoSave) window.scheduleAutoSave();
    }

    // New: Resize functionality
    resizeSticker(sticker, deltaPercent) {
        if (!sticker) return;

        // Ensure we operate on the current computed width if style.width is not set
        let currentW = parseFloat(sticker.style.width);
        if (isNaN(currentW)) {
            currentW = sticker.getBoundingClientRect().width / window.canvasScale;
        }

        // Allow growing/shrinking without arbitrary upper limits (browser limit only)
        // Min width 20px
        const newWidth = Math.max(20, currentW * (1 + deltaPercent));

        sticker.style.width = `${newWidth}px`;
        // Height is auto (via aspect ratio)
        sticker.style.height = 'auto';

        if (window.scheduleAutoSave) window.scheduleAutoSave();
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.element.classList.add('open');
        this.isOpen = true;
    }

    close() {
        this.element.classList.remove('open');
        this.isOpen = false;
    }
}

// Initialize when DOM is ready
let stickerPanel = null;

document.addEventListener('DOMContentLoaded', () => {
    // Delay initialization to ensure other systems are ready
    setTimeout(() => {
        stickerPanel = new StickerPanel();
        window.stickerPanel = stickerPanel;
    }, 500);
});
