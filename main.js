const { app, BrowserWindow, ipcMain, dialog, session, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { getChromeInfo } = require('./js/chrome-detection');
const sessionTempManager = require('./js/session-temp-manager');

// --- Central Logger ---
function log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}][${level}] ${message} `;

    // Print to terminal
    console.log(formatted, ...args);
}

// --- Chrome & Widevine Detection ---
const { setupWidevine } = require('./js/cdm-setup');

let chromeInfo = { userAgent: '' };

try {
    log('INFO', `Starting Application... (Arch: ${process.arch})`);

    // Auto-Sandbox: Required for some environments to load plugins
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('ignore-certificate-errors');

    // 1. Setup Widevine (Copy to safe location)
    const localCdm = setupWidevine();

    // 2. Load it
    // 2. Load it
    if (localCdm && localCdm.path) {
        // STANDARD ELECTRON v40+ LOADING: Point to the Directory (must contain manifest.json)
        // With permissions fixed (local copy) and version matched (Electron 40), this is the correct way.

        log('INFO', `Enabling Widevine CDM from Local Directory: ${localCdm.path} (v${localCdm.version})`);

        app.commandLine.appendSwitch('widevine-cdm-path', localCdm.path);
        app.commandLine.appendSwitch('widevine-cdm-version', localCdm.version);
    } else {
        log('WARN', 'Widevine CDM setup failed. DRM will not work.');
    }

    // 3. Get generic chrome info for User Agent only
    chromeInfo = getChromeInfo();

} catch (e) {
    log('ERROR', 'Error during Startup/CDM:', e);
}


function createWindow() {
    const defaultUserAgent = chromeInfo.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        // Frameless window configuration for modern macOS look
        frame: false,
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 20, y: 14 },
        backgroundColor: '#1e1e1e',  // Solid background color
        hasShadow: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true,  // Enable webview for URL Node element inspector
            plugins: true // Enabled for Widevine CDM Support
        },
        icon: path.join(__dirname, 'images/favicon.png')
    });

    // Set User Agent Globally for this session
    win.webContents.session.setUserAgent(defaultUserAgent);
    log('INFO', 'User-Agent set to:', defaultUserAgent);

    // --- DRM/WIDEVINE PERMISSION CONFIGURATION ---
    // Grant permissions required for DRM playback
    const ses = win.webContents.session;

    // Permission Request Handler - Allow DRM-related permissions
    ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
        const allowedPermissions = [
            'media',
            'mediaKeySystem',  // Widevine/DRM
            'geolocation',
            'notifications',
            'fullscreen',
            'pointerLock',
            'openExternal',
            'clipboard-read',
            'clipboard-write'
        ];

        log('DEBUG', `[DRM] Permission requested: ${permission}`, details?.mediaTypes || '');

        if (allowedPermissions.includes(permission)) {
            log('INFO', `[DRM] Granting permission: ${permission}`);
            callback(true);
        } else {
            log('WARN', `[DRM] Denying permission: ${permission}`);
            callback(false);
        }
    });

    // Permission Check Handler - For sync permission checks
    ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
        const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'fullscreen', 'pointerLock'];

        if (allowedPermissions.includes(permission)) {
            return true;
        }

        // Allow protected content (DRM)
        if (details && details.isMainFrame !== undefined) {
            return true;
        }

        return false;
    });

    // Enable protected content (Widevine) for all webviews in this session
    // This is handled automatically when plugins: true is set, but we log for debugging
    log('INFO', '[DRM] Session configured for protected content playback');

    win.loadFile('index.html');

    // Open DevTools in debug mode
    // win.webContents.openDevTools();

    // --- ENABLE EMBEDDING EXTERNAL SITES ---
    // Intercept headers to remove X-Frame-Options and CSP that block iframes
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = Object.assign({}, details.responseHeaders);

        // Remove headers that block embedding
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['X-Frame-Options'];
        delete responseHeaders['content-security-policy'];
        delete responseHeaders['Content-Security-Policy'];

        // Allow framing
        callback({ cancel: false, responseHeaders: responseHeaders });
    });

    // Notify renderer of fullscreen changes (for traffic lights visibility)
    win.on('enter-full-screen', () => {
        win.webContents.send('fullscreen-change', true);
    });

    win.on('leave-full-screen', () => {
        win.webContents.send('fullscreen-change', false);
    });
}

// --- Deep Link Protocol Handler for Auth ---
// Register 'mosaic://' protocol for macOS
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('mosaic', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('mosaic');
}

// Handle deep link on macOS
app.on('open-url', (event, url) => {
    event.preventDefault();
    log('INFO', '[DeepLink] Received URL:', url);

    handleDeepLink(url);
});

// Handle deep link on Windows/Linux (single instance)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();

            // Check for deep link in command line
            const deepLink = commandLine.find(arg => arg.startsWith('mosaic://'));
            if (deepLink) {
                handleDeepLink(deepLink);
            }
        }
    });
}

// Process deep link URL
function handleDeepLink(url) {
    try {
        const parsedUrl = new URL(url);
        const win = BrowserWindow.getAllWindows()[0];

        if (!win) {
            log('WARN', '[DeepLink] No window available');
            return;
        }

        // Auth verification callback
        if (parsedUrl.host === 'auth' || parsedUrl.pathname.includes('/auth')) {
            log('INFO', '[DeepLink] Auth callback received');

            // Extract tokens from hash or query params
            const params = new URLSearchParams(parsedUrl.hash.slice(1) || parsedUrl.search);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const type = params.get('type');

            // Send to renderer
            win.webContents.send('auth-deep-link', {
                accessToken,
                refreshToken,
                type,
                rawUrl: url
            });

            // Focus window
            win.show();
            win.focus();
        }
    } catch (error) {
        log('ERROR', '[DeepLink] Error processing URL:', error);
    }
}

app.whenReady().then(async () => {
    // --- INITIALIZE SESSION TEMP MANAGER ---
    try {
        await sessionTempManager.cleanupOldSessions();
        await sessionTempManager.initialize();
        log('INFO', '[SessionTemp] Session folder ready');
    } catch (err) {
        log('ERROR', '[SessionTemp] Initialization failed:', err);
    }

    // --- CONFIGURE WEBVIEW SESSION FOR DRM ---
    // Set up the persist:webview partition that URL Nodes use
    const webviewSession = session.fromPartition('persist:webview');

    // Configure DRM permissions for webview session
    webviewSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        const allowedPermissions = [
            'media',
            'mediaKeySystem',  // Widevine/DRM
            'geolocation',
            'notifications',
            'fullscreen',
            'pointerLock',
            'openExternal',
            'clipboard-read',
            'clipboard-write'
        ];

        log('DEBUG', `[DRM-WebviewSession] Permission requested: ${permission}`);

        if (allowedPermissions.includes(permission)) {
            log('INFO', `[DRM-WebviewSession] Granting permission: ${permission}`);
            callback(true);
        } else {
            callback(false);
        }
    });

    webviewSession.setPermissionCheckHandler((webContents, permission) => {
        const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'fullscreen', 'pointerLock'];
        return allowedPermissions.includes(permission);
    });

    // Set User Agent for webview session to match main
    const defaultUA = chromeInfo.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
    webviewSession.setUserAgent(defaultUA);

    log('INFO', '[DRM] Webview session (persist:webview) configured for DRM playback');

    createSplashWindow();

    // Simulate App Lifecycle Checks
    // In future: performUpdateCheck(), checkAuthSession(), etc.
    performStartupChecks();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            // Check if we passed initialization or need to restart flow
            if (isAppReady) {
                createWindow();
            } else {
                createSplashWindow();
                performStartupChecks();
            }
        }
    });
});

let splashWindow = null;
let isAppReady = false;

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 340,
        height: 340,
        frame: false,
        transparent: false, // Ensure background color renders correctly, or true if designing transparency
        backgroundColor: '#1e1e1e',
        resizable: false,
        center: true,
        show: false, // Wait until ready-to-show
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: true, // For simple status IPC
            contextIsolation: false // For simple status IPC (Splash only)
        }
    });

    splashWindow.loadFile('splash.html');

    splashWindow.once('ready-to-show', () => {
        splashWindow.show();
    });

    splashWindow.webContents.once('did-finish-load', () => {
        const version = require('./package.json').version;
        splashWindow.webContents.send('app-version', version);
    });
}

async function performStartupChecks() {
    // 1. Network Check (Simulated)
    updateSplashStatus('Checking network connection...');
    await delay(600);

    // 2. Auto-Updater (Stub)
    updateSplashStatus('Checking for updates...');
    await delay(800);
    // TODO: Implement actual autoUpdater.checkForUpdatesAndNotify() here when library is installed
    // const { autoUpdater } = require('electron-updater');
    // autoUpdater.checkForUpdatesAndNotify();

    // 3. Auth Check (Simulated)
    updateSplashStatus('Verifying license...');
    await delay(600);

    // 4. Ready
    updateSplashStatus('Ready. Launching Mosaic...');
    await delay(300);

    isAppReady = true;
    createWindow();

    if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
    }
}

function updateSplashStatus(text) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', text);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Cleanup session temp on quit
app.on('before-quit', async () => {
    try {
        await sessionTempManager.cleanup();
        log('INFO', '[SessionTemp] Session folder cleaned up');
    } catch (err) {
        log('WARN', '[SessionTemp] Cleanup failed:', err.message);
    }
});

// --- File Association Handlers ---
// Track file to open (for when app starts from file double-click)
let fileToOpen = null;

// macOS: Handle open-file event (when file is double-clicked)
app.on('open-file', (event, filePath) => {
    event.preventDefault();

    if (filePath.endsWith('.mosaic') || filePath.endsWith('.json')) {
        log('INFO', 'File opened via macOS file association:', filePath);

        // If app is already running, send to renderer
        const win = BrowserWindow.getAllWindows()[0];
        if (win && win.webContents) {
            win.webContents.send('open-file-path', filePath);
        } else {
            // App not ready yet, save for later
            fileToOpen = filePath;
        }
    }
});

// Windows/Linux: Handle command line arguments
app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance - focus our window instead
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();

        // Check for file path in command line
        const filePath = commandLine.find(arg =>
            arg.endsWith('.mosaic') || arg.endsWith('.json')
        );
        if (filePath) {
            log('INFO', 'File opened via command line:', filePath);
            win.webContents.send('open-file-path', filePath);
        }
    }
});

// Send pending file to renderer when ready
app.on('browser-window-created', (event, win) => {
    win.webContents.on('did-finish-load', () => {
        if (fileToOpen) {
            win.webContents.send('open-file-path', fileToOpen);
            fileToOpen = null;
        }

        // Also check command line args for Windows
        const args = process.argv;
        const filePath = args.find(arg =>
            arg.endsWith('.mosaic') || arg.endsWith('.json')
        );
        if (filePath && fs.existsSync(filePath)) {
            log('INFO', 'Opening file from command line args:', filePath);
            win.webContents.send('open-file-path', filePath);
        }
    });
});

// --- IPC Handlers for Local File Access ---

// Handle new window requests from webviews
// This ensures popup windows are converted to new URL nodes instead of opening new windows
// IMPORTANT: webview elements need special handling - we use web-contents-created event

// Track all webContents and set up handlers
app.on('web-contents-created', (event, contents) => {
    const contentsType = contents.getType();
    log('INFO', '[Main] WebContents created, type:', contentsType, 'id:', contents.id);

    // Set up window open handler for ALL webContents types
    // This catches both webview and other types
    contents.setWindowOpenHandler(({ url, frameName, disposition }) => {
        log('INFO', '[Main] setWindowOpenHandler triggered:', url, 'disposition:', disposition, 'type:', contentsType);

        // Send the URL to the renderer process
        const win = BrowserWindow.getAllWindows()[0];
        if (win && win.webContents) {
            win.webContents.send('create-url-node', { url, disposition, fromType: contentsType });
            log('INFO', '[Main] Sent create-url-node IPC to renderer');
        }

        // Deny the popup - renderer will create a node instead
        return { action: 'deny' };
    });

    // For webview type specifically, set up DRM permissions and handlers
    if (contentsType === 'webview') {
        log('INFO', '[Main] Setting up webview-specific handlers (including DRM)');

        contents.on('will-navigate', (event, url) => {
            log('DEBUG', '[Main] Webview will-navigate:', url);
        });

        // --- WEBVIEW DRM PERMISSION CONFIGURATION ---
        // Webviews have their own session, we need to configure DRM permissions for them too
        const webviewSession = contents.session;

        // Set permission request handler for this webview's session
        webviewSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
            const allowedPermissions = [
                'media',
                'mediaKeySystem',  // Widevine/DRM
                'geolocation',
                'notifications',
                'fullscreen',
                'pointerLock',
                'openExternal',
                'clipboard-read',
                'clipboard-write'
            ];

            log('DEBUG', `[DRM-Webview] Permission requested: ${permission}`, details?.mediaTypes || '');

            if (allowedPermissions.includes(permission)) {
                log('INFO', `[DRM-Webview] Granting permission: ${permission}`);
                callback(true);
            } else {
                log('WARN', `[DRM-Webview] Denying permission: ${permission}`);
                callback(false);
            }
        });

        // Set permission check handler
        webviewSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
            const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'fullscreen', 'pointerLock'];

            if (allowedPermissions.includes(permission)) {
                return true;
            }

            // Allow protected content checks
            if (details && details.securityOrigin) {
                return true;
            }

            return false;
        });

        log('INFO', '[DRM-Webview] Session ID:', webviewSession.storagePath || 'default', 'configured for DRM');
    }
});

// Central Logging Handler
ipcMain.handle('log-message', async (event, level, message, ...args) => {
    log(level, message, ...args);
});

// --- Recent Projects Store ---
const RECENT_PROJECTS_FILE = path.join(app.getPath('userData'), 'recent-projects.json');
const MAX_RECENT_PROJECTS = 20;

// Load recent projects from disk
function loadRecentProjects() {
    try {
        if (fs.existsSync(RECENT_PROJECTS_FILE)) {
            const data = fs.readFileSync(RECENT_PROJECTS_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log('ERROR', 'Error loading recent projects:', error);
    }
    return { recentProjects: [] };
}

// Save recent projects to disk
function saveRecentProjects(data) {
    try {
        fs.writeFileSync(RECENT_PROJECTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        log('ERROR', 'Error saving recent projects:', error);
    }
}

// Add or update a project in recent list
function addToRecentProjects(projectInfo) {
    const data = loadRecentProjects();

    // Remove existing entry with same path (to update position)
    data.recentProjects = data.recentProjects.filter(p => p.path !== projectInfo.path);

    // Add to beginning of list
    data.recentProjects.unshift({
        id: projectInfo.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: projectInfo.name,
        path: projectInfo.path,
        lastOpened: new Date().toISOString(),
        thumbnail: projectInfo.thumbnail || null
    });

    // Limit to max recent projects
    if (data.recentProjects.length > MAX_RECENT_PROJECTS) {
        data.recentProjects = data.recentProjects.slice(0, MAX_RECENT_PROJECTS);
    }

    saveRecentProjects(data);
    return data.recentProjects;
}

// Get recent projects list
ipcMain.handle('get-recent-projects', async () => {
    const data = loadRecentProjects();

    // Validate that files still exist and add file stats
    const validatedProjects = [];
    for (const project of data.recentProjects) {
        if (fs.existsSync(project.path)) {
            try {
                const stats = fs.statSync(project.path);
                validatedProjects.push({
                    ...project,
                    mtime: stats.mtime,
                    exists: true
                });
            } catch (e) {
                // File exists but can't read stats, still include
                validatedProjects.push({ ...project, exists: true });
            }
        } else {
            // File doesn't exist, mark as missing
            validatedProjects.push({ ...project, exists: false });
        }
    }

    return validatedProjects;
});

// Add project to recent list
ipcMain.handle('add-to-recent', async (event, projectInfo) => {
    return addToRecentProjects(projectInfo);
});

// Remove project from recent list
ipcMain.handle('remove-from-recent', async (event, projectPath) => {
    const data = loadRecentProjects();
    data.recentProjects = data.recentProjects.filter(p => p.path !== projectPath);
    saveRecentProjects(data);
    return data.recentProjects;
});

// Update thumbnail for a project
ipcMain.handle('update-project-thumbnail', async (event, { path: projectPath, thumbnail }) => {
    const data = loadRecentProjects();
    const project = data.recentProjects.find(p => p.path === projectPath);
    if (project) {
        project.thumbnail = thumbnail;
        saveRecentProjects(data);
    }
    return { success: true };
});

// Relocate a missing project file
ipcMain.handle('relocate-project', async (event, oldPath) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Locate Project File',
            message: `The file "${path.basename(oldPath)}" was not found. Please locate it.`,
            properties: ['openFile'],
            filters: [{ name: 'Mosaic Project', extensions: ['mosaic', 'json'] }]
        });

        if (canceled || filePaths.length === 0) {
            return { canceled: true };
        }

        const newPath = filePaths[0];

        // Update the path in recent projects
        const data = loadRecentProjects();
        const project = data.recentProjects.find(p => p.path === oldPath);
        if (project) {
            project.path = newPath;
            saveRecentProjects(data);
        }

        return { success: true, newPath };
    } catch (error) {
        log('ERROR', 'Error relocating project:', error);
        return { error: error.message };
    }
});


// List files in a directory (Dashboard)
ipcMain.handle('list-local-files', async (event, dirPath) => {
    try {
        // Default to a 'MosaicProjects' folder in Documents if no path provided
        const targetPath = dirPath || path.join(app.getPath('documents'), 'MosaicProjects');

        // Ensure directory exists
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }

        const files = fs.readdirSync(targetPath);
        const mosaicFiles = files.filter(file => file.endsWith('.mosaic') || file.endsWith('.json'))
            .map(file => {
                const filePath = path.join(targetPath, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    path: filePath,
                    mtime: stats.mtime
                };
            });

        // Sort by modified time desc
        return mosaicFiles.sort((a, b) => b.mtime - a.mtime);
    } catch (error) {
        log('ERROR', 'Error listing local files:', error);
        throw error;
    }
});

// --- Template System IPC Handlers ---

// List all templates with categories
ipcMain.handle('list-templates', async () => {
    try {
        const templatesPath = path.join(__dirname, 'templates');
        const manifestPath = path.join(templatesPath, 'manifest.json');

        if (!fs.existsSync(manifestPath)) {
            return { categories: [] };
        }

        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);

        // For each category, scan the directory for .mosaic files
        for (const category of manifest.categories) {
            const categoryPath = path.join(templatesPath, category.id);

            if (fs.existsSync(categoryPath)) {
                const files = fs.readdirSync(categoryPath)
                    .filter(file => file.endsWith('.mosaic') || file.endsWith('.json'));

                category.templates = files.map(file => ({
                    name: file.replace('.mosaic', '').replace('.json', ''),
                    path: path.join(categoryPath, file)
                }));
            }
        }

        return manifest;
    } catch (error) {
        log('ERROR', 'Error listing templates:', error);
        return { categories: [] };
    }
});

// Read a specific template file
ipcMain.handle('read-template', async (event, templatePath) => {
    try {
        if (!fs.existsSync(templatePath)) {
            return { error: 'Template not found' };
        }

        const content = fs.readFileSync(templatePath, 'utf-8');
        return { success: true, content, name: path.basename(templatePath).replace('.mosaic', '') };
    } catch (error) {
        log('ERROR', 'Error reading template:', error);
        return { error: error.message };
    }
});

// Save project as a template
ipcMain.handle('save-as-template', async (event, { name, content, categoryId }) => {
    try {
        const templatesPath = path.join(__dirname, 'templates');
        // Default to my-templates if no category specified
        const category = categoryId || 'my-templates';
        const categoryPath = path.join(templatesPath, category);

        // Ensure category directory exists
        if (!fs.existsSync(categoryPath)) {
            fs.mkdirSync(categoryPath, { recursive: true });
        }

        // Create safe filename
        const safeName = name.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '-') || 'untitled';
        const filePath = path.join(categoryPath, `${safeName}.mosaic`);

        // Write template file
        fs.writeFileSync(filePath, content, 'utf-8');

        log('INFO', `Template saved: ${filePath}`);
        return { success: true, path: filePath, name: safeName };
    } catch (error) {
        log('ERROR', 'Error saving template:', error);
        return { error: error.message };
    }
});

// Save file
ipcMain.handle('save-file', async (event, content, filePath) => {
    try {
        let savePath = filePath;
        if (!savePath) {
            // Show save dialog if no path
            const { filePath: chosenPath } = await dialog.showSaveDialog({
                filters: [{ name: 'Mosaic Project', extensions: ['mosaic', 'json'] }]
            });
            if (!chosenPath) return { canceled: true };
            savePath = chosenPath;
        }

        fs.writeFileSync(savePath, content, 'utf-8');
        return { success: true, path: savePath };
    } catch (error) {
        log('ERROR', 'Error saving file:', error);
        throw error;
    }
});

// Export file with custom extension (for Save Node)
ipcMain.handle('export-file', async (event, content, filename, extension) => {
    try {
        const ext = extension || 'txt';
        const filterName = ext.toUpperCase() + ' File';

        const { filePath: chosenPath } = await dialog.showSaveDialog({
            defaultPath: filename,
            filters: [
                { name: filterName, extensions: [ext] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!chosenPath) return { canceled: true };

        fs.writeFileSync(chosenPath, content, 'utf-8');
        return { success: true, path: chosenPath };
    } catch (error) {
        log('ERROR', 'Error exporting file:', error);
        throw error;
    }
});

// Open file
ipcMain.handle('open-file', async (event, filePath) => {
    try {
        let itemsToOpen = [filePath];

        if (!filePath) {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'Mosaic Project', extensions: ['mosaic', 'json'] }]
            });
            if (canceled) return { canceled: true };
            itemsToOpen = filePaths;
        }

        const content = fs.readFileSync(itemsToOpen[0], 'utf-8');
        return { success: true, content, path: itemsToOpen[0], name: path.basename(itemsToOpen[0]) };
    } catch (error) {
        log('ERROR', 'Error opening file:', error);
        throw error;
    }
});

// ========== ZIP-Based Archive System ==========
const JSZip = require('jszip');

// Save ZIP file (binary Buffer)
ipcMain.handle('save-zip-file', async (event, zipBuffer, filePath) => {
    try {
        let savePath = filePath;
        if (!savePath) {
            const { filePath: chosenPath } = await dialog.showSaveDialog({
                filters: [{ name: 'Mosaic Project', extensions: ['mosaic'] }]
            });
            if (!chosenPath) return { canceled: true };
            savePath = chosenPath;
        }

        // Ensure .mosaic extension
        if (!savePath.endsWith('.mosaic')) {
            savePath += '.mosaic';
        }

        // Write binary buffer
        fs.writeFileSync(savePath, Buffer.from(zipBuffer));
        log('INFO', '[ZIP] Saved archive:', savePath);
        return { success: true, path: savePath };
    } catch (error) {
        log('ERROR', 'Error saving ZIP file:', error);
        throw error;
    }
});

// Open ZIP file and return buffer
ipcMain.handle('open-zip-file', async (event, filePath) => {
    try {
        let itemsToOpen = [filePath];

        if (!filePath) {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'Mosaic Project', extensions: ['mosaic'] }]
            });
            if (canceled) return { canceled: true };
            itemsToOpen = filePaths;
        }

        const buffer = fs.readFileSync(itemsToOpen[0]);
        log('INFO', '[ZIP] Read archive:', itemsToOpen[0], 'size:', buffer.length);
        return {
            success: true,
            buffer: buffer.buffer, // ArrayBuffer for renderer
            path: itemsToOpen[0],
            name: path.basename(itemsToOpen[0])
        };
    } catch (error) {
        log('ERROR', 'Error opening ZIP file:', error);
        throw error;
    }
});

// Extract single asset from ZIP (lazy loading)
ipcMain.handle('extract-asset', async (event, zipPath, assetPath) => {
    try {
        const buffer = fs.readFileSync(zipPath);
        const zip = await JSZip.loadAsync(buffer);

        const file = zip.file(assetPath);
        if (!file) {
            return { success: false, error: 'Asset not found: ' + assetPath };
        }

        const assetBuffer = await file.async('arraybuffer');
        log('DEBUG', '[ZIP] Extracted asset:', assetPath, 'size:', assetBuffer.byteLength);
        return { success: true, buffer: assetBuffer };
    } catch (error) {
        log('ERROR', 'Error extracting asset:', error);
        return { success: false, error: error.message };
    }
});

// Check if file is ZIP format (by magic bytes)
ipcMain.handle('is-zip-file', async (event, filePath) => {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(4);
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);

        // ZIP magic bytes: 0x50 0x4B 0x03 0x04
        const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B &&
            buffer[2] === 0x03 && buffer[3] === 0x04;
        return { isZip, path: filePath };
    } catch (error) {
        log('ERROR', 'Error checking file type:', error);
        return { isZip: false, error: error.message };
    }
});

// --- Element Inspector (BrowserView) ---
let inspectorView = null;
let inspectorCallback = null;

// ========== CLIPBOARD HANDLERS ==========
ipcMain.handle('read-clipboard', () => {
    try {
        const { clipboard } = require('electron');
        const text = clipboard.readText();
        const image = clipboard.readImage();
        return {
            text,
            hasImage: !image.isEmpty(),
            image: !image.isEmpty() ? image.toDataURL() : null,
            formats: clipboard.availableFormats()
        };
    } catch (e) {
        console.error('Clipboard IPC read error:', e);
        return null;
    }
});

ipcMain.handle('write-clipboard-text', (event, text) => {
    try {
        const { clipboard } = require('electron');
        clipboard.writeText(text);
        return { success: true };
    } catch (e) {
        log('ERROR', 'Clipboard IPC write text error:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('write-clipboard-image', (event, dataUrl) => {
    try {
        const { clipboard, nativeImage } = require('electron');

        if (!dataUrl || typeof dataUrl !== 'string') {
            log('WARN', '[Clipboard] Invalid dataUrl: not a string');
            return { success: false, error: 'Invalid dataUrl' };
        }

        if (!dataUrl.startsWith('data:')) {
            log('WARN', '[Clipboard] Invalid dataUrl format, expected data: prefix');
            return { success: false, error: 'Invalid dataUrl format' };
        }

        const image = nativeImage.createFromDataURL(dataUrl);

        if (image.isEmpty()) {
            log('WARN', '[Clipboard] Created empty image from dataUrl');
            return { success: false, error: 'Empty image created' };
        }

        clipboard.writeImage(image);
        const size = image.getSize();
        log('INFO', `[Clipboard] Image written successfully, size: ${size.width}x${size.height}`);
        return { success: true, width: size.width, height: size.height };
    } catch (e) {
        log('ERROR', 'Clipboard IPC write image error:', e);
        return { success: false, error: e.message };
    }
});

// Simulate system-level paste (Cmd+V) using AppleScript (macOS only)
ipcMain.handle('simulate-paste', async () => {
    try {
        const { exec } = require('child_process');

        // Small delay to ensure clipboard is ready
        await new Promise(resolve => setTimeout(resolve, 100));

        return new Promise((resolve) => {
            // AppleScript to simulate Cmd+V keystroke
            const script = `
                tell application "System Events"
                    keystroke "v" using command down
                end tell
            `;

            exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
                if (error) {
                    log('ERROR', '[SimulatePaste] AppleScript error:', error.message);
                    resolve({ success: false, error: error.message });
                } else {
                    log('INFO', '[SimulatePaste] Paste simulated successfully');
                    resolve({ success: true });
                }
            });
        });
    } catch (e) {
        log('ERROR', '[SimulatePaste] Error:', e.message);
        return { success: false, error: e.message };
    }
});

// ========== FILE-BACKED DATA CARDS IPC HANDLERS ==========

// Write content to a card file in session temp
ipcMain.handle('write-card-file', async (event, { cardId, type, content, extension }) => {
    try {
        const pathInfo = sessionTempManager.generateCardFilePath(cardId, type, extension);

        // Ensure parent directory exists
        await fsPromises.mkdir(path.dirname(pathInfo.absolutePath), { recursive: true });

        if (type === 'image' && content.startsWith('data:')) {
            // Base64 image - extract and write binary
            const base64Data = content.replace(/^data:image\/\w+;base64,/, '');
            await fsPromises.writeFile(pathInfo.absolutePath, Buffer.from(base64Data, 'base64'));
        } else if (Buffer.isBuffer(content)) {
            // Binary buffer
            await fsPromises.writeFile(pathInfo.absolutePath, content);
        } else {
            // Text content
            await fsPromises.writeFile(pathInfo.absolutePath, content, 'utf8');
        }

        log('INFO', `[CardFile] Written: ${pathInfo.relativePath}`);
        return { success: true, filePath: pathInfo.relativePath };
    } catch (err) {
        log('ERROR', '[CardFile] Write failed:', err.message);
        return { success: false, error: err.message };
    }
});

// Get absolute path for a relative card file path
ipcMain.handle('get-card-file-path', async (event, relativePath) => {
    try {
        const absolutePath = sessionTempManager.getAbsolutePath(relativePath);
        const exists = sessionTempManager.fileExists(relativePath);
        return { success: true, absolutePath, exists };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Delete a card file
ipcMain.handle('delete-card-file', async (event, relativePath) => {
    try {
        await sessionTempManager.deleteFile(relativePath);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Read a card file content
ipcMain.handle('read-card-file', async (event, relativePath) => {
    try {
        const absolutePath = sessionTempManager.getAbsolutePath(relativePath);
        const content = await fsPromises.readFile(absolutePath);
        return { success: true, content };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Get session temp base path
ipcMain.handle('get-session-temp-path', async () => {
    return {
        success: true,
        basePath: sessionTempManager.basePath,
        sessionId: sessionTempManager.sessionId
    };
});

// Native file drag - allows dragging card files to external apps like Figma
ipcMain.handle('start-native-drag', async (event, { filePath, iconPath }) => {
    try {
        const absolutePath = sessionTempManager.getAbsolutePath(filePath);

        // Verify file exists
        if (!sessionTempManager.fileExists(filePath)) {
            log('WARN', `[NativeDrag] File does not exist: ${filePath}`);
            return { success: false, error: 'File does not exist' };
        }

        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) {
            return { success: false, error: 'Window not found' };
        }

        // Create drag icon based on file type
        let icon;
        const ext = path.extname(filePath).toLowerCase();

        if (iconPath && fs.existsSync(iconPath)) {
            icon = nativeImage.createFromPath(iconPath);
        } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
            // For bitmap images, create icon from the file itself
            icon = nativeImage.createFromPath(absolutePath);
            if (!icon.isEmpty()) {
                icon = icon.resize({ width: 64, height: 64 });
            }
        }

        // Fallback: Create a minimal valid icon if we don't have one
        // nativeImage.createEmpty() returns invalid icon, so we create a 1x1 transparent PNG
        if (!icon || icon.isEmpty()) {
            // Create a simple 16x16 gray square as fallback icon
            // This is a minimal valid PNG that won't cause drag failures
            const size = 16;
            const canvas = Buffer.alloc(size * size * 4); // RGBA
            for (let i = 0; i < size * size; i++) {
                canvas[i * 4] = 128;     // R
                canvas[i * 4 + 1] = 128; // G
                canvas[i * 4 + 2] = 128; // B
                canvas[i * 4 + 3] = 200; // A
            }
            icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
        }

        log('INFO', `[NativeDrag] Starting drag: ${absolutePath}`);

        event.sender.startDrag({
            file: absolutePath,
            icon: icon
        });

        return { success: true };
    } catch (err) {
        log('ERROR', '[NativeDrag] Failed:', err.message);
        return { success: false, error: err.message };
    }
});


ipcMain.handle('open-element-inspector', async (event, url) => {
    return new Promise((resolve) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) {
            resolve({ error: 'No window found' });
            return;
        }

        // Store callback
        inspectorCallback = resolve;

        // Create BrowserView
        const { BrowserView } = require('electron');
        inspectorView = new BrowserView({
            webPreferences: {
                preload: path.join(__dirname, 'inspector-preload.js'),
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        win.setBrowserView(inspectorView);

        // Set bounds to fill window
        const bounds = win.getContentBounds();
        inspectorView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
        inspectorView.setAutoResize({ width: true, height: true });

        // Load the URL
        inspectorView.webContents.loadURL(url);

        inspectorView.webContents.loadURL(url);

        log('INFO', '[Inspector] Opened for URL:', url);
    });

});

// Inspector IPC events
ipcMain.on('inspector-ready', (event) => {
    log('INFO', '[Inspector] Preload ready');
});

// --- Browser Node Context Menu ---
ipcMain.on('show-context-menu', (event) => {
    const { Menu, MenuItem } = require('electron');
    const menu = new Menu();

    const sender = event.sender;
    menu.append(new MenuItem({
        label: 'Back',
        click: () => sender.send('context-menu-command', 'back')
    }));
    menu.append(new MenuItem({
        label: 'Forward',
        click: () => sender.send('context-menu-command', 'forward')
    }));
    menu.append(new MenuItem({
        label: 'Reload',
        click: () => sender.send('context-menu-command', 'reload')
    }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
        label: 'Inspect Element',
        click: () => sender.send('context-menu-command', 'inspect')
    }));

    // Show the menu at cursor
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) menu.popup({ window: win });
});


ipcMain.on('inspector-hover', (event, data) => {
    // Optional: Could send hover info back to renderer for preview
    // console.log('[Inspector] Hover:', data.selector);
});

ipcMain.on('inspector-select', (event, data) => {
    log('INFO', '[Inspector] Selected:', data);


    // Get current page URL before closing
    let pageUrl = null;
    if (inspectorView && inspectorView.webContents) {
        pageUrl = inspectorView.webContents.getURL();
    }

    // Close inspector
    if (inspectorView) {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.removeBrowserView(inspectorView);
        }
        inspectorView = null;
    }

    // Return selected data with page URL
    if (inspectorCallback) {
        inspectorCallback({ success: true, data, url: pageUrl });
        inspectorCallback = null;
    }
});

ipcMain.on('inspector-cancel', (event) => {
    console.log('[Inspector] Cancelled');

    // Close inspector
    if (inspectorView) {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.removeBrowserView(inspectorView);
        }
        inspectorView = null;
    }

    // Return cancelled
    if (inspectorCallback) {
        inspectorCallback({ cancelled: true });
        inspectorCallback = null;
    }
});

// ============= OBSERVER SYSTEM =============
// Store active observers: nodeId -> { view, timer, selector, url }
const activeObservers = new Map();

ipcMain.handle('start-observe', async (event, { nodeId, url, selector, interval }) => {
    console.log('[Observer] Starting for node:', nodeId, 'selector:', selector, 'interval:', interval);

    // Stop existing observer for this node if any
    if (activeObservers.has(nodeId)) {
        const existing = activeObservers.get(nodeId);
        clearInterval(existing.timer);
        if (existing.view) {
            existing.view.webContents.destroy();
        }
        activeObservers.delete(nodeId);
    }

    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { error: 'No window found' };

    // Create hidden BrowserView for observation
    const { BrowserView } = require('electron');
    const observerView = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, 'observer-preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Don't attach to window (hidden)
    // Just use webContents to load and extract

    let lastValue = null;

    const extractValue = async () => {
        try {
            // Load URL
            await observerView.webContents.loadURL(url);

            // Wait for page load
            await new Promise(r => setTimeout(r, 2000));

            // Execute extraction script
            const result = await observerView.webContents.executeJavaScript(`
                (function() {
                    const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
                    if (!el) return { error: 'Element not found' };
                    
                    const tagName = el.tagName.toLowerCase();
                    let type = 'text';
                    let value = el.textContent?.trim() || '';
                    
                    if (tagName === 'img') {
                        type = 'image';
                        value = el.src;
                    } else if (tagName === 'svg') {
                        type = 'svg';
                        value = el.outerHTML;
                    }
                    
                    return { type, value, tagName };
                })();
            `);

            console.log('[Observer] Extracted:', result);

            if (result && !result.error) {
                // Check for change
                const valueStr = JSON.stringify(result);
                if (valueStr !== lastValue) {
                    lastValue = valueStr;
                    // Send to renderer
                    event.sender.send('observer-update', { nodeId, data: result });
                    console.log('[Observer] Value changed, sent update');
                }
            }
        } catch (err) {
            console.error('[Observer] Extraction error:', err.message);
        }
    };

    // Initial extraction
    await extractValue();

    // Set up polling
    const timer = setInterval(extractValue, interval);

    activeObservers.set(nodeId, { view: observerView, timer, selector, url, interval });

    return { success: true };
});

ipcMain.handle('stop-observe', async (event, { nodeId }) => {
    console.log('[Observer] Stopping for node:', nodeId);

    if (activeObservers.has(nodeId)) {
        const observer = activeObservers.get(nodeId);
        clearInterval(observer.timer);
        if (observer.view) {
            observer.view.webContents.destroy();
        }
        activeObservers.delete(nodeId);
        return { success: true };
    }

    return { success: false, error: 'No active observer' };
});

// Clean up observers on window close
app.on('window-all-closed', () => {
    for (const [nodeId, observer] of activeObservers) {
        clearInterval(observer.timer);
        if (observer.view) {
            observer.view.webContents.destroy();
        }
    }
    activeObservers.clear();

    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// ==========================================
// P2P SIGNALING SERVER (Local Discovery)
// ==========================================
try {
    require('./js/p2p-signaling-server.js');
} catch (err) {
    log('ERROR', 'Failed to start P2P Signaling Server:', err);
}

// ==========================================
// AUTO-UPDATER LOGIC
// ==========================================
const { autoUpdater } = require('electron-updater');

// Configure Logger
autoUpdater.logger = {
    info: (msg) => log('INFO', `[Updater] ${msg}`),
    warn: (msg) => log('WARN', `[Updater] ${msg}`),
    error: (msg) => log('ERROR', `[Updater] ${msg}`),
    debug: (msg) => log('DEBUG', `[Updater] ${msg}`)
};

// Use GitHub Releases
autoUpdater.autoDownload = false; // Let user decide when to download
autoUpdater.autoInstallOnAppQuit = true;

// Event Listeners
autoUpdater.on('checking-for-update', () => {
    log('INFO', '[Updater] Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
    log('INFO', `[Updater] Update available: v${info.version}`);
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-available', info);
    });
});

autoUpdater.on('update-not-available', (info) => {
    log('INFO', '[Updater] Update not available.');
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-not-available', info);
    });
});

autoUpdater.on('error', (err) => {
    log('ERROR', '[Updater] Error:', err);
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-error', err.message);
    });
});

autoUpdater.on('download-progress', (progressObj) => {
    // log('DEBUG', `[Updater] Progress: ${progressObj.percent}%`);
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('download-progress', progressObj);
    });
});

autoUpdater.on('update-downloaded', (info) => {
    log('INFO', '[Updater] Update downloaded. Ready to install.');
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-downloaded', info);
    });
});

// IPC Handlers
ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) {
        log('WARN', '[Updater] Skipping update check (dev mode)');
        return { error: 'Dev mode: Updates disabled' };
    }
    return autoUpdater.checkForUpdates();
});

ipcMain.handle('update:download', async () => {
    return autoUpdater.downloadUpdate();
});

ipcMain.handle('update:install', async () => {
    autoUpdater.quitAndInstall();
});
