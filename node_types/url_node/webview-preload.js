/**
 * Webview Preload Script for URL Node Element Inspector
 * This script runs inside the webview and handles element inspection
 */

// ========== BROWSER FINGERPRINT SPOOFING ==========
// Make webview appear as a real Chrome browser to bypass security checks
// from Google, Figma, Adobe, and other services

(function () {
    'use strict';

    // 1. Remove webdriver flag (indicates automation/Electron)
    try {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
            configurable: true
        });
    } catch (e) { }

    // 2. Spoof plugins array (Chrome has plugins, Electron might not)
    try {
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                const fakePlugins = [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
                ];
                fakePlugins.length = 3;
                fakePlugins.item = (i) => fakePlugins[i];
                fakePlugins.namedItem = (name) => fakePlugins.find(p => p.name === name);
                fakePlugins.refresh = () => { };
                return fakePlugins;
            },
            configurable: true
        });
    } catch (e) { }

    // 3. Spoof languages (consistent with User-Agent)
    try {
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
            configurable: true
        });
    } catch (e) { }

    // 4. Spoof platform (match User-Agent)
    try {
        Object.defineProperty(navigator, 'platform', {
            get: () => 'MacIntel',
            configurable: true
        });
    } catch (e) { }

    // 5. Add Chrome-specific properties
    if (!window.chrome) {
        window.chrome = {
            app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
            runtime: {
                OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
                OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
                PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
                PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
                PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
                RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
                id: undefined,
                connect: () => { },
                sendMessage: () => { }
            },
            csi: () => { },
            loadTimes: () => ({
                requestTime: Date.now() / 1000 - Math.random() * 10,
                startLoadTime: Date.now() / 1000 - Math.random() * 5,
                commitLoadTime: Date.now() / 1000 - Math.random() * 2,
                finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
                finishLoadTime: Date.now() / 1000,
                firstPaintTime: Date.now() / 1000 - Math.random() * 3,
                firstPaintAfterLoadTime: 0,
                navigationType: 'Other'
            })
        };
    }

    // 6. Spoof permissions API to avoid "blocked" status
    if (navigator.permissions) {
        const originalQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (parameters) => {
            // For notifications, return 'prompt' instead of 'denied'
            if (parameters.name === 'notifications') {
                return Promise.resolve({ state: 'prompt', onchange: null });
            }
            return originalQuery(parameters);
        };
    }

    // 7. Hide Electron-specific objects
    try {
        delete window.process;
        delete window.require;
        delete window.module;
        delete window.exports;
    } catch (e) { }

    console.log('[Mosaic] Browser fingerprint spoofing applied');
})();

const { ipcRenderer } = require('electron');

let currentMode = 'none'; // 'none', 'element', 'region'
let hoveredElement = null;
let selectedElement = null;

// Region Selection Variables
let regionStartX, regionStartY;
let isRegionDragging = false;
let regionBox = null;

// Styles
const highlightStyle = `
    outline: 2px solid #ff4757 !important;
    outline-offset: -2px !important;
    background-color: rgba(255, 71, 87, 0.1) !important;
    cursor: crosshair !important; 
    z-index: 999999;
`;

const selectedStyle = `
    outline: 3px solid #007bff !important;
    outline-offset: -3px !important;
    background-color: rgba(0, 123, 255, 0.15) !important;
`;

const regionBoxStyle = `
    position: fixed; 
        border: 2px dashed #007bff; 
    background: rgba(0, 123, 255, 0.1); 
    z-index: 2147483647; 
    pointer-events: none;
`;

// Helper: Get Clean CSS Selector
function getSelector(el) {
    if (!el || el === document.body) return 'body';

    const path = [];
    while (el && el !== document.body) {
        let selector = el.tagName.toLowerCase();

        if (el.id) {
            selector += '#' + el.id;
            path.unshift(selector);
            break;
        } else if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\s+/).filter(c => c && !c.includes('mosaic')).slice(0, 2);
            if (classes.length > 0) {
                selector += '.' + classes.join('.');
            }
        }

        // Add nth-of-type if needed for uniqueness
        const parent = el.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(s => s.tagName === el.tagName);
            if (siblings.length > 1) {
                const index = siblings.indexOf(el) + 1;
                selector += `:nth-of-type(${index})`;
            }
        }

        path.unshift(selector);
        el = el.parentElement;
    }
    return path.join(' > ');
}

