/**
 * Settings Manager
 * Handles application settings with dropdown UI
 */

class SettingsManager {
    constructor() {
        // Detect system language on first launch
        const savedLanguage = localStorage.getItem('mosaicLanguage');
        const systemLanguage = this.detectSystemLanguage();

        this.settings = {
            background: 'isometric', // isometric | square | grid | blank | custom
            customBackgroundUrl: null,
            backgroundScrollMode: 'fixed', // fixed | parallax
            nodeVolume: 100,
            voiceChatVolume: 100,
            theme: 'auto', // light | dark | auto
            language: savedLanguage || systemLanguage,
            autoSave: '5min' // off | immediate | 2min | 5min | 10min
        };
        this.dropdown = null;
        this.isOpen = false;
        this.autoSaveTimer = null;

        this.init();
    }

    detectSystemLanguage() {
        // Get browser/system language
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        const langCode = browserLang.split('-')[0].toLowerCase();

        // Supported languages
        const supportedLanguages = ['en', 'es', 'fr', 'de', 'tr'];

        if (supportedLanguages.includes(langCode)) {
            console.log('[SettingsManager] Detected system language:', langCode);
            return langCode;
        }

        // Default to English if not supported
        console.log('[SettingsManager] System language not supported, defaulting to English');
        return 'en';
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.loadSettings();
        this.createDropdown();
        this.setupEventListeners();
        this.applyAllSettings();
        this.setupAutoSave();
        console.log('[SettingsManager] Initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('mosaicSettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
                console.log('[SettingsManager] Loaded settings:', this.settings);
            }
        } catch (err) {
            console.error('[SettingsManager] Failed to load settings:', err);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('mosaicSettings', JSON.stringify(this.settings));
        } catch (err) {
            console.error('[SettingsManager] Failed to save settings:', err);
        }
    }

    createDropdown() {
        if (document.getElementById('settings-dropdown')) return;

        const dropdown = document.createElement('div');
        dropdown.id = 'settings-dropdown';
        dropdown.className = 'settings-dropdown';
        dropdown.innerHTML = this.getDropdownHTML();
        document.body.appendChild(dropdown);
        this.dropdown = dropdown;
    }

    getDropdownHTML() {
        const texts = this.getTexts();
        const isFreeTier = !window.getCurrentUser?.()?.user_metadata?.subscription_tier ||
            window.getCurrentUser?.()?.user_metadata?.subscription_tier === 'free';

        return `
            <div class="settings-header">
                <h4><i class="fas fa-cog"></i> ${texts.settings}</h4>
            </div>
            <div class="settings-content">
                <!-- Background Section -->
                <div class="settings-section">
                    <div class="settings-section-title">${texts.background}</div>
                    <div class="settings-radio-group" id="background-options">
                        <label class="settings-radio">
                            <input type="radio" name="background" value="isometric" ${this.settings.background === 'isometric' ? 'checked' : ''}>
                            <span>${texts.bgIsometric}</span>
                        </label>
                        <label class="settings-radio">
                            <input type="radio" name="background" value="square" ${this.settings.background === 'square' ? 'checked' : ''}>
                            <span>${texts.bgSquare}</span>
                        </label>
                        <label class="settings-radio">
                            <input type="radio" name="background" value="grid" ${this.settings.background === 'grid' ? 'checked' : ''}>
                            <span>${texts.bgGrid}</span>
                        </label>
                        <label class="settings-radio">
                            <input type="radio" name="background" value="blank" ${this.settings.background === 'blank' ? 'checked' : ''}>
                            <span>${texts.bgBlank}</span>
                        </label>
                        <label class="settings-radio">
                            <input type="radio" name="background" value="custom" ${this.settings.background === 'custom' ? 'checked' : ''}>
                            <span>${texts.bgCustom}</span>
                            <button class="settings-inline-btn" id="select-bg-image">
                                <i class="fas fa-image"></i>
                            </button>
                        </label>
                    </div>
                    <div class="settings-row settings-custom-bg-options" id="custom-bg-options" style="display: ${this.settings.background === 'custom' ? 'flex' : 'none'}">
                        <label>${texts.scrollMode}:</label>
                        <select id="bg-scroll-mode">
                            <option value="fixed" ${this.settings.backgroundScrollMode === 'fixed' ? 'selected' : ''}>${texts.scrollFixed}</option>
                            <option value="parallax" ${this.settings.backgroundScrollMode === 'parallax' ? 'selected' : ''}>${texts.scrollParallax}</option>
                        </select>
                    </div>
                </div>

                <!-- Sound Section -->
                <div class="settings-section">
                    <div class="settings-section-title">${texts.sound}</div>
                    <div class="settings-slider-row">
                        <label><i class="fas fa-volume-up"></i> ${texts.nodeContent}</label>
                        <input type="range" id="node-volume" min="0" max="100" value="${this.settings.nodeVolume}">
                        <span id="node-volume-value">${this.settings.nodeVolume}%</span>
                    </div>
                    <div class="settings-slider-row">
                        <label><i class="fas fa-headset"></i> ${texts.voiceChat}</label>
                        <input type="range" id="voice-volume" min="0" max="100" value="${this.settings.voiceChatVolume}">
                        <span id="voice-volume-value">${this.settings.voiceChatVolume}%</span>
                    </div>
                </div>

                <!-- Theme Section -->
                <div class="settings-section">
                    <div class="settings-section-title">${texts.theme}</div>
                    <div class="settings-theme-selector">
                        <button class="theme-btn ${this.settings.theme === 'auto' ? 'active' : ''}" data-theme="auto">
                            <i class="fas fa-magic"></i> ${texts.themeAuto}
                        </button>
                        <button class="theme-btn ${this.settings.theme === 'light' ? 'active' : ''}" data-theme="light">
                            <i class="fas fa-sun"></i> ${texts.themeLight}
                        </button>
                        <button class="theme-btn ${this.settings.theme === 'dark' ? 'active' : ''}" data-theme="dark">
                            <i class="fas fa-moon"></i> ${texts.themeDark}
                        </button>
                    </div>
                </div>

                <!-- Language Section -->
                <div class="settings-section">
                    <div class="settings-section-title">${texts.language}</div>
                    <div class="settings-row">
                        <select id="language-select">
                            <option value="en" ${this.settings.language === 'en' ? 'selected' : ''}>English</option>
                            <option value="es" ${this.settings.language === 'es' ? 'selected' : ''}>Español</option>
                            <option value="fr" ${this.settings.language === 'fr' ? 'selected' : ''}>Français</option>
                            <option value="de" ${this.settings.language === 'de' ? 'selected' : ''}>Deutsch</option>
                            <option value="tr" ${this.settings.language === 'tr' ? 'selected' : ''}>Türkçe</option>
                        </select>
                        <span class="settings-hint"><i class="fas fa-exclamation-triangle"></i> ${texts.restartRequired}</span>
                    </div>
                </div>

                <!-- Auto-Save Section -->
                <div class="settings-section">
                    <div class="settings-section-title">${texts.autoSave}</div>
                    <div class="settings-row">
                        <select id="autosave-select">
                            <option value="off" ${this.settings.autoSave === 'off' ? 'selected' : ''}>${texts.autoSaveOff}</option>
                            <option value="immediate" ${this.settings.autoSave === 'immediate' ? 'selected' : ''}>${texts.autoSaveImmediate}</option>
                            <option value="2min" ${this.settings.autoSave === '2min' ? 'selected' : ''}>${texts.autoSave2min}</option>
                            <option value="5min" ${this.settings.autoSave === '5min' ? 'selected' : ''}>${texts.autoSave5min}</option>
                            <option value="10min" ${this.settings.autoSave === '10min' ? 'selected' : ''}>${texts.autoSave10min}</option>
                        </select>
                    </div>
                </div>

                <!-- Actions Section -->
                <div class="settings-section settings-actions">
                    <button class="settings-action-btn" id="check-updates">
                        <i class="fas fa-sync-alt"></i> ${texts.checkUpdates}
                    </button>
                </div>

                <!-- Get Pro Section (for free users) -->
                ${isFreeTier ? `
                <div class="settings-section settings-pro-container">
                    <div class="pro-card">
                        <div class="pro-icon"><i class="fas fa-crown"></i></div>
                        <div class="pro-content">
                            <div class="pro-title">Get Pro</div>
                            <div class="pro-subtitle">${texts.proSubtitle}</div>
                        </div>
                        <button class="pro-btn" id="get-pro-btn">${texts.proBtnText}</button>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    getTexts() {
        const lang = this.settings.language || 'en';
        const texts = {
            en: {
                settings: 'Settings',
                background: 'Background',
                bgIsometric: 'Isometric Dots',
                bgSquare: 'Square Dots',
                bgGrid: 'Grid Lines',
                bgBlank: 'Blank',
                bgCustom: 'Custom...',
                scrollMode: 'Scroll Mode',
                scrollFixed: 'Fixed',
                scrollParallax: 'Parallax',
                sound: 'Sound',
                nodeContent: 'Node Content',
                voiceChat: 'Voice Chat',
                theme: 'Theme',
                themeAuto: 'Auto',
                themeLight: 'Light',
                themeDark: 'Dark',
                language: 'Language',
                restartRequired: 'Restart required',
                autoSave: 'Auto Save',
                autoSaveOff: 'Off',
                autoSaveImmediate: 'After each action',
                autoSave2min: 'Every 2 minutes',
                autoSave5min: 'Every 5 minutes',
                autoSave10min: 'Every 10 minutes',
                checkUpdates: 'Check for Updates',
                proSubtitle: 'Unlock all features',
                proBtnText: '$9/mo'
            },
            tr: {
                settings: 'Ayarlar',
                background: 'Arka Plan',
                bgIsometric: 'İzometrik Noktalı',
                bgSquare: 'Kare Noktalı',
                bgGrid: 'Kareli',
                bgBlank: 'Boş',
                bgCustom: 'Özel...',
                scrollMode: 'Kaydırma',
                scrollFixed: 'Sabit',
                scrollParallax: 'Paralaks',
                sound: 'Ses Ayarları',
                nodeContent: 'Node İçerikleri',
                voiceChat: 'Sesli Sohbet',
                theme: 'Tema',
                themeAuto: 'Otomatik',
                themeLight: 'Açık',
                themeDark: 'Koyu',
                language: 'Dil',
                restartRequired: 'Yeniden başlatma gerekli',
                autoSave: 'Otomatik Kayıt',
                autoSaveOff: 'Kapalı',
                autoSaveImmediate: 'Her işlemden sonra',
                autoSave2min: '2 dakikada 1',
                autoSave5min: '5 dakikada 1',
                autoSave10min: '10 dakikada 1',
                checkUpdates: 'Güncellemeleri Denetle',
                proSubtitle: 'Tüm özellikleri aç',
                proBtnText: '₺299/ay'
            },
            es: {
                settings: 'Configuración',
                background: 'Fondo',
                bgIsometric: 'Puntos Isométricos',
                bgSquare: 'Puntos Cuadrados',
                bgGrid: 'Cuadrícula',
                bgBlank: 'Vacío',
                bgCustom: 'Personalizado...',
                scrollMode: 'Modo Desplazamiento',
                scrollFixed: 'Fijo',
                scrollParallax: 'Parallax',
                sound: 'Sonido',
                nodeContent: 'Contenido de Nodo',
                voiceChat: 'Chat de Voz',
                theme: 'Tema',
                themeAuto: 'Auto',
                themeLight: 'Claro',
                themeDark: 'Oscuro',
                language: 'Idioma',
                restartRequired: 'Reinicio requerido',
                autoSave: 'Guardado Automático',
                autoSaveOff: 'Desactivado',
                autoSaveImmediate: 'Después de cada acción',
                autoSave2min: 'Cada 2 minutos',
                autoSave5min: 'Cada 5 minutos',
                autoSave10min: 'Cada 10 minutos',
                checkUpdates: 'Buscar Actualizaciones',
                proSubtitle: 'Desbloquea todas las funciones',
                proBtnText: '$9/mes'
            },
            fr: {
                settings: 'Paramètres',
                background: 'Arrière-plan',
                bgIsometric: 'Points Isométriques',
                bgSquare: 'Points Carrés',
                bgGrid: 'Grille',
                bgBlank: 'Vide',
                bgCustom: 'Personnalisé...',
                scrollMode: 'Mode Défilement',
                scrollFixed: 'Fixe',
                scrollParallax: 'Parallaxe',
                sound: 'Son',
                nodeContent: 'Contenu des Nœuds',
                voiceChat: 'Chat Vocal',
                theme: 'Thème',
                themeAuto: 'Auto',
                themeLight: 'Clair',
                themeDark: 'Sombre',
                language: 'Langue',
                restartRequired: 'Redémarrage requis',
                autoSave: 'Sauvegarde Automatique',
                autoSaveOff: 'Désactivé',
                autoSaveImmediate: 'Après chaque action',
                autoSave2min: 'Toutes les 2 minutes',
                autoSave5min: 'Toutes les 5 minutes',
                autoSave10min: 'Toutes les 10 minutes',
                checkUpdates: 'Vérifier les Mises à jour',
                proSubtitle: 'Débloquez toutes les fonctionnalités',
                proBtnText: '9€/mois'
            },
            de: {
                settings: 'Einstellungen',
                background: 'Hintergrund',
                bgIsometric: 'Isometrische Punkte',
                bgSquare: 'Quadratische Punkte',
                bgGrid: 'Gitterlinien',
                bgBlank: 'Leer',
                bgCustom: 'Benutzerdefiniert...',
                scrollMode: 'Scroll-Modus',
                scrollFixed: 'Fest',
                scrollParallax: 'Parallax',
                sound: 'Ton',
                nodeContent: 'Node-Inhalt',
                voiceChat: 'Sprachchat',
                theme: 'Design',
                themeAuto: 'Auto',
                themeLight: 'Hell',
                themeDark: 'Dunkel',
                language: 'Sprache',
                restartRequired: 'Neustart erforderlich',
                autoSave: 'Automatisch Speichern',
                autoSaveOff: 'Aus',
                autoSaveImmediate: 'Nach jeder Aktion',
                autoSave2min: 'Alle 2 Minuten',
                autoSave5min: 'Alle 5 Minuten',
                autoSave10min: 'Alle 10 Minuten',
                checkUpdates: 'Nach Updates suchen',
                proSubtitle: 'Alle Funktionen freischalten',
                proBtnText: '9€/Monat'
            }
        };

        return texts[lang] || texts.en;
    }

    setupEventListeners() {
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isOpen &&
                !e.target.closest('#settings-dropdown') &&
                !e.target.closest('#settings-btn')) {
                this.closeDropdown();
            }
        });

        // Background options
        this.dropdown.querySelectorAll('input[name="background"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.settings.background = e.target.value;
                this.applyBackground();
                this.saveSettings();

                // Show/hide custom options
                const customOpts = document.getElementById('custom-bg-options');
                if (customOpts) {
                    customOpts.style.display = e.target.value === 'custom' ? 'flex' : 'none';
                }
            });
        });

        // Custom background image selector
        const selectBgBtn = this.dropdown.querySelector('#select-bg-image');
        if (selectBgBtn) {
            selectBgBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectCustomBackground();
            });
        }

        // Background scroll mode
        const bgScrollMode = this.dropdown.querySelector('#bg-scroll-mode');
        if (bgScrollMode) {
            bgScrollMode.addEventListener('change', (e) => {
                this.settings.backgroundScrollMode = e.target.value;
                this.saveSettings();
                // Re-apply background to update parallax state
                this.applyBackground();
            });
        }

        // Volume sliders
        const nodeVolume = this.dropdown.querySelector('#node-volume');
        if (nodeVolume) {
            nodeVolume.addEventListener('input', (e) => {
                this.settings.nodeVolume = parseInt(e.target.value);
                this.dropdown.querySelector('#node-volume-value').textContent = `${this.settings.nodeVolume}%`;
                this.applyNodeVolume();
                this.saveSettings();
            });
        }

        const voiceVolume = this.dropdown.querySelector('#voice-volume');
        if (voiceVolume) {
            voiceVolume.addEventListener('input', (e) => {
                this.settings.voiceChatVolume = parseInt(e.target.value);
                this.dropdown.querySelector('#voice-volume-value').textContent = `${this.settings.voiceChatVolume}%`;
                this.saveSettings();
            });
        }

        // Theme buttons
        this.dropdown.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.settings.theme = btn.dataset.theme;
                this.applyTheme();
                this.saveSettings();

                // Update active state
                this.dropdown.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Language select
        const langSelect = this.dropdown.querySelector('#language-select');
        if (langSelect) {
            langSelect.addEventListener('change', (e) => {
                this.changeLanguage(e.target.value);
            });
        }

        // Auto-save select
        const autoSaveSelect = this.dropdown.querySelector('#autosave-select');
        if (autoSaveSelect) {
            autoSaveSelect.addEventListener('change', (e) => {
                this.settings.autoSave = e.target.value;
                this.saveSettings();
                this.setupAutoSave();
            });
        }

        // Check updates button
        const checkUpdatesBtn = this.dropdown.querySelector('#check-updates');
        if (checkUpdatesBtn) {
            checkUpdatesBtn.addEventListener('click', () => {
                this.checkForUpdates();
            });
        }

        // Get Pro button
        const getProBtn = this.dropdown.querySelector('#get-pro-btn');
        if (getProBtn) {
            getProBtn.addEventListener('click', () => {
                // Open pricing page or show upgrade modal
                if (window.electronAPI && window.electronAPI.openExternal) {
                    window.electronAPI.openExternal('https://mosaic.app/pricing');
                } else {
                    window.open('https://mosaic.app/pricing', '_blank');
                }
            });
        }
    }

    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        if (!this.dropdown) return;

        // Refresh dropdown content (for Pro status changes)
        this.dropdown.innerHTML = this.getDropdownHTML();
        this.setupEventListeners();

        this.dropdown.classList.add('open');
        this.isOpen = true;
    }

    closeDropdown() {
        if (!this.dropdown) return;
        this.dropdown.classList.remove('open');
        this.isOpen = false;
    }

    applyAllSettings() {
        this.applyBackground();
        this.applyTheme();
        this.applyNodeVolume();
    }

    applyBackground() {
        console.log('[SettingsManager] Applying background:', this.settings.background, 'URL:', this.settings.customBackgroundUrl);
        if (window.setCanvasBackground) {
            window.setCanvasBackground(this.settings.background, this.settings.customBackgroundUrl);
        }
    }

    applyTheme() {
        const { theme } = this.settings;

        if (theme === 'auto') {
            // Use system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.toggle('night-mode', prefersDark);
        } else if (theme === 'dark') {
            document.body.classList.add('night-mode');
        } else {
            document.body.classList.remove('night-mode');
        }

        localStorage.setItem('mosaicNightMode', document.body.classList.contains('night-mode') ? 'true' : 'false');
    }

    applyNodeVolume() {
        // Apply volume to all webviews and iframes
        const volume = this.settings.nodeVolume / 100;

        document.querySelectorAll('webview').forEach(webview => {
            try {
                webview.setAudioMuted(volume === 0);
                // Note: webview doesn't support volume level, only mute
            } catch (err) {
                // Webview may not be ready
            }
        });

        // Store volume for audio elements in iframes
        window.mosaicNodeVolume = volume;
    }

    async selectCustomBackground() {
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            try {
                const result = await window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
                });

                if (result && result.filePaths && result.filePaths[0]) {
                    this.settings.customBackgroundUrl = `file://${result.filePaths[0]}`;
                    this.settings.background = 'custom';
                    this.applyBackground();
                    this.saveSettings();

                    // Update radio button
                    const customRadio = this.dropdown.querySelector('input[value="custom"]');
                    if (customRadio) customRadio.checked = true;

                    // Show custom options
                    const customOpts = document.getElementById('custom-bg-options');
                    if (customOpts) customOpts.style.display = 'flex';
                }
            } catch (err) {
                console.error('[SettingsManager] Failed to select background:', err);
            }
        } else {
            // Fallback: Use file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        this.settings.customBackgroundUrl = ev.target.result;
                        this.settings.background = 'custom';
                        this.applyBackground();
                        this.saveSettings();
                    };
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        }
    }

    changeLanguage(lang) {
        if (lang === this.settings.language) return;

        const texts = this.getTexts();

        // Check if project is open and has unsaved changes
        const hasOpenProject = window.projects && window.projects.length > 0 && window.activeProjectIndex >= 0;

        if (hasOpenProject) {
            const confirmed = confirm(
                lang === 'tr'
                    ? 'Dil değişikliği uygulamayı yeniden başlatacak. Mevcut projeyi kaydetmek ister misiniz?'
                    : 'Language change will restart the app. Do you want to save the current project?'
            );

            if (confirmed && window.saveProject) {
                window.saveProject();
            }
        }

        // Save new language
        this.settings.language = lang;
        localStorage.setItem('mosaicLanguage', lang);
        this.saveSettings();

        // Restart app
        if (window.electronAPI && window.electronAPI.restartApp) {
            window.electronAPI.restartApp();
        } else {
            // Web fallback: reload page
            window.location.reload();
        }
    }

    async checkForUpdates() {
        const btn = this.dropdown.querySelector('#check-updates');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
        }

        try {
            if (window.electronAPI && window.electronAPI.checkForUpdates) {
                const result = await window.electronAPI.checkForUpdates();

                if (result && result.updateAvailable) {
                    if (btn) {
                        btn.innerHTML = '<i class="fas fa-download"></i> Update Available!';
                        btn.classList.add('update-available');
                    }
                } else {
                    if (btn) {
                        btn.innerHTML = '<i class="fas fa-check"></i> Up to date';
                        setTimeout(() => {
                            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Check for Updates';
                            btn.disabled = false;
                        }, 2000);
                    }
                }
            } else {
                // No Electron API
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-check"></i> Latest version';
                    btn.disabled = false;
                }
            }
        } catch (err) {
            console.error('[SettingsManager] Update check failed:', err);
            if (btn) {
                btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Check failed';
                btn.disabled = false;
            }
        }
    }

    setupAutoSave() {
        // Clear existing timer
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }

        const { autoSave } = this.settings;

        // Set up new timer based on setting
        let intervalMs = 0;
        switch (autoSave) {
            case '2min': intervalMs = 2 * 60 * 1000; break;
            case '5min': intervalMs = 5 * 60 * 1000; break;
            case '10min': intervalMs = 10 * 60 * 1000; break;
            default: intervalMs = 0;
        }

        if (intervalMs > 0) {
            this.autoSaveTimer = setInterval(() => {
                if (window.saveProject && window.projects && window.projects.length > 0) {
                    console.log('[SettingsManager] Auto-saving...');
                    window.saveProject();
                }
            }, intervalMs);
        }

        // Override scheduleAutoSave for 'immediate' mode
        if (autoSave === 'immediate') {
            window._originalScheduleAutoSave = window.scheduleAutoSave;
            window.scheduleAutoSave = () => {
                if (window.saveProject && window.projects && window.projects.length > 0) {
                    // Debounce to avoid too many saves
                    clearTimeout(window._immediateAutoSaveTimeout);
                    window._immediateAutoSaveTimeout = setTimeout(() => {
                        window.saveProject();
                    }, 1000);
                }
            };
        } else if (window._originalScheduleAutoSave) {
            // Restore original
            window.scheduleAutoSave = window._originalScheduleAutoSave;
        }

        console.log('[SettingsManager] Auto-save configured:', autoSave);
    }
}

