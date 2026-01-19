const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getChromeInfo } = require('./chrome-detection');

function setupWidevine() {
    const log = (msg) => console.log(`[CDM-Setup] ${msg}`);

    try {
        log('Starting Widevine Auto-Setup...');
        const systemChrome = getChromeInfo();

        if (!systemChrome.widevinePath) {
            log('❌ No System Widevine found.');
            return null;
        }

        log(`Found System Widevine at: ${systemChrome.widevinePath}`);

        // Destination: <UserData>/WidevineCdm
        const userDataPath = app.getPath('userData');
        const destPath = path.join(userDataPath, 'WidevineCdm');

        // Check if we need to copy (if version changed or missing)
        let needCopy = true;
        let currentVersion = '0.0.0.0';

        // Check verification file
        const metaFile = path.join(userDataPath, 'cdm-meta.json');
        if (fs.existsSync(metaFile) && fs.existsSync(destPath)) {
            try {
                const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
                if (meta.version === systemChrome.version && meta.source === systemChrome.widevinePath) {
                    needCopy = false;
                    currentVersion = meta.version;
                    log(`✅ Local copy up to date (${currentVersion})`);
                }
            } catch (e) { }
        }

        if (needCopy) {
            log(`Copying Widevine from system to: ${destPath}...`);

            // Recursive Copy Function
            const copyRecursive = (src, dest) => {
                if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
                const entries = fs.readdirSync(src, { withFileTypes: true });

                for (const entry of entries) {
                    const srcPath = path.join(src, entry.name);
                    const destPath = path.join(dest, entry.name);

                    if (entry.isDirectory()) {
                        copyRecursive(srcPath, destPath);
                    } else {
                        // Copy file
                        fs.copyFileSync(srcPath, destPath);
                    }
                }
            };

            // Perform Copy
            if (fs.existsSync(destPath)) {
                fs.rmSync(destPath, { recursive: true, force: true });
            }
            copyRecursive(systemChrome.widevinePath, destPath);

            // Save Meta
            fs.writeFileSync(metaFile, JSON.stringify({
                version: systemChrome.version,
                source: systemChrome.widevinePath,
                updated: Date.now()
            }));

            currentVersion = systemChrome.version;
            log('✅ Copy complete.');
        }

        // Return the clean Local Paths
        // IMPORTANT: We point Electron to the DIRECTORY containing manifest.json
        // Electron 33+ handles the architecture selection automatically from _platform_specific

        // HOWEVER: If directory loading fails, we need the exact binary path
        const os = require('os');
        const arch = os.arch();
        let binaryRelative = '';
        if (process.platform === 'darwin') {
            binaryRelative = arch === 'arm64'
                ? '_platform_specific/mac_arm64/libwidevinecdm.dylib'
                : '_platform_specific/mac_x64/libwidevinecdm.dylib';
        } else if (process.platform === 'win32') {
            binaryRelative = '_platform_specific/win_x64/widevinecdm.dll';
        }

        const binaryPath = path.join(destPath, binaryRelative);

        return {
            path: destPath, // Directory
            binaryPath: fs.existsSync(binaryPath) ? binaryPath : null, // Specific Binary
            version: currentVersion
        };

    } catch (err) {
        log('❌ Error during CDM setup: ' + err.message);
        return null;
    }
}

module.exports = { setupWidevine };
