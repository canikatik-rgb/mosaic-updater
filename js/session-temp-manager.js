/**
 * Session Temp Manager
 * Manages temporary folder for file-backed data cards during runtime.
 * 
 * Lifecycle:
 * 1. App start → Create session folder with unique ID
 * 2. Runtime → Store card files in assets/ subfolders
 * 3. Save → Copy assets to ZIP
 * 4. Load → Extract assets from ZIP to session folder
 * 5. App quit → Cleanup session folder
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

class SessionTempManager {
    constructor() {
        this.sessionId = null;
        this.basePath = null;
        this.initialized = false;
    }

    /**
     * Initialize session temp folder
     * Called from main.js on app ready
     */
    async initialize() {
        if (this.initialized) return this.basePath;

        // Generate unique session ID
        this.sessionId = `mosaic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Use OS temp directory
        const tempDir = app.getPath('temp');
        this.basePath = path.join(tempDir, this.sessionId);

        try {
            // Create folder structure
            await fs.mkdir(path.join(this.basePath, 'assets', 'images'), { recursive: true });
            await fs.mkdir(path.join(this.basePath, 'assets', 'files'), { recursive: true });
            await fs.mkdir(path.join(this.basePath, 'assets', 'text'), { recursive: true });

            this.initialized = true;
            console.log(`[SessionTemp] Initialized: ${this.basePath}`);

            return this.basePath;
        } catch (err) {
            console.error('[SessionTemp] Failed to initialize:', err);
            throw err;
        }
    }

    /**
     * Get absolute path from relative asset path
     * @param {string} relativePath - e.g., "assets/images/card-001.png"
     * @returns {string} - Full system path
     */
    getAbsolutePath(relativePath) {
        if (!this.basePath) {
            throw new Error('[SessionTemp] Not initialized');
        }
        return path.join(this.basePath, relativePath);
    }

    /**
     * Get relative path for storing in project JSON
     * @param {string} absolutePath - Full system path
     * @returns {string} - Relative path like "assets/images/card-001.png"
     */
    getRelativePath(absolutePath) {
        if (!this.basePath) {
            throw new Error('[SessionTemp] Not initialized');
        }
        return path.relative(this.basePath, absolutePath);
    }

    /**
     * Generate unique file path for a card
     * @param {string} cardId - Card ID
     * @param {string} type - 'image' | 'text' | 'file'
     * @param {string} extension - File extension (optional)
     * @returns {object} - { relativePath, absolutePath }
     */
    generateCardFilePath(cardId, type, extension = null) {
        const folders = {
            image: 'images',
            text: 'text',
            file: 'files',
            svg: 'images',
            html: 'text'
        };

        const extensions = {
            image: '.png',
            text: '.txt',
            svg: '.svg',
            html: '.html'
        };

        const folder = folders[type] || 'files';
        const ext = extension || extensions[type] || '.bin';
        const relativePath = `assets/${folder}/${cardId}${ext}`;

        return {
            relativePath,
            absolutePath: this.getAbsolutePath(relativePath)
        };
    }

    /**
     * Check if a file exists in session folder
     * @param {string} relativePath 
     * @returns {boolean}
     */
    fileExists(relativePath) {
        try {
            const absolutePath = this.getAbsolutePath(relativePath);
            return fsSync.existsSync(absolutePath);
        } catch {
            return false;
        }
    }

    /**
     * Delete a file from session folder
     * @param {string} relativePath 
     */
    async deleteFile(relativePath) {
        try {
            const absolutePath = this.getAbsolutePath(relativePath);
            await fs.unlink(absolutePath);
            console.log(`[SessionTemp] Deleted: ${relativePath}`);
        } catch (err) {
            console.warn(`[SessionTemp] Delete failed: ${relativePath}`, err.message);
        }
    }

    /**
     * Get all asset files in session folder
     * @returns {Promise<string[]>} - Array of relative paths
     */
    async getAllAssets() {
        const assets = [];
        const assetsPath = path.join(this.basePath, 'assets');

        async function walkDir(dir, baseDir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        await walkDir(fullPath, baseDir);
                    } else {
                        assets.push(path.relative(baseDir, fullPath));
                    }
                }
            } catch (err) {
                // Folder might not exist yet
            }
        }

        await walkDir(assetsPath, this.basePath);
        return assets;
    }

    /**
     * Cleanup session folder
     * Called from main.js on app quit
     */
    async cleanup() {
        if (!this.basePath) return;

        try {
            await fs.rm(this.basePath, { recursive: true, force: true });
            console.log(`[SessionTemp] Cleaned up: ${this.basePath}`);
        } catch (err) {
            console.warn('[SessionTemp] Cleanup failed:', err.message);
        }

        this.initialized = false;
        this.basePath = null;
        this.sessionId = null;
    }

    /**
     * Cleanup old session folders (from crashed sessions)
     * Called on app start before initializing new session
     */
    async cleanupOldSessions() {
        try {
            const tempDir = app.getPath('temp');
            const entries = await fs.readdir(tempDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('mosaic-')) {
                    const folderPath = path.join(tempDir, entry.name);
                    const stats = await fs.stat(folderPath);
                    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

                    // Remove sessions older than 24 hours
                    if (ageHours > 24) {
                        await fs.rm(folderPath, { recursive: true, force: true });
                        console.log(`[SessionTemp] Cleaned old session: ${entry.name}`);
                    }
                }
            }
        } catch (err) {
            console.warn('[SessionTemp] Old session cleanup failed:', err.message);
        }
    }
}

// Singleton instance
const sessionTempManager = new SessionTempManager();

module.exports = sessionTempManager;
