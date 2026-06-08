"use strict";
// ─── Interfaces ───────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketServer = exports.DISCONNECT_MESSAGE = void 0;
// ─── Disconnect message ───────────────────────────────────────────────────────
exports.DISCONNECT_MESSAGE = JSON.stringify({ state: 'Disconnected' });
// ─── WebSocketServer ──────────────────────────────────────────────────────────
class WebSocketServer {
    constructor(pubSub, replayStore, channels = ['logs', 'breaks']) {
        this.pubSub = pubSub;
        this.replayStore = replayStore;
        this.channels = channels;
        this.clients = new Set();
        for (const channel of this.channels) {
            this.pubSub.subscribe(channel, (message) => {
                this.handleMessage(channel, message);
            });
        }
    }
    addClient(client) {
        this.clients.add(client);
    }
    removeClient(client) {
        this.clients.delete(client);
        try {
            client.send(exports.DISCONNECT_MESSAGE);
        }
        catch {
            // client may already be closed
        }
    }
    handleMessage(channel, message) {
        const envelope = JSON.stringify({ channel, data: JSON.parse(message) });
        for (const client of this.clients) {
            try {
                client.send(envelope);
            }
            catch {
                // skip unresponsive clients
            }
        }
        // fire-and-forget store
        this.replayStore.store(channel, message, new Date()).catch(() => { });
    }
    async replayMissedEvents(client, since) {
        for (const channel of this.channels) {
            const messages = await this.replayStore.getRecent(channel, since);
            for (const message of messages) {
                const envelope = JSON.stringify({ channel, data: JSON.parse(message) });
                try {
                    client.send(envelope);
                }
                catch {
                    // skip if client closed mid-replay
                }
            }
        }
    }
    getClientCount() {
        return this.clients.size;
    }
}
exports.WebSocketServer = WebSocketServer;
//# sourceMappingURL=wsServer.js.map