// Helper: Extract Data
function getElementData(el) {
    if (!el) return null;

    const tagName = el.tagName.toLowerCase();
    const rect = el.getBoundingClientRect();

    // Default Data
    const data = {
        selector: getSelector(el),
        tagName: tagName,
        width: rect.width,
        height: rect.height,
        text: el.innerText?.trim().substring(0, 1000) || '',
        html: el.outerHTML?.substring(0, 5000) || '',
        type: 'html',
        value: el.outerHTML
    };

    // Specific Types
    if (tagName === 'img') {
        data.type = 'image';
        data.value = el.src;
    }
    else if (tagName === 'svg') {
        data.type = 'svg';
        data.value = el.outerHTML;
    }
    else if (tagName === 'path' || tagName === 'g' || tagName === 'circle' || tagName === 'rect') {
        const parentSvg = el.closest('svg');
        if (parentSvg) {
            data.type = 'svg';
            data.value = parentSvg.outerHTML;
            // Update dimensions to parent SVG
            const svgRect = parentSvg.getBoundingClientRect();
            data.width = svgRect.width;
            data.height = svgRect.height;
            data.selector = getSelector(parentSvg);
        }
    }
    else if (tagName === 'a') {
        data.type = 'url';
        data.value = el.href;
    }
    else if (tagName === 'video' || tagName === 'audio') {
        data.type = 'media';
        data.value = el.src || el.querySelector('source')?.src;
    }

    return data;
}

// ========== HIGHLIGHTING LOGIC ==========

function clearHighlights() {
    document.querySelectorAll('[data-mosaic-highlight]').forEach(el => {
        el.style.cssText = el.dataset.originalStyle || '';
        delete el.dataset.mosaicHighlight;
        delete el.dataset.originalStyle;
    });
}

function highlightElement(el) {
    if (!el || el === document.body || el === document.documentElement) return;

    if (!el.dataset.originalStyle) {
        el.dataset.originalStyle = el.style.cssText;
    }
    el.dataset.mosaicHighlight = 'hover';
    el.style.cssText = el.dataset.originalStyle + highlightStyle;
}

// ========== EVENT HANDLERS: ELEMENT MODE ==========

function handleElementOver(e) {
    if (currentMode !== 'element') return;
    e.stopPropagation();

    const target = e.target;
    if (hoveredElement && hoveredElement !== target) {
        // Restore previous
        if (hoveredElement.dataset.mosaicHighlight) {
            hoveredElement.style.cssText = hoveredElement.dataset.originalStyle || '';
            delete hoveredElement.dataset.mosaicHighlight;
        }
    }

    hoveredElement = target;
    highlightElement(hoveredElement);
}

function handleElementClick(e) {
    if (currentMode !== 'element') return;
    e.preventDefault();
    e.stopPropagation();

    if (hoveredElement) {
        const data = getElementData(hoveredElement);
        console.log('[Mosaic] Element Selected:', data);
        ipcRenderer.sendToHost('element-selected', data);
        resetMode();
    }
}

// ========== EVENT HANDLERS: REGION MODE ==========

function handleRegionDown(e) {
    if (currentMode !== 'region') return;
    e.preventDefault();
    e.stopPropagation();

    isRegionDragging = true;
    regionStartX = e.clientX;
    regionStartY = e.clientY;

    if (!regionBox) {
        regionBox = document.createElement('div');
        regionBox.style.cssText = regionBoxStyle;
        document.body.appendChild(regionBox);
    }

    // Reset box
    regionBox.style.width = '0px';
    regionBox.style.height = '0px';
    regionBox.style.left = regionStartX + 'px';
    regionBox.style.top = regionStartY + 'px';
}

function handleRegionMove(e) {
    if (!isRegionDragging || !regionBox) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - regionStartX);
    const height = Math.abs(currentY - regionStartY);
    const left = currentX < regionStartX ? currentX : regionStartX;
    const top = currentY < regionStartY ? currentY : regionStartY;

    regionBox.style.width = width + 'px';
    regionBox.style.height = height + 'px';
    regionBox.style.left = left + 'px';
    regionBox.style.top = top + 'px';
}

function handleRegionUp(e) {
    if (!isRegionDragging) return;
    isRegionDragging = false;

    if (regionBox) {
        const rect = regionBox.getBoundingClientRect();
        regionBox.remove();
        regionBox = null;

        // If very small click, treat as single point click
        if (rect.width < 5 && rect.height < 5) {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el) {
                const data = getElementData(el);
                if (data) ipcRenderer.sendToHost('region-selected', data);
            }
        } else {
            // Find center
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;

            // Get element at center
            // Hide box temporarily if it wasn't removed (though we removed it above)
            const el = document.elementFromPoint(cx, cy);

            if (el) {
                const data = getElementData(el);
                if (data) ipcRenderer.sendToHost('region-selected', data);
            }
        }
        resetMode();
    }
}

// ========== CONTROL LOGIC ==========

function resetMode() {
    currentMode = 'none';
    clearHighlights();
    document.body.style.cursor = 'default';
    if (regionBox) { regionBox.remove(); regionBox = null; }
    ipcRenderer.sendToHost('inspection-cancelled');
}

