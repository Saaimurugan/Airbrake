"use strict";
/**
 * Integration tests for end-to-end flows.
 * Requirements: 1.1, 2.2, 5.1
 *
 * These tests wire real service instances together with in-memory stubs
 * to verify the full data flow without external dependencies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const alertEngine_1 = require("../alerts/alertEngine");
const logPipeline_1 = require("../pipeline/logPipeline");
const wsServer_1 = require("../websocket/wsServer");
// ─── In-memory stubs ──────────────────────────────────────────────────────────
function makeInMemoryRedis() {
    const messages = {};
    const handlers = {};
    return {
        publish: jest.fn(async (channel, message) => {
            if (!messages[channel])
                messages[channel] = [];
            messages[channel].push(message);
            (handlers[channel] ?? []).forEach((h) => h(message));
        }),
        subscribe: jest.fn((channel, handler) => {
            if (!handlers[channel])
                handlers[channel] = [];
            handlers[channel].push(handler);
        }),
        unsubscribe: jest.fn(),
        getMessages: (channel) => messages[channel] ?? [],
    };
}
function makeReplayStore() {
    const stored = [];
    return {
        store: jest.fn(async (channel, message, timestamp) => {
            stored.push({ channel, message, timestamp });
        }),
        getRecent: jest.fn(async (channel, since) => stored
            .filter((e) => e.channel === channel && e.timestamp >= since)
            .map((e) => e.message)),
        stored,
    };
}
// ─── Flow 1: Log ingestion → stream delivery ──────────────────────────────────
describe('Flow: Log ingestion → stream delivery', () => {
    it('ingested log is published to Redis and delivered to WebSocket clients', async () => {
        const redis = makeInMemoryRedis();
        const replayStore = makeReplayStore();
        const savedLogs = [];
        const indexedLogs = [];
        const parseErrors = [];
        const pipeline = (0, logPipeline_1.createLogPipeline)({ save: jest.fn(async (r) => { savedLogs.push(r); }) }, { indexLogRecord: jest.fn(async (r) => { indexedLogs.push(r); }) }, redis, { save: jest.fn(async (raw, msg) => { parseErrors.push({ raw, msg }); }) });
        const wsServer = new wsServer_1.WebSocketServer(redis, replayStore);
        const receivedMessages = [];
        const mockClient = { send: jest.fn((msg) => { receivedMessages.push(msg); }), isAlive: true };
        wsServer.addClient(mockClient);
        const rawPayload = {
            id: 'log-integration-1',
            applicationId: 'app-integration',
            environment: 'production',
            severity: 'error',
            message: 'Integration test log',
            timestamp: new Date().toISOString(),
            tags: ['test'],
            rawPayload: {},
        };
        await pipeline.ingest(rawPayload);
        // Log should be saved to PG and indexed in ES
        expect(savedLogs).toHaveLength(1);
        expect(indexedLogs).toHaveLength(1);
        expect(parseErrors).toHaveLength(0);
        // Log should be published to Redis
        expect(redis.publish).toHaveBeenCalledWith('logs', expect.any(String));
        // WebSocket client should receive the message
        expect(receivedMessages).toHaveLength(1);
        const envelope = JSON.parse(receivedMessages[0]);
        expect(envelope.channel).toBe('logs');
        expect(envelope.data.message).toBe('Integration test log');
    });
    it('malformed log payload writes to parse_errors and does not crash pipeline', async () => {
        const redis = makeInMemoryRedis();
        const replayStore = makeReplayStore();
        const parseErrors = [];
        const pipeline = (0, logPipeline_1.createLogPipeline)({ save: jest.fn() }, { indexLogRecord: jest.fn() }, redis, { save: jest.fn(async (raw, msg) => { parseErrors.push({ raw, msg }); }) });
        await pipeline.ingest({ invalid: true }); // missing required fields
        expect(parseErrors).toHaveLength(1);
        expect(redis.publish).not.toHaveBeenCalled();
    });
});
// ─── Flow 2: Break ingestion → aggregation → alert dispatch ──────────────────
describe('Flow: Break ingestion → aggregation → alert dispatch', () => {
    it('new break triggers alert when threshold is met', async () => {
        const dispatched = [];
        const failed = [];
        const alertEngine = new alertEngine_1.AlertEngine({ countBreaksInWindow: jest.fn(async () => 5) }, // count = 5 >= threshold 3
        { send: jest.fn(async (ch, ev) => { dispatched.push({ channel: ch, event: ev }); }) }, { markFailed: jest.fn(async (ruleId) => { failed.push(ruleId); }) }, async () => { });
        const rule = {
            id: 'rule-integration-1',
            name: 'High Error Rate',
            threshold: 3,
            windowSeconds: 60,
            triggerOnNewError: false,
            channels: [{ type: 'webhook', url: 'https://example.com/hook' }],
            createdBy: 'user-1',
            enabled: true,
        };
        await alertEngine.evaluate([rule]);
        expect(dispatched).toHaveLength(1);
        expect(dispatched[0].channel).toEqual({ type: 'webhook', url: 'https://example.com/hook' });
        expect(failed).toHaveLength(0);
    });
    it('new error break triggers alert when triggerOnNewError is set', async () => {
        const dispatched = [];
        const alertEngine = new alertEngine_1.AlertEngine({ countBreaksInWindow: jest.fn(async () => 0) }, // below threshold
        { send: jest.fn(async (_ch, ev) => { dispatched.push(ev); }) }, { markFailed: jest.fn() }, async () => { });
        const rule = {
            id: 'rule-integration-2',
            name: 'New Error Alert',
            threshold: 100,
            windowSeconds: 60,
            triggerOnNewError: true,
            channels: [{ type: 'slack', webhookUrl: 'https://hooks.slack.com/test' }],
            createdBy: 'user-1',
            enabled: true,
        };
        const newBreak = {
            id: 'break-new-1',
            applicationId: 'app-a',
            environment: 'production',
            severity: 'error',
            errorMessage: 'New error type',
            stackTrace: 'at foo (foo.ts:1)',
            endpoint: null,
            requestPayload: null,
            userSession: null,
            timestamp: new Date(),
            fingerprint: 'unique-fingerprint-xyz',
        };
        await alertEngine.evaluate([rule], newBreak, 'new');
        expect(dispatched).toHaveLength(1);
    });
    it('disabled rule is not evaluated', async () => {
        const dispatched = [];
        const alertEngine = new alertEngine_1.AlertEngine({ countBreaksInWindow: jest.fn(async () => 999) }, { send: jest.fn(async (_ch, ev) => { dispatched.push(ev); }) }, { markFailed: jest.fn() }, async () => { });
        const disabledRule = {
            id: 'rule-disabled',
            name: 'Disabled Rule',
            threshold: 1,
            windowSeconds: 60,
            triggerOnNewError: false,
            channels: [{ type: 'email', address: 'ops@example.com' }],
            createdBy: 'user-1',
            enabled: false,
        };
        await alertEngine.evaluate([disabledRule]);
        expect(dispatched).toHaveLength(0);
    });
});
//# sourceMappingURL=integration.test.js.map