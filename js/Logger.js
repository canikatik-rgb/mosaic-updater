/**
 * Logger.js
 * Standardized logging utility for Mosaic Renderer Processes.
 * Sends logs to the Main process via IPC if available, otherwise falls back to console.
 */

class Logger {
    constructor(source = 'Renderer') {
        this.source = source;
    }

    _send(level, message, ...args) {
        // Format message
        const timestamp = new Date().toISOString();
        const formattedMsg = `[${timestamp}] [${level}] [${this.source}] ${message}`;

        // Local Console Fallback (for DevTools)
        const consoleColor = this._getColor(level);
        console.log(`%c${formattedMsg}`, consoleColor, ...args);

        // Send to Main Process via IPC
        if (window.electronAPI && window.electronAPI.log) {
            // We sanitize args to ensure they are serializable if needed, 
            // but Electron handle complex objects reasonably well.
            // For safety, we might just send the message and a stringified version of args if present.
            window.electronAPI.log(level, `[${this.source}] ${message}`, ...args).catch(err => {
                console.error('Failed to send log to main process:', err);
            });
        }
    }

    _getColor(level) {
        switch (level) {
            case 'INFO': return 'color: #0d99ff';
            case 'WARN': return 'color: #ffcc00';
            case 'ERROR': return 'color: #ff4757; font-weight: bold';
            case 'DEBUG': return 'color: #888';
            default: return 'color: #fff';
        }
    }

    info(message, ...args) { this._send('INFO', message, ...args); }
    warn(message, ...args) { this._send('WARN', message, ...args); }
    error(message, ...args) { this._send('ERROR', message, ...args); }
    debug(message, ...args) { this._send('DEBUG', message, ...args); }
}

// Export as a global singleton-like utility if included via script tag
// or module export in the future.
window.Logger = Logger;
