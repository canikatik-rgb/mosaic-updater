/**
 * Lazy Asset Loader
 * Viewport-based lazy loading for assets in ZIP-based projects
 * Uses IntersectionObserver for efficient loading
 */

class LazyAssetLoader {
    constructor() {
        // IntersectionObserver for viewport detection
        this.observer = null;
        // Elements being observed: element -> assetPath
        this.observedElements = new WeakMap();
        // Loading state
        this.loadingAssets = new Set();

        this.init();
    }

    init() {
        // Create observer with reasonable threshold
        this.observer = new IntersectionObserver(
            this.handleIntersection.bind(this),
            {
                root: null, // viewport
                rootMargin: '200px', // Start loading 200px before entering viewport
                threshold: 0.01 // Trigger when 1% visible
            }
        );

        console.log('[LazyAssetLoader] Initialized');
    }

    /**
     * Handle intersection events
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const assetInfo = this.observedElements.get(element);

                if (assetInfo && !this.loadingAssets.has(assetInfo.path)) {
                    this.loadAsset(element, assetInfo);
                }
            }
        });
    }

    /**
     * Register an element for lazy loading
     * @param {HTMLElement} element - The element to load asset into (img, video, etc.)
     * @param {string} assetPath - Path within ZIP (e.g., 'assets/img_abc123.png')
     * @param {string} type - Asset type: 'image', 'video', 'binary'
     */
    observe(element, assetPath, type = 'image') {
        if (!element || !assetPath) return;

        // Store asset info
        this.observedElements.set(element, { path: assetPath, type });

        // Add placeholder styling
        element.classList.add('lazy-loading');
        if (type === 'image') {
            element.dataset.lazySrc = assetPath;
            // Set placeholder
            if (!element.src || element.src === '') {
                element.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e0e0e0" width="100" height="100"/%3E%3C/svg%3E';
            }
        }

        // Start observing
        this.observer.observe(element);
    }

    /**
     * Load asset and apply to element
     */
    async loadAsset(element, assetInfo) {
        const { path, type } = assetInfo;

        // Mark as loading
        this.loadingAssets.add(path);
        element.classList.add('lazy-loading-active');

        try {
            // Get Blob URL from asset manager
            const blobUrl = await window.assetManager.lazyLoadAsset(path);

            if (!blobUrl || blobUrl === path) {
                console.warn('[LazyAssetLoader] Failed to load:', path);
                element.classList.add('lazy-load-error');
                return;
            }

            // Apply based on type
            switch (type) {
                case 'image':
                    element.src = blobUrl;
                    break;
                case 'video':
                    element.src = blobUrl;
                    if (element.load) element.load();
                    break;
                case 'background':
                    element.style.backgroundImage = `url(${blobUrl})`;
                    break;
                default:
                    // For custom handlers
                    element.dataset.loadedSrc = blobUrl;
                    element.dispatchEvent(new CustomEvent('assetLoaded', {
                        detail: { blobUrl, path }
                    }));
            }

            // Cleanup
            element.classList.remove('lazy-loading', 'lazy-loading-active');
            element.classList.add('lazy-loaded');

            // Stop observing
            this.observer.unobserve(element);
            this.observedElements.delete(element);

            console.log('[LazyAssetLoader] Loaded:', path);

        } catch (err) {
            console.error('[LazyAssetLoader] Error loading asset:', err);
            element.classList.add('lazy-load-error');
        } finally {
            this.loadingAssets.delete(path);
        }
    }

    /**
     * Force load all observed assets (useful for print/export)
     */
    async loadAll() {
        const promises = [];

        // Get all observed elements via a different method since WeakMap isn't iterable
        document.querySelectorAll('[data-lazy-src]').forEach(element => {
            const assetInfo = this.observedElements.get(element);
            if (assetInfo) {
                promises.push(this.loadAsset(element, assetInfo));
            }
        });

        await Promise.all(promises);
        console.log('[LazyAssetLoader] Force loaded all assets');
    }

    /**
     * Cleanup observer
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.loadingAssets.clear();
        console.log('[LazyAssetLoader] Destroyed');
    }

    /**
     * Check if an element is being lazy loaded
     */
    isObserving(element) {
        return this.observedElements.has(element);
    }

    /**
     * Parse HTML content and register lazy loading for asset references
     * Replaces assets/... references with placeholder and sets up lazy loading
     * @param {HTMLElement} container - Container element with content
     */
    processContainer(container) {
        if (!container) return;

        // Find images with asset references
        container.querySelectorAll('img[src^="assets/"]').forEach(img => {
            const assetPath = img.getAttribute('src');
            this.observe(img, assetPath, 'image');
        });

        // Find video elements
        container.querySelectorAll('video source[src^="assets/"]').forEach(source => {
            const assetPath = source.getAttribute('src');
            const video = source.parentElement;
            this.observe(video, assetPath, 'video');
        });

        // Find background images (via style attribute)
        container.querySelectorAll('[style*="assets/"]').forEach(el => {
            const match = el.style.backgroundImage?.match(/assets\/[^"')]+/);
            if (match) {
                this.observe(el, match[0], 'background');
            }
        });
    }
}

// Global instance
window.lazyAssetLoader = new LazyAssetLoader();

// Add CSS for lazy loading states
const lazyStyles = document.createElement('style');
lazyStyles.textContent = `
    .lazy-loading {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: lazy-shimmer 1.5s infinite;
    }
    
    @keyframes lazy-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
    
    .lazy-loading-active {
        opacity: 0.7;
    }
    
    .lazy-loaded {
        animation: lazy-fade-in 0.3s ease-out;
    }
    
    @keyframes lazy-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    .lazy-load-error {
        background: repeating-linear-gradient(
            45deg,
            #ffebee,
            #ffebee 10px,
            #ffcdd2 10px,
            #ffcdd2 20px
        ) !important;
    }
`;
document.head.appendChild(lazyStyles);

console.log('[LazyAssetLoader] Module loaded');
