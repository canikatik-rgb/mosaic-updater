/**
 * AppLifecycle.js
 * Orchestrates the ordered initialization of frontend systems to prevent race conditions.
 * Usage: Awaits critical systems then fires 'MOSAIC_READY'.
 */

class AppLifecycle {
    constructor() {
        this.isReady = false;
        this.initSteps = [
            { name: 'Settings', fn: () => this.initSettings() },
            { name: 'SignIn', fn: () => this.initSignIn() },
            { name: 'Canvas', fn: () => this.initCanvas() },
            { name: 'P2P', fn: () => this.initP2P() },
            { name: 'Project', fn: () => this.loadInitialProject() }
        ];
    }

    async boot() {
        console.log('[Lifecycle] Booting Mosaic...');

        try {
            for (const step of this.initSteps) {
                console.log(`[Lifecycle] Initializing ${step.name}...`);
                await step.fn();
            }

            this.isReady = true;
            console.log('[Lifecycle] MOSAIC_READY');

            // Dispatch global event for nodes that were waiting
            window.dispatchEvent(new Event('MOSAIC_READY'));

        } catch (error) {
            console.error('[Lifecycle] Boot failed:', error);
            // Show fatal error UI overlay could go here
        }
    }

    async initSettings() {
        // user-settings.js is already loaded, but we might want to ensure it's done
        if (window.loadUserData) {
            // await window.loadUserData(); // If async
        }
        return Promise.resolve();
    }

    async initSignIn() {
        if (window.initSignInScreen) {
            window.initSignInScreen();
        } else {
            console.error('[Lifecycle] initSignInScreen not found');
        }
        return Promise.resolve();
    }

    async initCanvas() {
        // Wait for canvas to be fully mounted if necessary
        if (!window.canvasSystem) return;
        // If 3D canvas needs preload
        return Promise.resolve();
    }

    async initP2P() {
        // P2P Manager auto-inits on DOMContentLoaded currently. 
        // We might want to make it manual in future.
        // For now, just verification.
        return Promise.resolve();
    }

    async loadInitialProject() {
        // Check if a file was passed via IPC ('open-file-path')
        // The IPC handler in index.html handles this, but here we could coordinate it.
        return new Promise(resolve => setTimeout(resolve, 100)); // Small buffer
    }
}

// Global Instance
window.appLifecycle = new AppLifecycle();

// Auto-boot on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    // Override/Delay existing initialization flows if necessary
    window.appLifecycle.boot();
});
