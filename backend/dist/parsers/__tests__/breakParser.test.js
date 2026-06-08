"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const breakParser_1 = require("../breakParser");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeWriter() {
    const calls = [];
    const writer = {
        write: async (raw, msg) => { calls.push({ raw, msg }); },
    };
    return { writer, calls };
}
const validPayload = {
    id: 'break-1',
    applicationId: 'app-a',
    environment: 'production',
    severity: 'error',
    errorMessage: 'TypeError: Cannot read property of undefined',
    stackTrace: 'at Object.<anonymous> (/app/index.js:10:5)',
    fingerprint: 'abc123',
    timestamp: '2024-01-15T10:00:00.000Z',
    endpoint: '/api/users',
    requestPayload: { method: 'GET' },
    userSession: { userId: 'u-1' },
};
// ─── parseBreak — happy path ──────────────────────────────────────────────────
describe('parseBreak — valid payloads', () => {
    it('parses a complete valid payload', async () => {
        const result = await (0, breakParser_1.parseBreak)(validPayload);
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.id).toBe('break-1');
        expect(result.record.applicationId).toBe('app-a');
        expect(result.record.environment).toBe('production');
        expect(result.record.severity).toBe('error');
        expect(result.record.errorMessage).toBe('TypeError: Cannot read property of undefined');
        expect(result.record.stackTrace).toBe('at Object.<anonymous> (/app/index.js:10:5)');
        expect(result.record.fingerprint).toBe('abc123');
        expect(result.record.timestamp).toBeInstanceOf(Date);
        expect(result.record.timestamp.toISOString()).toBe('2024-01-15T10:00:00.000Z');
        expect(result.record.endpoint).toBe('/api/users');
        expect(result.record.requestPayload).toEqual({ method: 'GET' });
        expect(result.record.userSession).toEqual({ userId: 'u-1' });
    });
    it('accepts a Date object as timestamp', async () => {
        const ts = new Date('2024-06-01T00:00:00.000Z');
        const result = await (0, breakParser_1.parseBreak)({ ...validPayload, timestamp: ts });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.timestamp).toEqual(ts);
    });
    it('accepts a numeric timestamp (epoch ms)', async () => {
        const ts = new Date('2024-06-01T00:00:00.000Z');
        const result = await (0, breakParser_1.parseBreak)({ ...validPayload, timestamp: ts.getTime() });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.timestamp.getTime()).toBe(ts.getTime());
    });
    it('accepts all valid severities', async () => {
        for (const sev of ['info', 'warning', 'error', 'critical']) {
            const result = await (0, breakParser_1.parseBreak)({ ...validPayload, severity: sev });
            expect(result.success).toBe(true);
        }
    });
    it('defaults endpoint to null when missing', async () => {
        const { endpoint: _e, ...noEndpoint } = validPayload;
        const result = await (0, breakParser_1.parseBreak)(noEndpoint);
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.endpoint).toBeNull();
    });
    it('defaults requestPayload to null when missing', async () => {
        const { requestPayload: _r, ...noReq } = validPayload;
        const result = await (0, breakParser_1.parseBreak)(noReq);
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.requestPayload).toBeNull();
    });
    it('defaults userSession to null when missing', async () => {
        const { userSession: _u, ...noSession } = validPayload;
        const result = await (0, breakParser_1.parseBreak)(noSession);
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.userSession).toBeNull();
    });
    it('sets optional fields to null when wrong type', async () => {
        const result = await (0, breakParser_1.parseBreak)({
            ...validPayload,
            endpoint: 42,
            requestPayload: 'not-an-object',
            userSession: [1, 2, 3],
        });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.endpoint).toBeNull();
        expect(result.record.requestPayload).toBeNull();
        expect(result.record.userSession).toBeNull();
    });
    it('trims whitespace from id, applicationId, environment, fingerprint', async () => {
        const result = await (0, breakParser_1.parseBreak)({
            ...validPayload,
            id: '  break-1  ',
            applicationId: '  app-a  ',
            environment: '  production  ',
            fingerprint: '  abc123  ',
        });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.id).toBe('break-1');
        expect(result.record.applicationId).toBe('app-a');
        expect(result.record.environment).toBe('production');
        expect(result.record.fingerprint).toBe('abc123');
    });
});
// ─── parseBreak — malformed payloads ─────────────────────────────────────────
describe('parseBreak — malformed payloads', () => {
    it('returns error for null payload', async () => {
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)(null, writer);
        expect(result.success).toBe(false);
        expect(calls).toHaveLength(1);
    });
    it('returns error for non-object payload', async () => {
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)('not an object', writer);
        expect(result.success).toBe(false);
        expect(calls).toHaveLength(1);
    });
    it('returns error for array payload', async () => {
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)([], writer);
        expect(result.success).toBe(false);
        expect(calls).toHaveLength(1);
    });
    it('returns error when id is missing', async () => {
        const { id: _id, ...noId } = validPayload;
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)(noId, writer);
        expect(result.success).toBe(false);
        if (result.success)
            return;
        expect(result.error).toContain('id');
        expect(calls).toHaveLength(1);
    });
    it('returns error when applicationId is missing', async () => {
        const { applicationId: _a, ...noApp } = validPayload;
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)(noApp, writer);
        expect(result.success).toBe(false);
        if (result.success)
            return;
        expect(result.error).toContain('applicationId');
        expect(calls).toHaveLength(1);
    });
    it('returns error when environment is missing', async () => {
        const { environment: _e, ...noEnv } = validPayload;
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)(noEnv, writer);
        expect(result.success).toBe(false);
        if (result.success)
            return;
        expect(result.error).toContain('environment');
        expect(calls).toHaveLength(1);
    });
    it('returns error for invalid severity', async () => {
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)({ ...validPayload, severity: 'debug' }, writer);
        expect(result.success).toBe(false);
        if (result.success)
            return;
        expect(result.error).toContain('severity');
        expect(calls).toHaveLength(1);
    });
    it('returns error when errorMessage is missing', async () => {
        const { errorMessage: _em, ...noMsg } = validPayload;
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)(noMsg, writer);
        expect(result.success).toBe(false);
        if (result.success)
            return;
        expect(result.error).toContain('errorMessage');
        expect(calls).toHaveLength(1);
    });
    it('returns error when stackTrace is missing', async () => {
        const { stackTrace: _st, ...noStack } = validPayload;
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)(noStack, writer);
        expect(result.success).toBe(false);
        if (result.success)
            return;
        expect(result.error).toContain('stackTrace');
        expect(calls).toHaveLength(1);
    });
    it('returns error when fingerprint is missing', async () => {
        const { fingerprint: _fp, ...noFp } = validPayload;
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)(noFp, writer);
        expect(result.success).toBe(false);
        if (result.success)
            return;
        expect(result.error).toContain('fingerprint');
        expect(calls).toHaveLength(1);
    });
    it('returns error for invalid timestamp string', async () => {
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)({ ...validPayload, timestamp: 'not-a-date' }, writer);
        expect(result.success).toBe(false);
        expect(calls).toHaveLength(1);
    });
    it('returns error when timestamp is missing', async () => {
        const { timestamp: _ts, ...noTs } = validPayload;
        const { writer, calls } = makeWriter();
        const result = await (0, breakParser_1.parseBreak)(noTs, writer);
        expect(result.success).toBe(false);
        if (result.success)
            return;
        expect(result.error).toContain('timestamp');
        expect(calls).toHaveLength(1);
    });
    it('does not throw on empty object', async () => {
        const { writer } = makeWriter();
        await expect((0, breakParser_1.parseBreak)({}, writer)).resolves.toMatchObject({ success: false });
    });
    it('writes to errorWriter exactly once per malformed payload', async () => {
        const { writer, calls } = makeWriter();
        await (0, breakParser_1.parseBreak)({ ...validPayload, id: '' }, writer);
        expect(calls).toHaveLength(1);
    });
});
// ─── serializeBreak ───────────────────────────────────────────────────────────
describe('serializeBreak', () => {
    it('serializes a Break to JSON with ISO timestamp', () => {
        const record = {
            id: 'break-1',
            applicationId: 'app-a',
            environment: 'production',
            severity: 'error',
            errorMessage: 'Something went wrong',
            stackTrace: 'at foo (/app/foo.js:1:1)',
            endpoint: '/api/data',
            requestPayload: { q: 1 },
            userSession: null,
            timestamp: new Date('2024-01-15T10:00:00.000Z'),
            fingerprint: 'fp-1',
        };
        const json = (0, breakParser_1.serializeBreak)(record);
        const parsed = JSON.parse(json);
        expect(parsed.id).toBe('break-1');
        expect(parsed.timestamp).toBe('2024-01-15T10:00:00.000Z');
        expect(parsed.endpoint).toBe('/api/data');
        expect(parsed.userSession).toBeNull();
    });
    it('produces valid JSON', () => {
        const record = {
            id: 'x',
            applicationId: 'y',
            environment: 'qa',
            severity: 'warning',
            errorMessage: 'err',
            stackTrace: 'stack',
            endpoint: null,
            requestPayload: null,
            userSession: null,
            timestamp: new Date(),
            fingerprint: 'fp',
        };
        expect(() => JSON.parse((0, breakParser_1.serializeBreak)(record))).not.toThrow();
    });
});
// ─── round-trip ───────────────────────────────────────────────────────────────
describe('parse → serialize → parse round-trip', () => {
    it('produces an equivalent record', async () => {
        const result1 = await (0, breakParser_1.parseBreak)(validPayload);
        expect(result1.success).toBe(true);
        if (!result1.success)
            return;
        const json = (0, breakParser_1.serializeBreak)(result1.record);
        const result2 = await (0, breakParser_1.parseBreak)(JSON.parse(json));
        expect(result2.success).toBe(true);
        if (!result2.success)
            return;
        expect(result2.record).toEqual(result1.record);
    });
    it('round-trips a Break with null optional fields', async () => {
        const minimalPayload = {
            id: 'break-min',
            applicationId: 'app-b',
            environment: 'development',
            severity: 'info',
            errorMessage: 'Minimal error',
            stackTrace: 'at bar (/app/bar.js:2:2)',
            fingerprint: 'fp-min',
            timestamp: '2024-03-01T00:00:00.000Z',
        };
        const result1 = await (0, breakParser_1.parseBreak)(minimalPayload);
        expect(result1.success).toBe(true);
        if (!result1.success)
            return;
        const json = (0, breakParser_1.serializeBreak)(result1.record);
        const result2 = await (0, breakParser_1.parseBreak)(JSON.parse(json));
        expect(result2.success).toBe(true);
        if (!result2.success)
            return;
        expect(result2.record).toEqual(result1.record);
    });
});
//# sourceMappingURL=breakParser.test.js.map