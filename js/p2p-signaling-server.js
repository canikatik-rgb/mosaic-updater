const WebSocket = require('ws');
const { app, ipcMain } = require('electron');
const os = require('os');

// Configuration
const PORT = 3000;

class P2PSignalingServer {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // ws -> { id, roomId }
        this.rooms = new Map();   // roomId -> Set(ws)
        this.roomDetails = new Map(); // roomId -> { projectName, hostId }
        this.init();
    }

    init() {
        this.wss = new WebSocket.Server({ port: PORT });
        console.log(`[SignalingServer] Started on port ${PORT}`);
        console.log(`[SignalingServer] Local IP: ${this.getLocalIP()}`);

        this.wss.on('connection', (ws) => {
            console.log('[SignalingServer] Client connected');

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data);
                } catch (err) {
                    console.error('[SignalingServer] Invalid message:', err);
                }
            });

            ws.on('close', () => {
                this.handleDisconnect(ws);
            });

            ws.on('error', (err) => {
                console.error('[SignalingServer] Socket error:', err);
            });
        });
    }

    handleMessage(ws, data) {
        const { type } = data;

        switch (type) {
            case 'JOIN_ROOM':
                this.joinRoom(ws, data);
                break;

            case 'LIST_ROOMS':
                this.listRooms(ws);
                break;

            case 'OFFER':
            case 'ANSWER':
            case 'ICE_CANDIDATE':
                this.forwardSignal(ws, data);
                break;

            default:
                console.warn('[SignalingServer] Unknown message type:', type);
        }
    }

    joinRoom(ws, data) {
        const { roomId, userId, projectName } = data;
        if (!roomId || !userId) return;

        // Store client info
        this.clients.set(ws, { id: userId, roomId });

        // Create room if not exists
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
            // If projectName provided (likely by host), store details
            if (projectName) {
                this.roomDetails.set(roomId, { projectName, hostId: userId });
            }
        }

        const room = this.rooms.get(roomId);
        room.add(ws);

        console.log(`[SignalingServer] User ${userId} joined room ${roomId}`);

        // Notify others in room
        this.broadcastToRoom(ws, roomId, {
            type: 'USER_JOINED',
            userId: userId
        });
    }

    listRooms(ws) {
        const roomsList = [];
        for (const [roomId, details] of this.roomDetails) {
            roomsList.push({
                roomId,
                projectName: details.projectName || 'Untitled',
                hostId: details.hostId
            });
        }

        ws.send(JSON.stringify({
            type: 'ROOM_LIST',
            rooms: roomsList
        }));
    }

    forwardSignal(senderWs, data) {
        const { targetUserId } = data;
        const senderInfo = this.clients.get(senderWs);

        if (!senderInfo) return;

        // Find target socket
        let targetWs = null;
        for (const [ws, info] of this.clients.entries()) {
            if (info.id === targetUserId && info.roomId === senderInfo.roomId) {
                targetWs = ws;
                break;
            }
        }

        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            // Forward signal with sender ID
            targetWs.send(JSON.stringify({
                ...data,
                senderUserId: senderInfo.id
            }));
        } else {
            console.warn(`[SignalingServer] Target user ${targetUserId} not found or disconnected`);
        }
    }

    handleDisconnect(ws) {
        const info = this.clients.get(ws);
        if (info) {
            const { id, roomId } = info;
            console.log(`[SignalingServer] User ${id} disconnected`);

            // Remove from room
            if (this.rooms.has(roomId)) {
                const room = this.rooms.get(roomId);
                room.delete(ws);

                // Notify others
                this.broadcastToRoom(ws, roomId, {
                    type: 'USER_LEFT',
                    userId: id
                });

                if (room.size === 0) {
                    this.rooms.delete(roomId);
                    this.roomDetails.delete(roomId);
                }
            }

            this.clients.delete(ws);
        }
    }

    broadcastToRoom(senderWs, roomId, message) {
        if (!this.rooms.has(roomId)) return;

        const room = this.rooms.get(roomId);
        const msgStr = JSON.stringify(message);

        for (const client of room) {
            if (client !== senderWs && client.readyState === WebSocket.OPEN) {
                client.send(msgStr);
            }
        }
    }

    getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }
}

// Start server if main process
if (process.type === 'browser') {
    new P2PSignalingServer();
}

module.exports = P2PSignalingServer;
