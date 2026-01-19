const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    listLocalFiles: (dirPath) => ipcRenderer.invoke('list-local-files', dirPath),
    saveFile: (content, filePath) => ipcRenderer.invoke('save-file', content, filePath),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    exportFile: (content, filename, extension) => ipcRenderer.invoke('export-file', content, filename, extension),
    openElementInspector: (url) => ipcRenderer.invoke('open-element-inspector', url),
    // Observer system
    startObserve: (options) => ipcRenderer.invoke('start-observe', options),
    stopObserve: (options) => ipcRenderer.invoke('stop-observe', options),
    onObserverUpdate: (callback) => ipcRenderer.on('observer-update', (event, data) => callback(data)),
    // Fullscreen detection
    onFullscreenChange: (callback) => ipcRenderer.on('fullscreen-change', (event, isFullscreen) => callback(isFullscreen)),
    // Logging
    log: (level, message, ...args) => ipcRenderer.invoke('log-message', level, message, ...args),
    // Template system
    listTemplates: () => ipcRenderer.invoke('list-templates'),
    readTemplate: (templatePath) => ipcRenderer.invoke('read-template', templatePath),
    saveAsTemplate: (options) => ipcRenderer.invoke('save-as-template', options),
    // Recent projects
    getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
    addToRecent: (projectInfo) => ipcRenderer.invoke('add-to-recent', projectInfo),
    removeFromRecent: (projectPath) => ipcRenderer.invoke('remove-from-recent', projectPath),
    updateProjectThumbnail: (options) => ipcRenderer.invoke('update-project-thumbnail', options),
    relocateProject: (oldPath) => ipcRenderer.invoke('relocate-project', oldPath),
    // File association - open file from OS
    onOpenFilePath: (callback) => ipcRenderer.on('open-file-path', (event, filePath) => callback(filePath)),
    // Webview popup handling - create URL node instead of popup window
    onCreateUrlNode: (callback) => ipcRenderer.on('create-url-node', (event, data) => callback(data)),
    // Auth deep link handling
    onAuthDeepLink: (callback) => ipcRenderer.on('auth-deep-link', (event, data) => callback(data)),

    // ========== ZIP-Based Archive System ==========
    // Save ZIP archive (Buffer) to file
    saveZipFile: (zipBuffer, filePath) => ipcRenderer.invoke('save-zip-file', zipBuffer, filePath),
    // Open ZIP archive and return as Buffer
    openZipFile: (filePath) => ipcRenderer.invoke('open-zip-file', filePath),
    // Extract single asset from ZIP (lazy loading)
    extractAsset: (zipPath, assetPath) => ipcRenderer.invoke('extract-asset', zipPath, assetPath),
    // Check if file is ZIP format
    isZipFile: (filePath) => ipcRenderer.invoke('is-zip-file', filePath),

    // ========== Clipboard API ==========
    readClipboard: () => ipcRenderer.invoke('read-clipboard'),
    writeClipboardText: (text) => ipcRenderer.invoke('write-clipboard-text', text),
    writeClipboardImage: (dataUrl) => ipcRenderer.invoke('write-clipboard-image', dataUrl),
    simulatePaste: () => ipcRenderer.invoke('simulate-paste'),

    // ========== File-backed Data Cards API ==========
    writeCardFile: (cardId, type, content, extension) => ipcRenderer.invoke('write-card-file', { cardId, type, content, extension }),
    getCardFilePath: (relativePath) => ipcRenderer.invoke('get-card-file-path', relativePath),
    deleteCardFile: (relativePath) => ipcRenderer.invoke('delete-card-file', relativePath),
    readCardFile: (relativePath) => ipcRenderer.invoke('read-card-file', relativePath),
    getSessionTempPath: () => ipcRenderer.invoke('get-session-temp-path'),
    startNativeDrag: (filePath, iconPath) => ipcRenderer.invoke('start-native-drag', { filePath, iconPath }),

    // ========== Auto-Updater API ==========
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    downloadUpdate: () => ipcRenderer.invoke('update:download'),
    installUpdate: () => ipcRenderer.invoke('update:install'),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
    onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (event, info) => callback(info)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, progress) => callback(progress)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (event, err) => callback(err))
});

