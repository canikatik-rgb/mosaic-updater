
        // Export init function for Shadow DOM Loader
        window.initUrlNode = function (scope, mosaicInstance) {
            console.log('[UrlNode] initUrlNode called with scope:', scope);

            // Scope is the ShadowRoot
            // MosaicInstance is the scoped MosaicNode instance

            const document = scope; // Shadow DOM root acting as document
            const window = { Mosaic: mosaicInstance }; // Local window shim

            const urlInput = document.getElementById('url-input');
            const webview = document.getElementById('web-frame');
            const goBtn = document.getElementById('go-btn');

            console.log('[UrlNode] Elements found:', {
                urlInput: !!urlInput,
                webview: !!webview,
                goBtn: !!goBtn
            });

            const backBtn = document.getElementById('back-btn');
            const forwardBtn = document.getElementById('forward-btn');
            const reloadBtn = document.getElementById('reload-btn');

            const inspectBtn = document.getElementById('inspect-btn');
            const cropBtn = document.getElementById('crop-btn'); // NEW

            const watchBtn = document.getElementById('watch-btn');
            const intervalSelect = document.getElementById('interval-select');
            const emptyState = document.getElementById('empty-state');
            const statusText = document.getElementById('status-text');

            let currentUrl = '';
            let selectedSelector = null;
            let isWatching = false;
            let isFirstLoad = true;
            let isModeActive = false;

            // ========== Helper: Update UI State ==========
            function updateNavButtons() {
                if (webview.canGoBack()) {
                    backBtn.disabled = false;
                } else {
                    backBtn.disabled = true;
                }

                if (webview.canGoForward()) {
                    forwardBtn.disabled = false;
                } else {
                    forwardBtn.disabled = true;
                }
            }

            // ========== Helper: Load URL Safe ==========
            function loadUrl(url) {
                if (!url) return;

                // Ensure protocol
                if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
                    url = 'https://' + url;
                }

                // Don't reload if same URL (unless it's about:blank or we want to force)
                if (currentUrl === url && webview.getURL() === url) return;

                currentUrl = url;
                urlInput.value = url;

                // Set source
                webview.src = url;

                emptyState.style.display = 'none';
                statusText.textContent = 'Loading...';
            }

            // ========== Webview Events (The Magic) ==========

            // 1. Start Loading
            webview.addEventListener('did-start-loading', () => {
                statusText.textContent = 'Loading...';
                reloadBtn.querySelector('i').classList.add('fa-spin');
            });

            // 2. Stop Loading
            webview.addEventListener('did-stop-loading', () => {
                statusText.textContent = 'Ready';
                reloadBtn.querySelector('i').classList.remove('fa-spin');
                updateNavButtons();

                // Update URL input to match actual loaded URL
                const actualUrl = webview.getURL();
                if (actualUrl && !actualUrl.startsWith('about:') && !actualUrl.startsWith('data:')) {
                    currentUrl = actualUrl;
                    urlInput.value = currentUrl;

                    // Persist State immediately
                    window.Mosaic.saveData({ content: currentUrl });
                }
            });

            // 3. Navigation (History Update)
            webview.addEventListener('did-navigate', (e) => {
                console.log('[Webview] Did navigate:', e.url);
                updateNavButtons();

                // Update UI & State
                if (e.url && !e.url.startsWith('about:')) {
                    currentUrl = e.url;
                    urlInput.value = currentUrl;
                    window.Mosaic.saveData({ content: currentUrl });
                }
            });

            // 4. In-Page Navigation (SPA support)
            webview.addEventListener('did-navigate-in-page', (e) => {
                console.log('[Webview] In-page nav:', e.url);
                updateNavButtons();

                if (e.url && !e.url.startsWith('about:')) {
                    currentUrl = e.url;
                    urlInput.value = currentUrl;
                    window.Mosaic.saveData({ content: currentUrl });
                }
            });

            // 5. Popup Handling (Auth Windows)
            webview.addEventListener('new-window', (e) => {
                console.log('[Webview] Requesting new window:', e.url);
                // Protocol handler helps here. 
                // In standard Electron webview with allowpopups, this often opens a new window automatically.
                // We can intercept if needed, but default behavior is usually fine for Google Auth.
            });

            // 6. DOM Ready (Inject custom CSS/JS if needed)
            webview.addEventListener('dom-ready', () => {
                // Optional: Inject dark mode or custom styles
                // webview.insertCSS('body { overflow-x: hidden; }');
            });

            // ========== Toolbar Actions ==========

            goBtn.addEventListener('click', () => {
                console.log('[UrlNode] Go Button Clicked');
                loadUrl(urlInput.value);
            });

            urlInput.addEventListener('keydown', (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    console.log('[UrlNode] Enter Key Pressed');
                    loadUrl(urlInput.value);
                }
            });
            urlInput.addEventListener('keyup', (e) => e.stopPropagation());
            urlInput.addEventListener('keypress', (e) => e.stopPropagation());
            urlInput.addEventListener('paste', (e) => e.stopPropagation());

            reloadBtn.addEventListener('click', () => {
                console.log('[UrlNode] Reload clicked');
                if (webview.isLoading()) {
                    webview.stop();
                } else {
                    webview.reload();
                }
            });

            backBtn.addEventListener('click', () => {
                if (webview.canGoBack()) webview.goBack();
            });

            forwardBtn.addEventListener('click', () => {
                if (webview.canGoForward()) webview.goForward();
            });

            // ========== INSPECTION & REGION LOGIC (Unified) ==========

            // Communication Bridge
            webview.addEventListener('console-message', (event) => {
                const msg = event.message;
                if (!msg) return;

                if (msg.startsWith('MOSAIC_INSPECTOR:SELECTED:')) {
                    const selector = msg.replace('MOSAIC_INSPECTOR:SELECTED:', '');
                    handleSelection(selector);
                } else if (msg === 'MOSAIC_INSPECTOR:CANCELLED') {
                    resetMode();
                }
            });

            // 1. Element Inspector (Hover & Click)
            inspectBtn.addEventListener('click', () => {
                if (isModeActive) resetMode();
                else startInspection();
            });

            function startInspection() {
                if (!checkUrl()) return;
                isModeActive = true;
                inspectBtn.classList.add('active');
                inspectBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
                statusText.textContent = 'Hover and click to select an element...';

                injectScript(`window._mosaicInspectorMode = 'element';`);
            }

            // 2. Region Selector (Drag & Drop)
            // Added safe check in case button wasn't found (though it should be)
            if (cropBtn) {
                cropBtn.addEventListener('click', () => {
                    if (isModeActive) resetMode();
                    else startRegionSelection();
                });
            }

            function startRegionSelection() {
                if (!checkUrl()) return;
                isModeActive = true;
                cropBtn.classList.add('active');
                cropBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
                statusText.textContent = 'Drag to define a frame...';

                injectScript(`window._mosaicInspectorMode = 'region';`);
            }

            function checkUrl() {
                const url = webview.getURL();
                if (!url || url === 'about:blank') {
                    statusText.textContent = 'Load a URL first';
                    return false;
                }
                return true;
            }

            function resetMode() {
                isModeActive = false;
                inspectBtn.classList.remove('active');
                if (cropBtn) cropBtn.classList.remove('active');

                inspectBtn.innerHTML = '<i class="fas fa-mouse-pointer"></i> Select';
                if (cropBtn) cropBtn.innerHTML = '<i class="fas fa-crop-alt"></i> Region';

                statusText.textContent = 'Ready';

                webview.executeJavaScript(`
                    if (window._mosaicCleanup) { window._mosaicCleanup(); window._mosaicCleanup = null; }
                `);
            }

            function injectScript(preamble) {
                webview.executeJavaScript(`
                    (function() {
                        if (window._mosaicActive) return;
                        window._mosaicActive = true;
                        ${preamble}

                        // Styles
                        const style = document.createElement('style');
                        style.id = 'mosaic-styles';
                        const css = '.mosaic-highlight { outline: 2px solid #ff4757 !important; background: rgba(255, 71, 87, 0.1) !important; cursor: crosshair !important; z-index: 999999; } ' +
                                    '.mosaic-region-box { position: fixed; border: 2px dashed #007bff; background: rgba(0, 123, 255, 0.1); z-index: 999999; pointer-events: none; } ' +
                                    'body { user-select: none !important; }';
                        style.textContent = css;
                        document.head.appendChild(style);

                        // Utils
                        function getCssPath(el) {
                            if (!(el instanceof Element)) return;
                            const path = [];
                            while (el.nodeType === Node.ELEMENT_NODE) {
                                let selector = el.nodeName.toLowerCase();
                                if (el.id) { selector += '#' + el.id; path.unshift(selector); break; }
                                else {
                                    let sib = el, nth = 1;
                                    while (sib = sib.previousElementSibling) { if (sib.nodeName.toLowerCase() == selector) nth++; }
                                    if (nth != 1) selector += ":nth-of-type(" + nth + ")";
                                }
                                path.unshift(selector);
                                el = el.parentNode;
                            }
                            return path.join(" > ");
                        }

                        // Mode: Element
                        let lastEl = null;
                        function elementHover(e) {
                            e.stopPropagation();
                            if (lastEl) lastEl.classList.remove('mosaic-highlight');
                            lastEl = e.target;
                            lastEl.classList.add('mosaic-highlight');
                        }
                        function elementClick(e) {
                            e.preventDefault(); e.stopPropagation();
                            if (lastEl) {
                                const sel = getCssPath(lastEl);
                                cleanup();
                                console.log('MOSAIC_INSPECTOR:SELECTED:' + sel);
                            }
                        }

                        // Mode: Region
                        let startX, startY, isDragging = false, box = null;
                        function regionDown(e) {
                            e.preventDefault(); e.stopPropagation();
                            isDragging = true;
                            startX = e.clientX; startY = e.clientY;
                            box = document.createElement('div');
                            box.className = 'mosaic-region-box';
                            box.style.left = startX + 'px'; box.style.top = startY + 'px';
                            document.body.appendChild(box);
                        }
                        function regionMove(e) {
                            if (!isDragging || !box) return;
                            const w = e.clientX - startX;
                            const h = e.clientY - startY;
                            box.style.width = Math.abs(w) + 'px';
                            box.style.height = Math.abs(h) + 'px';
                            box.style.left = (w < 0 ? e.clientX : startX) + 'px';
                            box.style.top = (h < 0 ? e.clientY : startY) + 'px';
                        }
                        function regionUp(e) {
                            if (!isDragging) return;
                            isDragging = false;
                            
                            // Find element at center of box
                            const rect = box.getBoundingClientRect();
                            box.remove();
                            
                            // If box is tiny, treat as click
                            if (rect.width < 5 && rect.height < 5) {
                                const el = document.elementFromPoint(e.clientX, e.clientY);
                                if (el) {
                                    const sel = getCssPath(el);
                                    cleanup();
                                    console.log('MOSAIC_INSPECTOR:SELECTED:' + sel);
                                }
                                return;
                            }

                            const cx = rect.left + rect.width / 2;
                            const cy = rect.top + rect.height / 2;
                            
                            // Identify container
                            let el = document.elementFromPoint(cx, cy);
                            if (el) {
                                const sel = getCssPath(el);
                                cleanup();
                                console.log('MOSAIC_INSPECTOR:SELECTED:' + sel);
                            }
                        }

                        function onKeyDown(e) {
                            if (e.key === 'Escape') { cleanup(); console.log('MOSAIC_INSPECTOR:CANCELLED'); }
                        }

                        function cleanup() {
                            if (window._mosaicInspectorMode === 'element') {
                                if (lastEl) lastEl.classList.remove('mosaic-highlight');
                                document.removeEventListener('mouseover', elementHover, true);
                                document.removeEventListener('click', elementClick, true);
                            } else {
                                document.removeEventListener('mousedown', regionDown, true);
                                document.removeEventListener('mousemove', regionMove, true);
                                document.removeEventListener('mouseup', regionUp, true);
                                if (box) box.remove();
                            }
                            document.removeEventListener('keydown', onKeyDown, true);
                            
                            const s = document.getElementById('mosaic-styles');
                            if (s) s.remove();
                            window._mosaicActive = false;
                        }

                        // Init
                        if (window._mosaicInspectorMode === 'element') {
                            document.addEventListener('mouseover', elementHover, true);
                            document.addEventListener('click', elementClick, true);
                        } else {
                            document.addEventListener('mousedown', regionDown, true);
                            document.addEventListener('mousemove', regionMove, true);
                            document.addEventListener('mouseup', regionUp, true);
                        }
                        document.addEventListener('keydown', onKeyDown, true);

                        window._mosaicCleanup = cleanup;
                    })();
                `);
            }

            function handleSelection(selector) {
                resetMode();
                selectedSelector = selector;
                statusText.textContent = `Selected: ${selector}`;
                window.Mosaic.saveData({ content: webview.getURL(), selector: selectedSelector });

                // Smart Extraction: Native Types or Full HTML
                webview.executeJavaScript(`
                    (function() {
                        const el = document.querySelector('${selector}');
                        if (!el) return null;

                        const tag = el.tagName.toLowerCase();
                        let type = 'html'; // Default to HTML frame
                        let value = el.outerHTML; // Default value
                        let width = el.offsetWidth;
                        let height = el.offsetHeight;

                        // 1. Image
                        if (tag === 'img') {
                            type = 'image';
                            value = el.src;
                        } 
                        // 2. SVG
                        else if (tag === 'svg') {
                            type = 'svg';
                            value = el.outerHTML;
                        } 
                        else if (tag === 'path' || tag === 'g' || tag === 'circle' || tag === 'rect') {
                             const parentSvg = el.closest('svg');
                             if (parentSvg) {
                                 type = 'svg';
                                 value = parentSvg.outerHTML;
                                 width = parentSvg.getBoundingClientRect().width;
                                 height = parentSvg.getBoundingClientRect().height;
                             }
                        }
                        // 3. Link
                        else if (tag === 'a') {
                            type = 'url'; 
                            value = el.href;
                        }

                        return { type, value, width, height };
                    })()
                `).then(data => {
                    if (data) {
                        console.log('[UrlNode] Extracted:', data);
                        window.Mosaic.send({
                            type: data.type,
                            value: data.value,
                            width: data.width,
                            height: data.height,
                            selector: selector
                        });
                    }
                });
            }

            function updateWatchButton() {
                if (isWatching) {
                    watchBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Stop';
                    watchBtn.style.background = '#e74c3c';
                } else {
                    watchBtn.innerHTML = '<i class="fas fa-eye"></i> Watch';
                    watchBtn.style.background = '';
                }
            }

            // ========== Watch Logic ==========
            watchBtn.addEventListener('click', async () => {
                if (!selectedSelector) {
                    statusText.textContent = 'Select an element first!';
                    return;
                }

                // Toggle
                if (isWatching) {
                    // Stop
                    try {
                        await globalThis.electronAPI.stopObserve({ nodeId: mosaicInstance.getNodeId() });
                        isWatching = false;
                        statusText.textContent = 'Stopped watching';
                    } catch (e) { }
                } else {
                    // Start
                    try {
                        const result = await globalThis.electronAPI.startObserve({
                            nodeId: mosaicInstance.getNodeId(),
                            url: webview.getURL(),
                            selector: selectedSelector,
                            interval: parseInt(intervalSelect.value)
                        });

                        if (result.success) {
                            isWatching = true;
                            statusText.textContent = 'Watching...';
                        }
                    } catch (e) {
                        statusText.textContent = 'Watch error: ' + e.message;
                    }
                }
                updateWatchButton();
            });

            // ========== Mosaic Lifecycle ==========
            window.Mosaic.onDataLoaded = (data) => {
                // Restore URL
                if (data.content && data.content !== 'about:blank') {
                    console.log('[Mosaic] Restoring URL:', data.content);
                    loadUrl(data.content);
                }

                // Restore Selector
                if (data.selector) {
                    selectedSelector = data.selector;
                }
            };

            // Listen for Observer Updates from Main Process
            if (globalThis.electronAPI && globalThis.electronAPI.onObserverUpdate) {
                globalThis.electronAPI.onObserverUpdate(({ nodeId, data }) => {
                    if (nodeId === mosaicInstance.getNodeId()) {
                        statusText.textContent = `Update: ${data.value.substring(0, 20)}...`;
                        window.Mosaic.send({
                            type: data.type,
                            value: data.value,
                            selector: selectedSelector
                        });
                    }
                });
            }

            return {
                loadData: window.Mosaic.onDataLoaded
            };
        };
    