/**
 * SDP.js (Semantic Data Protocol)
 * Defines the standard data structure for Mosaic communication.
 */

/*
 * Standard Data Types
 */
const MosaicTypes = {
    TEXT: 'text',
    IMAGE: 'image', // Bitmap (png, jpg)
    SVG: 'svg',     // Vector
    URL: 'url',     // Link
    JSON: 'json',   // Structured Object
    HTML: 'html',   // Raw HTML fragment
    UNKNOWN: 'unknown'
};

/**
 * MosaicData Wrapper
 * Every piece of data travelling between nodes must be an instance of this (or compatible).
 */
class MosaicData {
    /**
     * @param {string} type - One of MosaicTypes
     * @param {any} payload - The actual data content
     * @param {object} metadata - Extra info (source, selector, timestamp, etc.)
     */
    constructor(type, payload, metadata = {}) {
        this.id = crypto.randomUUID();
        this.type = type || MosaicTypes.UNKNOWN;
        this.payload = payload;

        this.metadata = {
            timestamp: Date.now(),
            source: 'System', // Should be overwritten by the sender node
            ...metadata
        };
    }

    /**
     * Validates if an object conforms to SDP
     * @param {object} obj 
     */
    static validate(obj) {
        if (!obj || typeof obj !== 'object') return false;

        // precise check
        const hasType = typeof obj.type === 'string';
        const hasPayload = obj.payload !== undefined;
        // metadata is optional but recommended

        return hasType && hasPayload;
    }

    /**
     * Helper to wrap raw data if it's not already SDP
     */
    static wrap(raw, typeHint = MosaicTypes.UNKNOWN) {
        if (MosaicData.validate(raw)) {
            return raw; // Already SDP
        }

        // Auto-detect type if possible
        let type = typeHint;
        if (type === MosaicTypes.UNKNOWN) {
            if (typeof raw === 'string') type = MosaicTypes.TEXT;
            else if (typeof raw === 'object') type = MosaicTypes.JSON;
        }

        return new MosaicData(type, raw);
    }
}

// Expose globally
window.SDP = {
    MosaicData,
    MosaicTypes
};
