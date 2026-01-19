/**
 * ChatManager.js
 * Handles real-time text chat between P2P peers.
 */

class ChatManager {
    constructor() {
        this.messages = [];
        this.isOpen = false;
        this.unreadCount = 0;

        // DOM Elements
        this.panel = null;
        this.messagesContainer = null;
        this.input = null;
        this.badge = null;

        // Bindings
        this.sendMessage = this.sendMessage.bind(this);
    }

    init() {
        this.createUI();
        this.setupListeners();
    }

    createUI() {
        // 1. Chat Panel (Hidden by default)
        const panel = document.createElement('div');
        panel.id = 'chat-panel';
        panel.className = 'chat-panel hidden';
        panel.innerHTML = `
            <div class="chat-header">
                <h3>Team Chat</h3>
                <button id="chat-close-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="chat-messages" id="chat-messages">
                <div class="chat-empty-state">No messages yet.</div>
            </div>
            <div class="chat-input-area">
                <textarea id="chat-input" placeholder="Type a message..." rows="1"></textarea>
                <button id="chat-send-btn"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        document.body.appendChild(panel);

        this.panel = panel;
        this.messagesContainer = panel.querySelector('#chat-messages');
        this.input = panel.querySelector('#chat-input');

        // Close Button
        panel.querySelector('#chat-close-btn').addEventListener('click', () => this.toggle(false));

        // Send Button
        panel.querySelector('#chat-send-btn').addEventListener('click', () => this.sendMessage());

        // Input Enter Key
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    setupListeners() {
        // Listen to P2P Manager
        if (window.p2pManager) {
            window.p2pManager.on((event, data) => {
                if (event === 'chat-message') {
                    this.receiveMessage(data);
                }
            });
        }
    }

    toggle(forceState = null) {
        this.isOpen = forceState !== null ? forceState : !this.isOpen;
        this.panel.classList.toggle('hidden', !this.isOpen);

        if (this.isOpen) {
            this.unreadCount = 0;
            this.updateBadge();
            this.scrollToBottom();
            this.input.focus();
        }
    }

    updateBadge() {
        // This method will be called by Unified Bar or Custom Titlebar to update their badges
        const event = new CustomEvent('chat-badge-update', { detail: { count: this.unreadCount } });
        window.dispatchEvent(event);
    }

    sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        const user = window.getCurrentUser ? window.getCurrentUser() : { id: 'local', user_metadata: { full_name: 'Me' } };

        const message = {
            id: crypto.randomUUID(),
            text: text,
            senderId: window.p2pManager?.peerId || 'me',
            senderName: user.user_metadata?.full_name || 'Me',
            timestamp: Date.now()
        };

        // Add locally
        this.addMessageToUI(message, true);
        this.messages.push(message);

        // Send to peers
        if (window.p2pManager) {
            window.p2pManager.broadcast({
                type: 'chat-message',
                ...message
            });
        }

        this.input.value = '';
    }

    receiveMessage(data) {
        const message = {
            id: data.id,
            text: data.text,
            senderId: data.senderId,
            senderName: data.senderName,
            timestamp: data.timestamp
        };

        this.messages.push(message);
        this.addMessageToUI(message, false);

        if (!this.isOpen) {
            this.unreadCount++;
            this.updateBadge();

            // Play sound?
        }
    }

    addMessageToUI(msg, isMe) {
        const wasEmpty = this.messagesContainer.querySelector('.chat-empty-state');
        if (wasEmpty) wasEmpty.remove();

        const div = document.createElement('div');
        div.className = `chat-message ${isMe ? 'me' : 'other'}`;

        const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        div.innerHTML = `
            <div class="chat-message-header">
                <span class="chat-sender">${isMe ? 'You' : msg.senderName}</span>
                <span class="chat-time">${time}</span>
            </div>
            <div class="chat-text">${this.escapeHtml(msg.text)}</div>
        `;

        this.messagesContainer.appendChild(div);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global Instance
window.chatManager = new ChatManager();

function initChatManager() {
    if (window.p2pManager) {
        window.chatManager.init();
    } else {
        window.addEventListener('p2p-ready', () => {
            window.chatManager.init();
        }, { once: true });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Wait slightly to ensure DOM is ready, but rely on p2p-ready for logic
    setTimeout(initChatManager, 100);
});