// IPC Listener
ipcRenderer.on('set-inspect-mode', (event, mode) => {
    // 'element' or 'region' or 'none'
    currentMode = mode;

    if (mode === 'none') {
        resetMode();
    } else {
        document.body.style.cursor = 'crosshair';
    }
});

ipcRenderer.on('get-element-content', (event, selector) => {
    try {
        const el = document.querySelector(selector);
        if (el) {
            const data = getElementData(el);
            ipcRenderer.sendToHost('element-content', data);
        }
    } catch (err) {
        console.error('Error getting element:', err);
    }
});

// ========== OBSERVER LOGIC ==========
let mutationObserver = null;
let observedElement = null;
let debounceTimer = null;

ipcRenderer.on('start-observe', (event, selector) => {
    try {
        if (mutationObserver) {
            mutationObserver.disconnect();
            mutationObserver = null;
        }

        observedElement = document.querySelector(selector);
        if (!observedElement) {
            console.error('[Mosaic] Observer: Element not found for selector:', selector);
            return;
        }

        console.log('[Mosaic] Starting observer on:', selector);

        mutationObserver = new MutationObserver((mutations) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const data = getElementData(observedElement);
                console.log('[Mosaic] Observation Update:', data);
                ipcRenderer.sendToHost('element-update', data);
            }, 500); // 500ms debounce
        });

        mutationObserver.observe(observedElement, {
            characterData: true,
            childList: true,
            subtree: true,
            attributes: true
        });

    } catch (err) {
        console.error('[Mosaic] Failed to start observer:', err);
    }
});

ipcRenderer.on('stop-observe', () => {
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
        console.log('[Mosaic] Observer stopped');
    }
    if (debounceTimer) clearTimeout(debounceTimer);
});

// Init Listeners
document.addEventListener('mouseover', handleElementOver, true);
document.addEventListener('click', handleElementClick, true);

document.addEventListener('mousedown', handleRegionDown, true);
document.addEventListener('mousemove', handleRegionMove, true);
document.addEventListener('mouseup', handleRegionUp, true);

// Prevent default links in inspect mode
document.addEventListener('click', (e) => {
    if (currentMode !== 'none') {
        e.preventDefault();
        e.stopPropagation();
    }
}, false);

// Key Handling (Escape to cancel)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentMode !== 'none') {
        resetMode();
    }
}, true);

// ========== CONTEXT MENU FOR OUTGOING PANEL ==========
document.addEventListener('contextmenu', (e) => {
    console.log('[Mosaic Preload] Context menu triggered on:', e.target.tagName, e.target);

    // Don't interfere if in inspect mode
    if (currentMode !== 'none') return;

    const target = e.target;
    let contextData = null;

    // Helper function to convert image to dataURL via canvas
    async function imageToDataURL(img) {
        return new Promise((resolve, reject) => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width || 200;
                canvas.height = img.naturalHeight || img.height || 200;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);
            } catch (err) {
                // CORS error - can't convert, fall back to URL
                console.warn('[Mosaic Preload] CORS prevented image conversion, using URL:', err.message);
                reject(err);
            }
        });
    }

    // Check what was right-clicked
    if (target.tagName === 'IMG') {
        // Image - try to convert to dataURL, fallback to src
        e.preventDefault(); // Prevent default immediately for images

        // Try to convert image to dataURL using canvas
        imageToDataURL(target)
            .then(dataUrl => {
                console.log('[Mosaic Preload] Image converted to dataURL');
                ipcRenderer.sendToHost('context-menu-request', {
                    x: e.clientX,
                    y: e.clientY,
                    data: {
                        type: 'image',
                        value: target.src,
                        dataUrl: dataUrl,
                        width: target.naturalWidth,
                        height: target.naturalHeight
                    },
                    pageUrl: window.location.href
                });
            })
            .catch(() => {
                // CORS blocked - send URL only
                console.log('[Mosaic Preload] Sending image URL (CORS blocked dataURL)');
                ipcRenderer.sendToHost('context-menu-request', {
                    x: e.clientX,
                    y: e.clientY,
                    data: {
                        type: 'image',
                        value: target.src,
                        width: target.naturalWidth,
                        height: target.naturalHeight
                    },
                    pageUrl: window.location.href
                });
            });
        return; // Exit early, we handle preventDefault above
    } else if (target.tagName === 'SVG' || target.closest('svg')) {
        // SVG element
        const svg = target.tagName === 'SVG' ? target : target.closest('svg');
        contextData = {
            type: 'svg',
            value: svg.outerHTML,
            width: svg.getBoundingClientRect().width,
            height: svg.getBoundingClientRect().height
        };
    } else if (target.tagName === 'A') {
        // Link
        contextData = {
            type: 'url',
            value: target.href,
            text: target.textContent.trim()
        };
    } else if (target.tagName === 'VIDEO' || target.tagName === 'AUDIO') {
        // Media
        contextData = {
            type: 'media',
            value: target.src || target.querySelector('source')?.src
        };
    } else {
        // Check if there's selected text
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
            contextData = {
                type: 'text',
                value: selection.toString().trim(),
                html: selection.rangeCount > 0 ?
                    (() => {
                        const container = document.createElement('div');
                        for (let i = 0; i < selection.rangeCount; i++) {
                            container.appendChild(selection.getRangeAt(i).cloneContents());
                        }
                        return container.innerHTML;
                    })() : null
            };
        }
    }

    // Send context data to host for menu display
    if (contextData) {
        ipcRenderer.sendToHost('context-menu-request', {
            x: e.clientX,
            y: e.clientY,
            data: contextData,
            pageUrl: window.location.href
        });

        // Prevent default context menu only if we have data
        e.preventDefault();
    }
}, true);

