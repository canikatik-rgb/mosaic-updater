/**
 * Format Migrator
 * Handles migration from legacy JSON format to ZIP-based archive
 * Also manages version tracking for future migrations
 */

class FormatMigrator {
    constructor() {
        // Current format version
        this.CURRENT_VERSION = '2.0';

        // Version history for migration paths
        this.VERSION_HISTORY = {
            '1.0': 'Legacy JSON with embedded Base64',
            '2.0': 'ZIP-based archive with external assets'
        };
    }

    /**
     * Detect format version of project data
     * @param {Object} projectData - Parsed project data
     * @returns {string} Version string
     */
    detectVersion(projectData) {
        // Check for version in metadata (new format)
        if (projectData._version) {
            return projectData._version;
        }

        // Check for ZIP format indicators
        if (projectData.format === 'mosaic-zip') {
            return '2.0';
        }

        // Legacy format detection
        if (this.hasEmbeddedBase64(projectData)) {
            return '1.0';
        }

        // Default to current if no indicators
        return this.CURRENT_VERSION;
    }

    /**
     * Check if project has embedded Base64 data
     */
    hasEmbeddedBase64(projectData) {
        const content = JSON.stringify(projectData);
        return content.includes('data:image/') ||
            content.includes('data:video/') ||
            content.includes('data:application/pdf');
    }

    /**
     * Migrate project data from any version to current
     * @param {Object} projectData - Project data to migrate
     * @param {string} fromVersion - Source version
     * @returns {Object} Migrated project data
     */
    migrate(projectData, fromVersion = null) {
        const sourceVersion = fromVersion || this.detectVersion(projectData);

        if (sourceVersion === this.CURRENT_VERSION) {
            console.log('[Migrator] Project already at current version');
            return projectData;
        }

        console.log(`[Migrator] Migrating from v${sourceVersion} to v${this.CURRENT_VERSION}`);

        // Apply migrations in sequence
        let migrated = { ...projectData };

        if (sourceVersion === '1.0') {
            migrated = this.migrate_1_0_to_2_0(migrated);
        }

        // Mark as migrated
        migrated._version = this.CURRENT_VERSION;
        migrated._migratedAt = new Date().toISOString();
        migrated._migratedFrom = sourceVersion;

        return migrated;
    }

    /**
     * Migrate from v1.0 (legacy JSON) to v2.0 (ZIP-based)
     * This primarily marks the project for ZIP conversion on save
     */
    migrate_1_0_to_2_0(projectData) {
        console.log('[Migrator] Applying 1.0 -> 2.0 migration');

        // Mark as needing conversion
        projectData._needsZipConversion = true;

        // Add format indicator
        projectData.format = 'mosaic-zip';

        // Ensure all required fields exist
        if (!projectData.nodes) projectData.nodes = [];
        if (!projectData.connections) projectData.connections = [];
        if (!projectData.groups) projectData.groups = [];
        if (!projectData.stickers) projectData.stickers = [];
        if (!projectData.drawings) projectData.drawings = [];

        return projectData;
    }

    /**
     * Create backup before migration
     * @param {string} filePath - Original file path
     * @returns {Promise<string>} Backup file path
     */
    async createBackup(filePath) {
        if (!window.electronAPI) {
            console.warn('[Migrator] Not in Electron, skipping backup');
            return null;
        }

        const backupPath = filePath + '.backup';

        try {
            // Read original and write backup
            const result = await window.electronAPI.openFile(filePath);
            if (result.success) {
                await window.electronAPI.saveFile(result.content, backupPath);
                console.log('[Migrator] Backup created:', backupPath);
                return backupPath;
            }
        } catch (err) {
            console.error('[Migrator] Backup failed:', err);
        }

        return null;
    }

    /**
     * Check if project needs migration
     * @param {Object} projectData - Project data
     * @returns {boolean}
     */
    needsMigration(projectData) {
        const version = this.detectVersion(projectData);
        return version !== this.CURRENT_VERSION;
    }

    /**
     * Check if project needs ZIP conversion
     * @param {Object} projectData - Project data
     * @returns {boolean}
     */
    needsZipConversion(projectData) {
        return projectData._needsZipConversion === true ||
            this.hasEmbeddedBase64(projectData);
    }

    /**
     * Get migration summary
     * @param {Object} projectData - Project data
     * @returns {Object} Summary info
     */
    getMigrationInfo(projectData) {
        const version = this.detectVersion(projectData);
        const needsMigration = version !== this.CURRENT_VERSION;
        const needsZipConversion = this.needsZipConversion(projectData);

        return {
            currentVersion: version,
            targetVersion: this.CURRENT_VERSION,
            needsMigration,
            needsZipConversion,
            description: this.VERSION_HISTORY[version] || 'Unknown version'
        };
    }
}

// Global instance
window.formatMigrator = new FormatMigrator();

console.log('[FormatMigrator] Initialized');
