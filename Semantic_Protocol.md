/**
 * URLNodeInspector.js
 * Bu script, URL Node (WebView) içine enjekte edilir.
 * Kullanıcının seçtiği herhangi bir elementi "Mosaic Semantik Standardı"na çevirir.
 */

class MosaicInspector {
    constructor() {
        this.selectedElement = null;
        this.initOverlay();
    }

    // Seçim sırasında görsel geri bildirim için overlay
    initOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: absolute;
            pointer-events: none;
            border: 2px solid #0d99ff;
            background: rgba(13, 153, 255, 0.1);
            z-index: 100000;
            display: none;
        `;
        document.body.appendChild(this.overlay);

        document.addEventListener('mouseover', (e) => this.highlight(e));
        document.addEventListener('click', (e) => this.capture(e), true);
    }

    highlight(e) {
        const rect = e.target.getBoundingClientRect();
        this.overlay.style.top = `${rect.top + window.scrollY}px`;
        this.overlay.style.left = `${rect.left + window.scrollX}px`;
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.height = `${rect.height}px`;
        this.overlay.style.display = 'block';
    }

    async capture(e) {
        e.preventDefault();
        e.stopPropagation();

        const el = e.target;
        const semanticData = await this.serialize(el);

        // Electron IPC üzerinden ana sürece gönder
        // window.MosaicBridge ortamda tanımlı varsayılır (Preload script)
        if (window.MosaicBridge) {
            window.MosaicBridge.sendToCore('ELEMENT_CAPTURED', semanticData);
        }
    }

    async serialize(el) {
        // SEMANTİK TESPİT MANTIĞI
        let type = 'TEXT';
        if (el.tagName === 'SVG' || el.querySelector('svg')) type = 'VECTOR';
        if (el.tagName === 'IMG') type = 'BITMAP';
        if (el.tagName === 'TABLE' || el.closest('table')) type = 'TABLE';

        const styles = window.getComputedStyle(el);

        return {
            semanticType: type,
            origin: {
                app: document.title,
                url: window.location.href
            },
            payload: {
                html: el.outerHTML,
                // Tüm hesaplanmış stilleri paketle (Figma benzeri aktarım için kritik)
                css: {
                    color: styles.color,
                    backgroundColor: styles.backgroundColor,
                    fontSize: styles.fontSize,
                    borderRadius: styles.borderRadius,
                    transform: styles.transform
                },
                rect: el.getBoundingClientRect()
            }
        };
    }
}

// Inspector'ı başlat
new MosaicInspector();