// Canvas background function
window.setCanvasBackground = function (type, customUrl = null) {
    const bg = document.getElementById('canvas-background');
    if (!bg) return;

    console.log('[setCanvasBackground] Setting background:', type, 'URL:', customUrl);

    // Store current background type globally for transform calculations
    window.canvasBackgroundType = type;
    if (customUrl) {
        window.canvasCustomBgUrl = customUrl;
    }

    // Remove custom background overlay if exists
    const existingOverlay = document.getElementById('custom-bg-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Reset background properties on canvas-background
    bg.style.backgroundImage = '';
    bg.style.backgroundRepeat = '';
    bg.style.backgroundAttachment = '';
    bg.style.background = '';

    switch (type) {
        case 'isometric':
            bg.style.background = 'radial-gradient(var(--grid-color) 1px, transparent 1px), radial-gradient(var(--grid-color) 1px, transparent 1px)';
            bg.style.backgroundSize = '20px 20px';
            bg.style.backgroundPosition = '0 0, 10px 10px';
            break;
        case 'square':
            bg.style.background = 'radial-gradient(var(--grid-color) 1.5px, transparent 1.5px)';
            bg.style.backgroundSize = '20px 20px';
            bg.style.backgroundPosition = '0 0';
            break;
        case 'grid':
            bg.style.background = `
                linear-gradient(var(--grid-color) 1px, transparent 1px),
                linear-gradient(90deg, var(--grid-color) 1px, transparent 1px)
            `;
            bg.style.backgroundSize = '20px 20px';
            bg.style.backgroundPosition = '0 0';
            break;
        case 'blank':
            bg.style.background = 'none';
            break;
        case 'custom':
            // For custom backgrounds, use a separate overlay layer
            // that is fixed to the viewport (not affected by canvas transform)
            bg.style.background = 'none';

            // Use provided URL or fallback to stored URL
            const bgUrl = customUrl || window.canvasCustomBgUrl;
            console.log('[setCanvasBackground] Custom background URL:', bgUrl);

            if (bgUrl) {
                const overlay = document.createElement('div');
                overlay.id = 'custom-bg-overlay';
                // Make overlay 130% of viewport for parallax (15% extra on each side)
                overlay.style.cssText = `
                    position: fixed;
                    top: -15%;
                    left: -15%;
                    width: 130%;
                    height: 130%;
                    background-image: url(${bgUrl});
                    background-size: cover;
                    background-position: center center;
                    background-repeat: no-repeat;
                    z-index: 0;
                    pointer-events: none;
                    transform-origin: center center;
                    transition: transform 0.15s ease-out;
                `;

                // Insert before canvas-wrapper
                const canvasWrapper = document.getElementById('canvas-wrapper');
                if (canvasWrapper && canvasWrapper.parentNode) {
                    canvasWrapper.parentNode.insertBefore(overlay, canvasWrapper);
                    console.log('[setCanvasBackground] Custom overlay created');
                }
            }
            break;
    }

    console.log('[SettingsManager] Background set to:', type);
};

// Update custom background parallax
window.updateCustomBackgroundParallax = function () {
    const overlay = document.getElementById('custom-bg-overlay');
    if (!overlay) return;

    // Ensure overlay is visible
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';

    const settings = window.settingsManager?.settings;
    const isParallax = settings?.backgroundScrollMode === 'parallax';

    if (isParallax) {
        // Get canvas dimensions and current offset
        const canvasX = window.canvasOffset?.x || 0;
        const canvasY = window.canvasOffset?.y || 0;

        // Canvas is 100000x100000, center is at 50000,50000
        // When canvasOffset is 0, we're looking at center
        // Normalize position: -1 to 1 range based on how far from center
        const canvasSize = 50000; // Half of canvas dimension
        const normalizedX = Math.max(-1, Math.min(1, canvasX / canvasSize));
        const normalizedY = Math.max(-1, Math.min(1, canvasY / canvasSize));

        // Background is 130% size, so it has 15% extra on each side
        // Map normalized position to background offset
        // Move in SAME direction as pan (removed negative sign)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const extraWidth = viewportWidth * 0.15;
        const extraHeight = viewportHeight * 0.15;

        const offsetX = normalizedX * extraWidth;
        const offsetY = normalizedY * extraHeight;

        // Set transform origin to center for proper zoom behavior
        overlay.style.transformOrigin = 'center center';
        overlay.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    } else {
        // Fixed mode - no transform
        overlay.style.transform = 'none';
    }
};

// Initialize and export
let settingsManager = null;

document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
    window.settingsManager = settingsManager;
});

window.SettingsManager = SettingsManager;
