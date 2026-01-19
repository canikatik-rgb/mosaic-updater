/**
 * P2P Manager
 * Handles local WebRTC connections using custom Signaling Server
 */

class P2PManager {
    constructor() {
        this.socket = null;
        this.peerId = null; // My user ID
        this.roomId = null; // Project ID
        this.peers = new Map(); // peerId -> { conn: RTCPeerConnection, channel: RTCDataChannel }

        this.hostedProject = null;
        this.connectedProject = null;
        this.operationLog = null;
        this.isHost = false;

        this.listeners = new Set();
        this.nodeLocks = new Map();

        // File Transfer State
        this.fileChunks = new Map(); // transferId -> { chunks: [], info: {} }
    }

    async init() {
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!user) {
            console.log('[P2P] Not authenticated, skipping P2P init');
            return;
        }
        this.peerId = user.id;

        // Connect to local signaling server
        try {
            this.socket = new WebSocket('ws://localhost:3000');

            this.socket.onopen = () => {
                console.log('[P2P] Connected to Signaling Server');
                this.notify('connected', { peerId: this.peerId });
            };

            this.socket.onmessage = (msg) => {
                const data = JSON.parse(msg.data);
                this.handleSignal(data);
            };

            this.socket.onerror = (err) => console.error('[P2P] Signaling error:', err);

            // Setup Data Card Sync
            if (window.dataCardStore) {
                window.dataCardStore.onStoreUpdate((packet) => {
                    this.broadcast({ type: 'data-card-update', packet });
                });
            }

        } catch (err) {
            console.error('[P2P] Init failed:', err);
        }
    }

    async hostProject(projectId, projectData) {
        if (!this.socket) await this.init();

        this.isHost = true;
        this.roomId = projectId;
        this.hostedProject = { id: projectId, data: projectData, name: projectData.name || 'Untitled' };
        this.operationLog = new OperationLog(projectId);

        // Join room as host
        this.socket.send(JSON.stringify({
            type: 'JOIN_ROOM',
            roomId: projectId,
            userId: this.peerId,
            projectName: projectData.name
        }));

        // Init Cursor Sync
        if (window.CursorSync && !window.cursorSync) {
            window.cursorSync = new window.CursorSync();
            window.cursorSync.init(document.getElementById('canvas-content'));
        }

        console.log('[P2P] Hosting room:', projectId);
        this.notify('hosting', { projectId, projectName: projectData.name });
        return true;
    }

    async connectToProject(roomId) {
        if (!this.socket) await this.init();

        this.isHost = false;
        this.roomId = roomId;

        this.socket.send(JSON.stringify({
            type: 'JOIN_ROOM',
            roomId: roomId,
            userId: this.peerId
        }));

        if (window.CursorSync && !window.cursorSync) {
            window.cursorSync = new window.CursorSync();
            window.cursorSync.init(document.getElementById('canvas-content'));
        }

        this.notify('connected-to-host', { roomId });
    }

    // ========== Signaling & WebRTC ==========

    async handleSignal(data) {
        const { type, senderUserId } = data;

        switch (type) {
            case 'USER_JOINED':
                console.log('[P2P] User joined:', senderUserId);
                // Initiator creates offer
                this.createPeerConnection(senderUserId, true);
                break;

            case 'OFFER':
                await this.handleOffer(senderUserId, data.offer);
                break;

            case 'ANSWER':
                await this.handleAnswer(senderUserId, data.answer);
                break;

            case 'ICE_CANDIDATE':
                this.handleCandidate(senderUserId, data.candidate);
                break;

            case 'USER_LEFT':
                this.removePeer(senderUserId);
                break;

            case 'ROOM_LIST':
                this.handleRoomList(data.rooms);
                break;
        }
    }

    getSharedWithMe() {
        return new Promise(async (resolve, reject) => {
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                await this.init();
            }
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                return resolve([]); // Offline or no server
            }

            // Timeout to prevent hanging
            const timeout = setTimeout(() => {
                this.resolveRoomList = null;
                resolve([]);
            }, 3000);

            this.resolveRoomList = (rooms) => {
                clearTimeout(timeout);
                resolve(rooms.map(r => ({
                    project_id: r.roomId,
                    project_name: r.projectName,
                    thumbnail: null, // No thumb in discovery yet
                    updated_at: new Date().toISOString(),
                    host_user_id: r.hostId,
                    hostOnline: true
                })));
                this.resolveRoomList = null;
            };

            this.socket.send(JSON.stringify({ type: 'LIST_ROOMS' }));
        });
    }

    handleRoomList(rooms) {
        if (this.resolveRoomList) {
            this.resolveRoomList(rooms);
        }

    }

    async inviteUser(email, projectId) {
        alert("Inviting via email is not supported in Local P2P mode.\nPlease share the Room ID code with your peer.");
    }

    createPeerConnection(targetPeerId, isInitiator) {
        if (this.peers.has(targetPeerId)) return this.peers.get(targetPeerId);

        console.log(`[P2P] Creating ${isInitiator ? 'initiator' : 'receiver'} connection for ${targetPeerId}`);

        const config = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        };
        const pc = new RTCPeerConnection(config);

        const peer = { conn: pc, channel: null };
        this.peers.set(targetPeerId, peer);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.send(JSON.stringify({
                    type: 'ICE_CANDIDATE',
                    targetUserId: targetPeerId,
                    candidate: event.candidate
                }));
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[P2P] Connection state with ${targetPeerId}: ${pc.connectionState}`);
            if (pc.connectionState === 'disconnected') this.removePeer(targetPeerId);
        };

        pc.ontrack = (event) => {
            console.log('[P2P] Received remote track');
            if (window.voiceManager && event.streams && event.streams[0]) {
                window.voiceManager.handleRemoteStream(targetPeerId, event.streams[0]);
            }
        };

        if (isInitiator) {
            // Create Data Channel
            const dc = pc.createDataChannel('mosaic-data', { negotiated: true, id: 0 });
            this.setupDataChannel(dc, targetPeerId);
            peer.channel = dc;

            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                this.socket.send(JSON.stringify({
                    type: 'OFFER',
                    targetUserId: targetPeerId,
                    offer: offer
                }));
            });
        } else {
            // Receiver waits for data channel
            pc.ondatachannel = (event) => {
                // Actually we use negotiated channel, but good fallback
                /* 
                   With negotiated: true, ondatachannel might not fire automatically 
                   same way. We'll set it up in handleAnswer or common setup.
                   But since we use id:0 negotiated, we can just create it on both sides?
                   Actually, standard way: Initiator createDataChannel, 
                   Receiver handles ondatachannel OR both create negotiated.
                   Let's stick to standard for simplicity? No, negotiated is faster.
                */
            };
            // For negotiated channels, we just create it on both sides with same ID
            const dc = pc.createDataChannel('mosaic-data', { negotiated: true, id: 0 });
            this.setupDataChannel(dc, targetPeerId);
            peer.channel = dc;
        }

        return peer;
    }

    async handleOffer(senderUserId, offer) {
        const peer = this.createPeerConnection(senderUserId, false);
        await peer.conn.setRemoteDescription(offer);
        const answer = await peer.conn.createAnswer();
        await peer.conn.setLocalDescription(answer);

        this.socket.send(JSON.stringify({
            type: 'ANSWER',
            targetUserId: senderUserId,
            answer: answer
        }));
    }

    async handleAnswer(senderUserId, answer) {
        const peer = this.peers.get(senderUserId);
        if (peer) {
            await peer.conn.setRemoteDescription(answer);
        }
    }

    async handleCandidate(senderUserId, candidate) {
        const peer = this.peers.get(senderUserId);
        if (peer) {
            await peer.conn.addIceCandidate(candidate);
        }
    }

    setupDataChannel(dc, peerId) {
        dc.onopen = () => {
            console.log('[P2P] Data Channel OPEN with', peerId);
            this.notify('guest-connected', { peerId });

            if (this.isHost) {
                // Send project data
                // Reuse existing getProject logic or simplified
                this.sendProjectSnapshot(peerId);
            } else {
                // Ask for project
                this.sendToPeer(peerId, { type: 'request-project' });
            }
        };

        dc.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            this.handleDataMessage(peerId, msg);
        };
    }

    removePeer(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.conn.close();
            this.peers.delete(peerId);
            this.notify('guest-disconnected', { peerId });
        }
    }

    sendToPeer(peerId, data) {
        const peer = this.peers.get(peerId);
        if (peer && peer.channel && peer.channel.readyState === 'open') {
            peer.channel.send(JSON.stringify(data));
        }
    }

    broadcast(data, excludePeerId = null) {
        for (const [peerId, peer] of this.peers) {
            if (peerId !== excludePeerId) {
                this.sendToPeer(peerId, data);
            }
        }
    }

    // ========== Data Handling ==========

    handleDataMessage(peerId, data) {
        switch (data.type) {
            case 'request-project':
                if (this.isHost) this.sendProjectSnapshot(peerId);
                break;
            case 'project-data':
                this.notify('project-received', data);
                break;
            case 'operation':
                this.handleRemoteOperation(data.operation, peerId);
                break;
            case 'cursor-move':
            case 'cursor-leave':
                this.notify(data.type, { ...data, peerId });
                break;

            case 'request-file':
                this.handleFileRequest(data, peerId);
                break;

            case 'data-card-update':
                if (window.dataCardStore) {
                    window.dataCardStore.addPacket(data.packet.sourceNodeId, data.packet, 'remote');
                    this.notify('data-card-update', { ...data, peerId }); // Notify UI if needed

                    // Auto-request file if it's a file-backed card
                    if (data.packet.filePath) {
                        console.log(`[P2P] Remote card has file, requesting: ${data.packet.filePath}`);
                        this.sendToPeer(peerId, {
                            type: 'request-file',
                            packetId: data.packet.id,
                            nodeId: data.packet.sourceNodeId
                        });
                    }
                }
                break;

            case 'chat-message':
                this.notify('chat-message', { ...data, peerId });
                break;

            case 'file-start':
                this.fileChunks.set(data.transferId, {
                    info: data,
                    chunks: []
                });
                break;
            case 'file-chunk':
                const entry = this.fileChunks.get(data.transferId);
                if (entry) {
                    entry.chunks.push(data.chunk); // Base64 chunk
                    // Check progress?
                    this.notify('file-progress', {
                        transferId: data.transferId,
                        total: entry.info.totalChunks,
                        current: entry.chunks.length
                    });
                }
                break;
            case 'file-end':
                this.finalizeFileTransfer(data.transferId);
                break;

            default:
                // Forward other events
                this.notify(data.type, { ...data, peerId });
        }
    }

    sendProjectSnapshot(peerId) {
        if (!this.hostedProject) return;

        const currentDrawings = window.drawingSystem ? window.drawingSystem.getDrawingsData() : [];

        this.sendToPeer(peerId, {
            type: 'project-data',
            project: { ...this.hostedProject.data, drawings: currentDrawings },
            operations: this.operationLog?.operations || []
        });
    }

    // ========== File Transfer ==========

    async sendFile(file, nodeId, targetPeerId = null) {
        const transferId = crypto.randomUUID();
        const chunkSize = 16 * 1024; // 16KB chunks
        const totalChunks = Math.ceil(file.size / chunkSize);

        // 1. Send Start Info
        const startMsg = {
            type: 'file-start',
            transferId,
            nodeId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            totalChunks
        };

        if (targetPeerId) {
            this.sendToPeer(targetPeerId, startMsg);
        } else {
            this.broadcast(startMsg);
        }

        // 2. Read and Send Chunks
        const reader = new FileReader();
        let offset = 0;
        let chunkIndex = 0;

        const readNextChunk = () => {
            const slice = file.slice(offset, offset + chunkSize);
            reader.readAsDataURL(slice);
        };

        reader.onload = (e) => {
            const base64Data = e.target.result.split(',')[1];

            const chunkMsg = {
                type: 'file-chunk',
                transferId,
                chunkIndex,
                chunk: base64Data
            };

            if (targetPeerId) {
                this.sendToPeer(targetPeerId, chunkMsg);
            } else {
                this.broadcast(chunkMsg);
            }

            offset += chunkSize;
            chunkIndex++;

            if (offset < file.size) {
                // Yield to main thread
                setTimeout(readNextChunk, 5);
            } else {
                // 3. Send End
                const endMsg = { type: 'file-end', transferId };
                if (targetPeerId) {
                    this.sendToPeer(targetPeerId, endMsg);
                } else {
                    this.broadcast(endMsg);
                }
                console.log(`[P2P] File sent: ${file.name}`);
            }
        };

        readNextChunk();
    }

    finalizeFileTransfer(transferId) {
        const entry = this.fileChunks.get(transferId);
        if (!entry) return;

        const { info, chunks } = entry;
        console.log(`[P2P] File received: ${info.fileName}`);

        // Reassemble
        const blob = this.base64ToBlob(chunks, info.fileType);
        const file = new File([blob], info.fileName, { type: info.fileType });

        // Save to DataCardStore
        if (window.dataCardStore) {
            window.dataCardStore.addPacket(info.nodeId, {
                type: 'file',
                file: file, // Store handles file obj
                fileName: info.fileName
            }, 'remote');
        }

        this.fileChunks.delete(transferId);
    }

    async handleFileRequest(data, peerId) {
        // data: { type: 'request-file', packetId, nodeId }
        if (!window.dataCardStore) return;

        const outgoing = window.dataCardStore.getOutgoingPackets(data.nodeId);
        const packet = outgoing.find(p => p.id === data.packetId);

        if (packet && packet.filePath) {
            // We have the file info. We need to read it from disk.
            // Since we are in renderer, we need IPC to read file as blob/buffer
            try {
                // Request file read from Main Process
                const fileData = await window.electronAPI.readFile(packet.filePath);
                if (fileData) {
                    // Create a Blob/File object to send
                    // fileData could be base64 or buffer. Let's assume IPC returns base64 or we handle it.
                    // IMPORTANT: sendFile expects a File/Blob object.
                    // Construct it:
                    const blob = this.base64ToBlob([fileData.content], packet.type === 'image' ? 'image/png' : 'application/octet-stream');
                    const file = new File([blob], packet.fileName || 'download', { type: packet.type === 'image' ? 'image/png' : 'application/octet-stream' });

                    this.sendFile(file, data.nodeId, peerId); // Send ONLY to requester
                }
            } catch (e) {
                console.error('[P2P] Failed to read file for request:', e);
            }
        }
    }

    base64ToBlob(chunks, mimeType) {
        const byteCharacters = chunks.map(atob).join('');
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    // ========== Helpers ==========

    handleRemoteOperation(operation, fromPeerId) {
        if (!this.operationLog) return;
        const toApply = this.operationLog.merge([operation]);
        if (toApply.length > 0) {
            this.notify('apply-operations', { operations: toApply });
            if (this.isHost) {
                this.broadcast({ type: 'operation', operation }, fromPeerId);
            }
        }
    }

    on(callback) { this.listeners.add(callback); }
    notify(e, d) { this.listeners.forEach(cb => cb(e, d)); }

    // ========== Media / Voice ==========

    addLocalStream(stream) {
        this.localStream = stream;

        // Add tracks to all existing peers
        this.peers.forEach((peer, peerId) => {
            if (peer.conn) {
                stream.getTracks().forEach(track => {
                    peer.conn.addTrack(track, stream);
                });

                // Renegotiate (Simplest way usually requires new offer)
                // For this implementation, assume renegotiation triggered by addTrack or do manual
                // But addTrack needs renegotiation.
                // Let's force offer if we are initiator, or send 'request-renegotiation'
                if (true) { // Always try to renegotiate
                    this.performRenegotiation(peerId, peer.conn);
                }
            }
        });
    }

    removeLocalStream() {
        if (!this.localStream) return;

        this.peers.forEach((peer) => {
            const senders = peer.conn.getSenders();
            senders.forEach(sender => {
                if (sender.track && this.localStream.getTracks().includes(sender.track)) {
                    peer.conn.removeTrack(sender);
                }
            });
        });
        this.localStream = null;
    }

    async performRenegotiation(targetPeerId, pc) {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.socket.send(JSON.stringify({
                type: 'OFFER',
                targetUserId: targetPeerId,
                offer: offer
            }));
        } catch (e) { console.error('[P2P] Renegotiation failed', e); }
    }

    // Existing Lock/Unlock methods...
    lockNode(nodeId) {
        const userId = this.peerId;
        if (this.nodeLocks.has(nodeId) && this.nodeLocks.get(nodeId) !== userId) return false;
        this.nodeLocks.set(nodeId, userId);
        this.broadcast({ type: 'lock-node', nodeId, userId });
        return true;
    }

    unlockNode(nodeId) {
        if (this.nodeLocks.get(nodeId) === this.peerId) {
            this.nodeLocks.delete(nodeId);
            this.broadcast({ type: 'unlock-node', nodeId });
        }
    }
}

// Initialize
let p2pManager = null;
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        p2pManager = new P2PManager();
        window.p2pManager = p2pManager;
        window.dispatchEvent(new CustomEvent('p2p-ready'));
    }, 1000);
});
window.P2PManager = P2PManager;