// Handle paste events to capture clipboard data
document.addEventListener('paste', (e) => {
    // Let normal paste happen
    // But also notify host about pasted content
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Check for images
    for (const item of clipboardData.items) {
        if (item.type.startsWith('image/')) {
            item.getAsFile().then ?
                item.getAsFile() :
                (() => {
                    const file = item.getAsFile();
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            ipcRenderer.sendToHost('paste-content', {
                                type: 'image',
                                dataUrl: event.target.result,
                                mimeType: item.type
                            });
                        };
                        reader.readAsDataURL(file);
                    }
                })();
            break;
        }
    }

    // Check for text/html
    const html = clipboardData.getData('text/html');
    const text = clipboardData.getData('text/plain');

    if (html || text) {
        ipcRenderer.sendToHost('paste-content', {
            type: html ? 'html' : 'text',
            value: html || text
        });
    }
}, true);

// ========== VISUAL DEBUG FOR PRELOAD ==========
window.addEventListener('DOMContentLoaded', () => {
    // Send immediate ping to confirm readiness
    ipcRenderer.sendToHost('preload-ready', { ping: true });
});

// ========== GESTURE HANDLING INSIDE WEBVIEW ==========
// These handlers detect gestures INSIDE the webview and send to host

// Debounce helper
let gestureTimeout = null;
let lastZoomTime = 0;
let lastSwipeTime = 0;

// Wheel event for zoom and swipe detection
document.addEventListener('wheel', (e) => {
    const now = Date.now();

    // 1. ZOOM: Ctrl+wheel (macOS pinch gesture) or Alt+wheel (manual zoom)
    if (e.ctrlKey || e.altKey) {
        // Throttle zoom events
        if (now - lastZoomTime < 50) return;
        lastZoomTime = now;

        e.preventDefault();

        const direction = e.deltaY < 0 ? 'in' : 'out';
        ipcRenderer.sendToHost('webview-zoom', {
            direction: direction,
            deltaY: e.deltaY,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey
        });
        return;
    }

    // 2. SWIPE: Horizontal scroll without modifiers (two-finger swipe)
    // On macOS, two-finger horizontal swipe = wheel event with deltaX >> deltaY
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 2 && Math.abs(e.deltaX) > 30) {
        // Throttle swipe events
        if (now - lastSwipeTime < 300) return;
        lastSwipeTime = now;

        const direction = e.deltaX < 0 ? 'back' : 'forward';
        ipcRenderer.sendToHost('webview-swipe', {
            direction: direction,
            deltaX: e.deltaX
        });
    }
}, { passive: false, capture: true });

// Keyboard shortcuts for zoom (inside webview)
document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + Plus/Minus/0 for zoom
    if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            ipcRenderer.sendToHost('webview-zoom', { direction: 'in', key: true });
        } else if (e.key === '-') {
            e.preventDefault();
            ipcRenderer.sendToHost('webview-zoom', { direction: 'out', key: true });
        } else if (e.key === '0') {
            e.preventDefault();
            ipcRenderer.sendToHost('webview-zoom', { direction: 'reset', key: true });
        }
        // Cmd+Left/Right for navigation
        else if (e.key === 'ArrowLeft' || e.key === '[') {
            e.preventDefault();
            ipcRenderer.sendToHost('webview-swipe', { direction: 'back', key: true });
        } else if (e.key === 'ArrowRight' || e.key === ']') {
            e.preventDefault();
            ipcRenderer.sendToHost('webview-swipe', { direction: 'forward', key: true });
        }
    }
}, true);

// Notify Host we are ready
ipcRenderer.sendToHost('preload-ready');

console.log('[Mosaic Preload] Gesture handlers registered');

