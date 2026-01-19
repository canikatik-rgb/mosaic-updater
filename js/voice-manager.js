/**
 * VoiceManager.js
 * Handles WebRTC audio communication (Voice Channels)
 */

class VoiceManager {
    constructor() {
        this.localStream = null;
        this.isActive = false;
        this.peers = new Map(); // peerId -> { audioElem, stream }

        // Audio Context for visualizer (optional)
        this.audioContext = null;
        this.analyser = null;

        // Bindings
        this.toggleVoice = this.toggleVoice.bind(this);
    }

    init() {
        this.createUI();
    }

    createUI() {
        // Add Voice controls to Titlebar (next to Chat)
        const chatBtn = document.getElementById('chat-btn');
        if (chatBtn) {
            const voiceBtn = document.createElement('button');
            voiceBtn.id = 'voice-btn';
            voiceBtn.className = 'titlebar-btn';
            voiceBtn.title = 'Join Voice Channel';
            voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            voiceBtn.addEventListener('click', this.toggleVoice);

            chatBtn.parentNode.insertBefore(voiceBtn, chatBtn);
        }
    }

    async toggleVoice() {
        if (this.isActive) {
            await this.leaveVoice();
        } else {
            await this.joinVoice();
        }
    }

    async joinVoice() {
        try {
            console.log('[Voice] Requesting microphone access...');
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

            this.isActive = true;
            this.updateUI(true);

            // Add track to existing P2P connections
            if (window.p2pManager) {
                window.p2pManager.addLocalStream(this.localStream);
            }

            console.log('[Voice] Joined voice channel');
        } catch (err) {
            console.error('[Voice] Failed to join:', err);
            alert('Could not access microphone: ' + err.message);
        }
    }

    async leaveVoice() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Remove track from P2P connections
        if (window.p2pManager) {
            window.p2pManager.removeLocalStream();
        }

        this.isActive = false;
        this.updateUI(false);
        console.log('[Voice] Left voice channel');
    }

    updateUI(isActive) {
        const btn = document.getElementById('voice-btn');
        if (btn) {
            btn.innerHTML = isActive ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
            btn.classList.toggle('active', isActive);
            btn.title = isActive ? 'Leave Voice Channel' : 'Join Voice Channel';

            if (isActive) {
                btn.style.color = '#4CAF50';
                btn.style.background = 'rgba(76, 175, 80, 0.2)';
            } else {
                btn.style.color = '';
                btn.style.background = '';
            }
        }
    }

    // Called by P2PManager when a remote stream is received
    handleRemoteStream(peerId, stream) {
        console.log(`[Voice] Received remote stream from ${peerId}`);

        let audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.volume = 1.0;

        // Store
        this.peers.set(peerId, { audio, stream });

        // Play
        audio.play().catch(e => console.warn('[Voice] Autoplay blocked:', e));
    }

    handleRemoteStreamRemoved(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.audio.pause();
            peer.audio.srcObject = null;
            this.peers.delete(peerId);
            console.log(`[Voice] Removed remote stream from ${peerId}`);
        }
    }
}

// Global Instance
window.voiceManager = new VoiceManager();

function initVoiceManager() {
    // Initialize UI immediately (independent of P2P)
    window.voiceManager.init();

    // Check if we missed the P2P ready event
    if (window.p2pManager && window.voiceManager.localStream) {
        window.p2pManager.addLocalStream(window.voiceManager.localStream);
    }
}

// VoiceManager init mainly creates UI. 
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initVoiceManager, 1000);
});
