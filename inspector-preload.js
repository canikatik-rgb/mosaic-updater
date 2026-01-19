/**
 * Inspector Preload Script
 * Runs inside the BrowserView for element inspection
 */
const { ipcRenderer } = require('electron');

let inspectMode = true;
let hoveredElement = null;

// Highlight styles
const HIGHLIGHT_STYLE = 'outline: 2px solid #007bff !important; outline-offset: -2px !important; background-color: rgba(0, 123, 255, 0.1) !important;';
const SELECT_STYLE = 'outline: 3px solid #28a745 !important; outline-offset: -3px !important; background-color: rgba(40, 167, 69, 0.15) !important;';

// Store original styles
const originalStyles = new WeakMap();

function saveOriginalStyle(el) {
    if (!originalStyles.has(el)) {
        originalStyles.set(el, el.getAttribute('style') || '');
    }
}

function restoreOriginalStyle(el) {
    if (originalStyles.has(el)) {
        const orig = originalStyles.get(el);
        if (orig) {
            el.setAttribute('style', orig);
        } else {
            el.removeAttribute('style');
        }
    }
}

function highlightElement(el) {
    saveOriginalStyle(el);
    el.style.cssText = (originalStyles.get(el) || '') + HIGHLIGHT_STYLE;
}

// Generate CSS selector
function getSelector(el) {
    if (!el || el === document.body) return 'body';

    const path = [];
    while (el && el !== document.body && el !== document.documentElement) {
        let selector = el.tagName.toLowerCase();

        if (el.id) {
            path.unshift('#' + el.id);
            break;
        }

        if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('hover')).slice(0, 2);
            if (classes.length > 0) {
                selector += '.' + classes.join('.');
            }
        }

        path.unshift(selector);
        el = el.parentElement;
    }

    return path.join(' > ');
}

// Extract element content based on type
function extractContent(el) {
    const tagName = el.tagName.toLowerCase();
    const result = {
        selector: getSelector(el),
        tagName: tagName
    };

    // Image
    if (tagName === 'img') {
        result.type = 'image';
        result.value = el.src;

        // Try to get data URL for small images
        try {
            const canvas = document.createElement('canvas');
            canvas.width = el.naturalWidth || el.width;
            canvas.height = el.naturalHeight || el.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(el, 0, 0);
            result.dataUrl = canvas.toDataURL('image/png');
        } catch (e) {
            // Cross-origin image, use src
        }
    }
    // SVG
    else if (tagName === 'svg' || el.closest('svg')) {
        const svgEl = tagName === 'svg' ? el : el.closest('svg');
        result.type = 'svg';
        result.value = svgEl.outerHTML;
    }
    // Link
    else if (tagName === 'a') {
        result.type = 'url';
        result.value = el.href;
        result.text = el.innerText?.trim();
    }
    // Text content
    else if (el.innerText?.trim()) {
        result.type = 'text';
        result.value = el.innerText.trim();
        result.html = el.innerHTML;
    }
    // HTML fallback
    else {
        result.type = 'html';
        result.value = el.outerHTML;
    }

    // Always capture dimensions
    const rect = el.getBoundingClientRect();
    result.width = Math.round(rect.width);
    result.height = Math.round(rect.height);

    return result;
}

// Mouse handlers
document.addEventListener('mouseover', (e) => {
    if (!inspectMode) return;
    e.stopPropagation();

    // Clear previous hover
    if (hoveredElement && hoveredElement !== e.target) {
        restoreOriginalStyle(hoveredElement);
    }

    hoveredElement = e.target;
    highlightElement(hoveredElement);

    // Send hover info
    const data = extractContent(hoveredElement);
    ipcRenderer.send('inspector-hover', data);
}, true);

document.addEventListener('click', (e) => {
    if (!inspectMode) return;

    e.preventDefault();
    e.stopPropagation();

    const data = extractContent(e.target);

    // Send selection and close
    ipcRenderer.send('inspector-select', data);
}, true);

// Prevent navigation
document.addEventListener('auxclick', (e) => e.preventDefault(), true);

// Add crosshair cursor
document.body.style.cursor = 'crosshair';

// Add visual indicator with navigation
const indicator = document.createElement('div');
indicator.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; padding: 8px 12px; font-family: -apple-system, sans-serif; font-size: 13px; z-index: 999999;
                display: flex; align-items: center; gap: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
        <span style="white-space: nowrap;">🎯 Navigate & click to select</span>
        <input type="text" id="inspector-url" value="${window.location.href}" 
               style="flex: 1; padding: 4px 8px; border: none; border-radius: 4px; font-size: 12px; background: rgba(255,255,255,0.9); color: #333;">
        <button id="inspector-go" style="background: rgba(255,255,255,0.3); border: none; color: white; 
                                         padding: 4px 10px; border-radius: 4px; cursor: pointer;">Go</button>
        <button id="close-inspector" style="background: rgba(255,255,255,0.2); border: none; color: white; 
                                            padding: 4px 12px; border-radius: 4px; cursor: pointer;">
            ✕ Cancel
        </button>
    </div>
`;
document.body.appendChild(indicator);

// Navigation within inspector
document.getElementById('inspector-go').addEventListener('click', () => {
    const url = document.getElementById('inspector-url').value;
    if (url) window.location.href = url;
});

document.getElementById('inspector-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const url = document.getElementById('inspector-url').value;
        if (url) window.location.href = url;
    }
});

document.getElementById('close-inspector').addEventListener('click', () => {
    ipcRenderer.send('inspector-cancel');
});

// Notify ready
ipcRenderer.send('inspector-ready');
