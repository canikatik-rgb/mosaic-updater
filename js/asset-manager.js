/**
 * Asset Manager
 * Handles extraction and management of binary assets for ZIP-based project format
 */

class AssetManager {
    constructor() {
        // Cache: assetPath -> Blob URL
        this.blobUrlCache = new Map();
        // Pending extractions: assetPath -> Promise
        this.pendingExtractions = new Map();
        // Current project's ZIP reference (for lazy loading)
        this.currentZipPath = null;
    }

    /**
     * Generate a unique asset filename
     * @param {string} mimeType - e.g., 'image/png', 'image/jpeg'
     * @returns {string} - e.g., 'img_abc123def456.png'
     */
    generateAssetFilename(mimeType) {
        const uuid = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        const ext = this.mimeToExtension(mimeType);
        const prefix = mimeType.startsWith('image/') ? 'img' :
            mimeType.startsWith('video/') ? 'vid' :
                mimeType.startsWith('application/pdf') ? 'doc' : 'asset';
        return `${prefix}_${uuid}.${ext}`;
    }

    /**
     * Convert MIME type to file extension
     */
    mimeToExtension(mimeType) {
        const map = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg',
            'application/pdf': 'pdf',
            'video/mp4': 'mp4',
            'video/webm': 'webm'
        };
        return map[mimeType] || 'bin';
    }

    /**
     * Extract MIME type from Base64 data URL
     * @param {string} dataUrl - e.g., 'data:image/png;base64,iVBOR...'
     * @returns {string|null} - e.g., 'image/png'
     */
    extractMimeType(dataUrl) {
        const match = dataUrl.match(/^data:([^;,]+)/);
        return match ? match[1] : null;
    }

    /**
     * Convert Base64 data URL to Buffer
     * @param {string} dataUrl - e.g., 'data:image/png;base64,iVBOR...'
     * @returns {Uint8Array} - Binary data
     */
    base64ToBuffer(dataUrl) {
        const base64Data = dataUrl.split(',')[1];
        if (!base64Data) return null;

        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Convert Buffer to Blob URL (for rendering)
     * @param {Uint8Array} buffer - Binary data
     * @param {string} mimeType - MIME type
     * @returns {string} - Blob URL
     */
    bufferToBlobUrl(buffer, mimeType) {
        const blob = new Blob([buffer], { type: mimeType });
        return URL.createObjectURL(blob);
    }

    /**
     * Extract all Base64 assets from project data
     * Returns lightweight project + extracted assets
     * @param {Object} project - Full project object
     * @returns {{ project: Object, assets: Array<{filename: string, buffer: Uint8Array, mimeType: string}> }}
     */
    extractAssetsFromProject(project) {
        const assets = [];
        const assetMap = new Map(); // base64 hash -> filename (for deduplication)

        // Deep clone project to avoid mutation
        const lightProject = JSON.parse(JSON.stringify(project));

        // Process nodes
        if (lightProject.nodes && Array.isArray(lightProject.nodes)) {
            lightProject.nodes = lightProject.nodes.map(node => {
                return this.processNodeForExtraction(node, assets, assetMap);
            });
        }

        // Process thumbnail
        if (lightProject.thumbnail && lightProject.thumbnail.startsWith('data:')) {
            const result = this.extractSingleAsset(lightProject.thumbnail, assets, assetMap, 'preview');
            if (result) {
                lightProject.thumbnail = result.ref;
            }
        }

        console.log(`[AssetManager] Extracted ${assets.length} assets from project`);
        return { project: lightProject, assets };
    }

    /**
     * Process a single node, extracting any embedded Base64 data
     */
    processNodeForExtraction(node, assets, assetMap) {
        if (!node) return node;

        // Check content field for Base64 images
        if (node.content && typeof node.content === 'string') {
            node.content = this.replaceBase64InString(node.content, assets, assetMap);
        }

        // Check data object for image fields
        if (node.data && typeof node.data === 'object') {
            node.data = this.processObjectForExtraction(node.data, assets, assetMap);
        }

        // Check specific fields for gallery, canvas nodes etc.
        if (node.images && Array.isArray(node.images)) {
            node.images = node.images.map(img => {
                if (typeof img === 'string' && img.startsWith('data:')) {
                    const result = this.extractSingleAsset(img, assets, assetMap);
                    return result ? result.ref : img;
                }
                if (typeof img === 'object' && img.src && img.src.startsWith('data:')) {
                    const result = this.extractSingleAsset(img.src, assets, assetMap);
                    if (result) img.src = result.ref;
                }
                return img;
            });
        }

        return node;
    }

    /**
     * Recursively process an object for Base64 extraction
     */
    processObjectForExtraction(obj, assets, assetMap) {
        if (!obj || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
            return obj.map(item => this.processObjectForExtraction(item, assets, assetMap));
        }

        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string' && value.startsWith('data:image')) {
                const extracted = this.extractSingleAsset(value, assets, assetMap);
                result[key] = extracted ? extracted.ref : value;
            } else if (typeof value === 'object') {
                result[key] = this.processObjectForExtraction(value, assets, assetMap);
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    /**
     * Replace Base64 data URLs in HTML/text content
     */
    replaceBase64InString(content, assets, assetMap) {
        // Match data:image URLs (including in HTML src attributes)
        const regex = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g;

        return content.replace(regex, (match) => {
            const result = this.extractSingleAsset(match, assets, assetMap);
            return result ? result.ref : match;
        });
    }

    /**
     * Extract a single Base64 asset
     * @returns {{ ref: string, filename: string } | null}
     */
    extractSingleAsset(dataUrl, assets, assetMap, filenamePrefix = null) {
        if (!dataUrl || !dataUrl.startsWith('data:')) return null;

        // Create hash for deduplication (first 100 chars of base64)
        const hashKey = dataUrl.substr(0, 150);

        // Check if already extracted
        if (assetMap.has(hashKey)) {
            return { ref: `assets/${assetMap.get(hashKey)}`, filename: assetMap.get(hashKey) };
        }

        const mimeType = this.extractMimeType(dataUrl);
        if (!mimeType) return null;

        const buffer = this.base64ToBuffer(dataUrl);
        if (!buffer) return null;

        const filename = filenamePrefix
            ? `${filenamePrefix}.${this.mimeToExtension(mimeType)}`
            : this.generateAssetFilename(mimeType);

        assets.push({ filename, buffer, mimeType });
        assetMap.set(hashKey, filename);

        return { ref: `assets/${filename}`, filename };
    }

    /**
     * Restore asset references to Blob URLs in project data
     * Used during load for immediate display
     * @param {Object} project - Project with asset references
     * @param {Map<string, Uint8Array>} assetBuffers - Map of assetPath -> buffer
     */
    restoreAssetsToProject(project, assetBuffers) {
        if (!project.nodes) return project;

        project.nodes = project.nodes.map(node => {
            return this.processNodeForRestore(node, assetBuffers);
        });

        if (project.thumbnail && project.thumbnail.startsWith('assets/')) {
            const buffer = assetBuffers.get(project.thumbnail);
            if (buffer) {
                const ext = project.thumbnail.split('.').pop();
                const mimeType = this.extensionToMime(ext);
                project.thumbnail = this.bufferToBlobUrl(buffer, mimeType);
            }
        }

        return project;
    }

    /**
     * Process a node for asset restoration
     */
    processNodeForRestore(node, assetBuffers) {
        if (!node) return node;

        if (node.content && typeof node.content === 'string') {
            node.content = this.replaceAssetRefsInString(node.content, assetBuffers);
        }

        if (node.data && typeof node.data === 'object') {
            node.data = this.processObjectForRestore(node.data, assetBuffers);
        }

        if (node.images && Array.isArray(node.images)) {
            node.images = node.images.map(img => {
                if (typeof img === 'string' && img.startsWith('assets/')) {
                    return this.assetRefToBlobUrl(img, assetBuffers);
                }
                if (typeof img === 'object' && img.src && img.src.startsWith('assets/')) {
                    img.src = this.assetRefToBlobUrl(img.src, assetBuffers);
                }
                return img;
            });
        }

        return node;
    }

    /**
     * Process object for asset restoration
     */
    processObjectForRestore(obj, assetBuffers) {
        if (!obj || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
            return obj.map(item => this.processObjectForRestore(item, assetBuffers));
        }

        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string' && value.startsWith('assets/')) {
                result[key] = this.assetRefToBlobUrl(value, assetBuffers);
            } else if (typeof value === 'object') {
                result[key] = this.processObjectForRestore(value, assetBuffers);
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    /**
     * Replace asset references in HTML/text content
     */
    replaceAssetRefsInString(content, assetBuffers) {
        const regex = /assets\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+/g;

        return content.replace(regex, (match) => {
            return this.assetRefToBlobUrl(match, assetBuffers);
        });
    }

    /**
     * Convert asset reference to Blob URL
     */
    assetRefToBlobUrl(assetRef, assetBuffers) {
        // Check cache first
        if (this.blobUrlCache.has(assetRef)) {
            return this.blobUrlCache.get(assetRef);
        }

        const buffer = assetBuffers.get(assetRef);
        if (!buffer) return assetRef; // Return as-is if not found

        const ext = assetRef.split('.').pop();
        const mimeType = this.extensionToMime(ext);
        const blobUrl = this.bufferToBlobUrl(buffer, mimeType);

        this.blobUrlCache.set(assetRef, blobUrl);
        return blobUrl;
    }

    /**
     * Convert extension to MIME type
     */
    extensionToMime(ext) {
        const map = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'pdf': 'application/pdf',
            'mp4': 'video/mp4',
            'webm': 'video/webm'
        };
        return map[ext] || 'application/octet-stream';
    }

    /**
     * Clear blob URL cache (call when switching projects)
     */
    clearCache() {
        // Revoke all blob URLs to free memory
        for (const url of this.blobUrlCache.values()) {
            URL.revokeObjectURL(url);
        }
        this.blobUrlCache.clear();
        this.pendingExtractions.clear();
        this.currentZipPath = null;
    }

    /**
     * Set current ZIP path for lazy loading
     */
    setCurrentZipPath(zipPath) {
        this.currentZipPath = zipPath;
    }

    /**
     * Lazy load a single asset from current ZIP
     * @param {string} assetPath - e.g., 'assets/img_abc123.png'
     * @returns {Promise<string>} - Blob URL
     */
    async lazyLoadAsset(assetPath) {
        // Check cache
        if (this.blobUrlCache.has(assetPath)) {
            return this.blobUrlCache.get(assetPath);
        }

        // Check pending
        if (this.pendingExtractions.has(assetPath)) {
            return this.pendingExtractions.get(assetPath);
        }

        if (!this.currentZipPath || !window.electronAPI?.extractAsset) {
            console.warn('[AssetManager] Cannot lazy load - no ZIP path or API');
            return assetPath;
        }

        // Start extraction
        const extractionPromise = (async () => {
            try {
                const result = await window.electronAPI.extractAsset(
                    this.currentZipPath,
                    assetPath
                );

                if (result.success && result.buffer) {
                    const ext = assetPath.split('.').pop();
                    const mimeType = this.extensionToMime(ext);
                    const blobUrl = this.bufferToBlobUrl(new Uint8Array(result.buffer), mimeType);
                    this.blobUrlCache.set(assetPath, blobUrl);
                    return blobUrl;
                }
            } catch (err) {
                console.error('[AssetManager] Lazy load failed:', err);
            } finally {
                this.pendingExtractions.delete(assetPath);
            }
            return assetPath;
        })();

        this.pendingExtractions.set(assetPath, extractionPromise);
        return extractionPromise;
    }
}

// Global instance
window.assetManager = new AssetManager();

console.log('[AssetManager] Initialized');
