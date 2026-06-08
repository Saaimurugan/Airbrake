"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wsServer_1 = require("../wsServer");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeClient() {
    const messages = [];
    return {
        messages,
        isAlive: true,
        send(data) {
            messages.push(data);
        },
    };
}
function makePubSub() {
    const handlers = new Map();
    return {
        handlers,
        subscribe(channel, handler) {
            handlers.set(channel, handler);
        },
        unsubscribe(channel) {
            handlers.delete(channel);
        },
        emit(channel, msg) {
            handlers.get(channel)?.(msg);
        },
    };
}
function makeReplayStore() {
    const stored = [];
    return {
        stored,
        async store(channel, message, timestamp) {
            stored.push({ channel, message, timestamp });
        },
        async getRecent(channel, since) {
            return stored
                .filter((e) => e.channel === channel && e.timestamp >= since)
                .map((e) => e.message);
        },
    };
}
// ─── Tests ────────────────────────────────────────────────────────────────────
describe('WebSocketServer', () => {
    let pubSub;
    let replayStore;
    let server;
    beforeEach(() => {
        pubSub = makePubSub();
        replayStore = makeReplayStore();
        server = new wsServer_1.WebSocketServer(pubSub, replayStore);
    });
    describe('addClient', () => {
        it('registers a client so it receives subsequent messages', () => {
            const client = makeClient();
            server.addClient(client);
            expect(server.getClientCount()).toBe(1);
        });
    });
    describe('handleMessage', () => {
        it('fans out to a single connected client', () => {
            const client = makeClient();
            server.addClient(client);
            const payload = JSON.stringify({ id: '1', message: 'hello' });
            server.handleMessage('logs', payload);
            expect(client.messages).toHaveLength(1);
            const parsed = JSON.parse(client.messages[0]);
            expect(parsed.channel).toBe('logs');
            expect(parsed.data).toEqual({ id: '1', message: 'hello' });
        });
        it('fans out to multiple clients simultaneously', () => {
            const c1 = makeClient();
            const c2 = makeClient();
            const c3 = makeClient();
            server.addClient(c1);
            server.addClient(c2);
            server.addClient(c3);
            const payload = JSON.stringify({ id: '42' });
            server.handleMessage('breaks', payload);
            for (const client of [c1, c2, c3]) {
                expect(client.messages).toHaveLength(1);
                expect(JSON.parse(client.messages[0]).channel).toBe('breaks');
            }
        });
        it('stores the message in the replay store', async () => {
            const payload = JSON.stringify({ id: 'x' });
            server.handleMessage('logs', payload);
            // allow the fire-and-forget store to settle
            await new Promise((r) => setTimeout(r, 10));
            expect(replayStore.stored).toHaveLength(1);
            expect(replayStore.stored[0].channel).toBe('logs');
            expect(replayStore.stored[0].message).toBe(payload);
        });
    });
    describe('removeClient', () => {
        it('sends a Disconnected state message to the removed client', () => {
            const client = makeClient();
            server.addClient(client);
            server.removeClient(client);
            expect(client.messages).toHaveLength(1);
            expect(client.messages[0]).toBe(wsServer_1.DISCONNECT_MESSAGE);
            const parsed = JSON.parse(client.messages[0]);
            expect(parsed.state).toBe('Disconnected');
        });
        it('removes the client from the fan-out list', () => {
            const client = makeClient();
            server.addClient(client);
            server.removeClient(client);
            expect(server.getClientCount()).toBe(0);
            // subsequent messages should not reach the removed client
            server.handleMessage('logs', JSON.stringify({ id: '1' }));
            // only the disconnect message was sent, no new messages
            expect(client.messages).toHaveLength(1);
        });
    });
    describe('replayMissedEvents', () => {
        it('sends missed events from the logs channel to a reconnecting client', async () => {
            const since = new Date(Date.now() - 5000);
            // pre-populate the replay store
            await replayStore.store('logs', JSON.stringify({ id: 'log-1' }), new Date());
            await replayStore.store('logs', JSON.stringify({ id: 'log-2' }), new Date());
            const client = makeClient();
            await server.replayMissedEvents(client, since);
            expect(client.messages).toHaveLength(2);
            expect(JSON.parse(client.messages[0]).channel).toBe('logs');
            expect(JSON.parse(client.messages[0]).data).toEqual({ id: 'log-1' });
            expect(JSON.parse(client.messages[1]).data).toEqual({ id: 'log-2' });
        });
        it('sends events from both logs and breaks channels on reconnect', async () => {
            const since = new Date(Date.now() - 5000);
            await replayStore.store('logs', JSON.stringify({ id: 'log-1' }), new Date());
            await replayStore.store('breaks', JSON.stringify({ id: 'break-1' }), new Date());
            const client = makeClient();
            await server.replayMissedEvents(client, since);
            const channels = client.messages.map((m) => JSON.parse(m).channel);
            expect(channels).toContain('logs');
            expect(channels).toContain('breaks');
            expect(client.messages).toHaveLength(2);
        });
    });
});
//# sourceMappingURL=wsServer.test.js.map