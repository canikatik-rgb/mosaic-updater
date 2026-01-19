const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function getChromeInfo() {
    const platform = os.platform();
    let chromePath = '';
    let chromeVersion = ''; // Version of the Browser (e.g. 131.0.0.0 or 143.0.0.0)
    let cdmVersion = '';    // Version of Widevine CDM (e.g. 4.10.2934.0)
    let widevinePath = '';
    let widevineBinaryPath = ''; // Exact path to .dylib/.dll
    let userAgent = '';

    try {
        if (platform === 'darwin') {
            // macOS
            const defaultPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            if (fs.existsSync(defaultPath)) {
                chromePath = defaultPath;

                // Get Version
                try {
                    const versionBuffer = execSync('"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --version');
                    // Output format: "Google Chrome 120.0.6099.109 "
                    chromeVersion = versionBuffer.toString().trim().replace('Google Chrome ', '');
                } catch (e) {
                    console.error('Failed to get Chrome version:', e);
                    chromeVersion = '120.0.0.0'; // Fallback
                }

                // Find Widevine
                // Usually in: /Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions/[Version]/Libraries/WidevineCdm
                const frameworkPath = '/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions';
                const specificVersionPath = path.join(frameworkPath, chromeVersion, 'Libraries/WidevineCdm/_platform_specific/mac_x64/libwidevinecdm.dylib');
                const armVersionPath = path.join(frameworkPath, chromeVersion, 'Libraries/WidevineCdm/_platform_specific/mac_arm64/libwidevinecdm.dylib');

                if (fs.existsSync(armVersionPath) && os.arch() === 'arm64') {
                    widevinePath = path.join(frameworkPath, chromeVersion, 'Libraries/WidevineCdm');
                    widevineBinaryPath = armVersionPath;
                } else if (fs.existsSync(specificVersionPath)) {
                    widevinePath = path.join(frameworkPath, chromeVersion, 'Libraries/WidevineCdm');
                    widevineBinaryPath = specificVersionPath;
                } else {
                    // Try to finding ANY folder in Versions that has it
                    if (fs.existsSync(frameworkPath)) {
                        const dirs = fs.readdirSync(frameworkPath).filter(d => d !== 'Current');
                        // Sort by version (simple descending)
                        dirs.sort().reverse();

                        for (const d of dirs) {
                            const candidate = path.join(frameworkPath, d, 'Libraries/WidevineCdm');
                            if (fs.existsSync(candidate)) {
                                widevinePath = candidate;
                                if (!chromeVersion || chromeVersion === '120.0.0.0') {
                                    chromeVersion = d;
                                }

                                // Attempt to find binary in candidate
                                const armBin = path.join(candidate, '_platform_specific/mac_arm64/libwidevinecdm.dylib');
                                const x64Bin = path.join(candidate, '_platform_specific/mac_x64/libwidevinecdm.dylib');
                                if (os.arch() === 'arm64' && fs.existsSync(armBin)) widevineBinaryPath = armBin;
                                else if (fs.existsSync(x64Bin)) widevineBinaryPath = x64Bin;

                                break;
                            }
                        }
                    }
                }

                // CRITICAL: Read the component manifest to get the EXACT CDM Version
                if (widevinePath) {
                    try {
                        const findManifest = (dir) => {
                            if (!fs.existsSync(dir)) return null;
                            const files = fs.readdirSync(dir);
                            if (files.includes('manifest.json')) return path.join(dir, 'manifest.json');
                            for (const file of files) {
                                const fullPath = path.join(dir, file);
                                if (fs.statSync(fullPath).isDirectory()) {
                                    const found = findManifest(fullPath);
                                    if (found) return found;
                                }
                            }
                            return null;
                        };

                        const manifestPath = findManifest(widevinePath);
                        if (manifestPath) {
                            const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                            if (manifestData.version) {
                                console.log(`[ChromeDetect] Found explicit Widevine Version: ${manifestData.version} (Chrome was ${chromeVersion})`);
                                cdmVersion = manifestData.version; // Override version with actual CDM version
                            }
                        }
                    } catch (e) {
                        console.error('[ChromeDetect] Failed to read manifest version:', e);
                    }
                }

                // Construct User Agent - FORCE MODERN VERSION (2026 Era)
                // Spoof v146 to bypass "Update Browser" blocks
                const spoofVersion = '146.0.0.0';
                userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${spoofVersion} Safari/537.36`;
            }
        } else if (platform === 'win32') {
            // Windows
            const suffix = '\\Google\\Chrome\\Application\\chrome.exe';
            const prefixes = [
                process.env.LOCALAPPDATA,
                process.env.PROGRAMFILES,
                process.env['PROGRAMFILES(X86)']
            ].filter(Boolean);

            for (const prefix of prefixes) {
                const candidate = path.join(prefix, suffix);
                if (fs.existsSync(candidate)) {
                    chromePath = candidate;
                    break;
                }
            }

            if (chromePath) {
                try {
                    const appDir = path.dirname(chromePath);
                    const dirs = fs.readdirSync(appDir);
                    const verDir = dirs.find(d => /^\d+\.\d+\.\d+\.\d+$/.test(d));

                    if (verDir) {
                        chromeVersion = verDir; // Set Chrome version
                        cdmVersion = verDir;    // Default

                        const widevineCandidate = path.join(appDir, verDir, 'WidevineCdm');
                        if (fs.existsSync(widevineCandidate)) {
                            widevinePath = widevineCandidate;

                            // Windows Binary logic: 
                            // Usually [Version]/WidevineCdm/_platform_specific/win_x64/widevinecdm.dll
                            const winBin = path.join(widevineCandidate, '_platform_specific/win_x64/widevinecdm.dll');
                            if (fs.existsSync(winBin)) widevineBinaryPath = winBin;

                            // Read manifest for version
                            const manifestPath = path.join(widevineCandidate, 'manifest.json');
                            if (fs.existsSync(manifestPath)) {
                                const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                                cdmVersion = m.version;
                            } else {
                                const findManifestWin = (dir) => {
                                    if (!fs.existsSync(dir)) return null;
                                    const files = fs.readdirSync(dir);
                                    if (files.includes('manifest.json')) return path.join(dir, 'manifest.json');
                                    // Shallow check
                                    return null;
                                };
                                const deepManifest = findManifestWin(widevineCandidate);
                                if (deepManifest) {
                                    const m = JSON.parse(fs.readFileSync(deepManifest, 'utf8'));
                                    cdmVersion = m.version;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Win Chrome detection error:', e);
                }
            }
            // Fallback UA - Force Modern
            const spoofVersion = '146.0.0.0';
            userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${spoofVersion} Safari/537.36`;
        }
    } catch (err) {
        console.warn('Chrome detection failed:', err);
    }

    // Fallback Mac UA if not set
    if (!userAgent && platform === 'darwin') {
        const spoofVersion = '146.0.0.0';
        userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${spoofVersion} Safari/537.36`;
    }

    return {
        chromePath,
        version: cdmVersion || chromeVersion,
        chromeVersion: chromeVersion,
        widevinePath,
        widevineBinaryPath,
        userAgent
    };
}

module.exports = { getChromeInfo };
