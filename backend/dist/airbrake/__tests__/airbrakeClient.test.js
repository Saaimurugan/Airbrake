"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const airbrakeClient_1 = require("../airbrakeClient");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeValidPayload(overrides = {}) {
    return {
        id: 'break-1',
        applicationId: 'app-123',
        environment: 'production',
        severity: 'error',
        errorMessage: 'TypeError: Cannot read property of undefined',
        stackTrace: 'at Object.<anonymous> (app.js:10:5)',
        fingerprint: 'abc123',
        timestamp: '2024-01-15T10:00:00Z',
        endpoint: '/api/users',
        requestPayload: null,
        userSession: null,
        ...overrides,
    };
}
function makeHttpClient(impl) {
    return { get: jest.fn(impl) };
}
function makeRedisPublisher() {
    const calls = [];
    const publisher = {
        publish: jest.fn(async (channel, message) => {
            calls.push({ channel, message });
        }),
    };
    return { publisher, calls };
}
function makeClient(httpClient, redisPublisher, pollIntervalMs = 5000) {
    return new airbrakeClient_1.AirbrakeClient({ apiKey: 'my-secret-api-key', projectId: 'proj-42', pollIntervalMs }, httpClient, redisPublisher);
}
// ─── Tests ────────────────────────────────────────────────────────────────────
describe('AirbrakeClient', () => {
    // ─── Retry Logic ────────────────────────────────────────────────────────────
    describe('retry logic', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());
        it('publishes a break when HTTP client fails twice then succeeds on 3rd attempt', async () => {
            const payload = makeValidPayload();
            let callCount = 0;
            const httpClient = makeHttpClient(async () => {
                callCount++;
                if (callCount < 3)
                    throw new Error('network error');
                return { groups: [payload] };
            });
            const { publisher, calls } = makeRedisPublisher();
            const client = makeClient(httpClient, publisher);
            // Start poll and advance timers to cover retry delays (1s + 2s)
            const pollPromise = client.poll();
            await jest.runAllTimersAsync();
            await pollPromise;
            expect(callCount).toBe(3);
            expect(calls).toHaveLength(1);
            expect(calls[0].channel).toBe('breaks');
        });
        it('does not publish and does not throw when all 3 retry attempts fail', async () => {
            const httpClient = makeHttpClient(async () => {
                throw new Error('persistent network error');
            });
            const { publisher, calls } = makeRedisPublisher();
            const client = makeClient(httpClient, publisher);
            // poll() should not throw even when all retries are exhausted
            const pollPromise = client.poll();
            await jest.runAllTimersAsync();
            await expect(pollPromise).resolves.toBeUndefined();
            expect(calls).toHaveLength(0);
        });
    });
    // ─── API Key Encryption ──────────────────────────────────────────────────────
    describe('API key encryption', () => {
        it('sends a Bearer token in the Authorization header (not the raw key without prefix)', async () => {
            let capturedHeaders = {};
            const httpClient = makeHttpClient(async (_url, headers) => {
                capturedHeaders = headers;
                return { groups: [] };
            });
            const { publisher } = makeRedisPublisher();
            const client = makeClient(httpClient, publisher);
            await client.poll();
            // The Authorization header must exist and be a Bearer token
            expect(capturedHeaders['Authorization']).toBeDefined();
            expect(capturedHeaders['Authorization']).toMatch(/^Bearer .+/);
        });
        it('stores the API key encrypted in memory (not as plaintext)', () => {
            const plainApiKey = 'my-secret-api-key';
            const { publisher } = makeRedisPublisher();
            const httpClient = makeHttpClient(async () => ({ groups: [] }));
            const client = makeClient(httpClient, publisher);
            // The internal encryptedApiKey field must not contain the plaintext key
            const encryptedField = client.encryptedApiKey;
            expect(encryptedField).toBeDefined();
            expect(encryptedField.ciphertext).not.toContain(plainApiKey);
            expect(encryptedField.iv).toBeTruthy();
            expect(encryptedField.tag).toBeTruthy();
        });
        it('encryptApiKey / decryptApiKey round-trips correctly', () => {
            const plaintext = 'super-secret-key-123';
            const passphrase = 'test-passphrase';
            const encrypted = (0, airbrakeClient_1.encryptApiKey)(plaintext, passphrase);
            expect(encrypted.iv).toBeTruthy();
            expect(encrypted.tag).toBeTruthy();
            expect(encrypted.ciphertext).toBeTruthy();
            // Ciphertext must not contain the plaintext
            expect(encrypted.ciphertext).not.toContain(plaintext);
            const decrypted = (0, airbrakeClient_1.decryptApiKey)(encrypted, passphrase);
            expect(decrypted).toBe(plaintext);
        });
    });
    // ─── Publish to Redis ────────────────────────────────────────────────────────
    describe('publish to Redis', () => {
        it('calls redisPublisher.publish with channel="breaks" and valid JSON for a valid break', async () => {
            const payload = makeValidPayload();
            const httpClient = makeHttpClient(async () => ({ groups: [payload] }));
            const { publisher, calls } = makeRedisPublisher();
            const client = makeClient(httpClient, publisher);
            await client.poll();
            expect(calls).toHaveLength(1);
            expect(calls[0].channel).toBe('breaks');
            // Must be valid JSON
            const parsed = JSON.parse(calls[0].message);
            expect(parsed.id).toBe('break-1');
            expect(parsed.applicationId).toBe('app-123');
            expect(parsed.severity).toBe('error');
        });
    });
    // ─── onBreak Handler ─────────────────────────────────────────────────────────
    describe('onBreak handler', () => {
        it('calls the registered handler with the parsed Break for a valid payload', async () => {
            const payload = makeValidPayload();
            const httpClient = makeHttpClient(async () => ({ groups: [payload] }));
            const { publisher } = makeRedisPublisher();
            const client = makeClient(httpClient, publisher);
            const received = [];
            client.onBreak((b) => received.push(b));
            await client.poll();
            expect(received).toHaveLength(1);
            expect(received[0].id).toBe('break-1');
            expect(received[0].applicationId).toBe('app-123');
            expect(received[0].timestamp).toBeInstanceOf(Date);
        });
        it('calls all registered handlers when multiple handlers are registered', async () => {
            const payload = makeValidPayload();
            const httpClient = makeHttpClient(async () => ({ groups: [payload] }));
            const { publisher } = makeRedisPublisher();
            const client = makeClient(httpClient, publisher);
            const received1 = [];
            const received2 = [];
            client.onBreak((b) => received1.push(b));
            client.onBreak((b) => received2.push(b));
            await client.poll();
            expect(received1).toHaveLength(1);
            expect(received2).toHaveLength(1);
            expect(received1[0].id).toBe(received2[0].id);
        });
    });
    // ─── Malformed Payload ───────────────────────────────────────────────────────
    describe('malformed payload', () => {
        it('does not publish and does not call handler for an invalid break payload', async () => {
            const badPayload = { id: 'break-bad', notAValidBreak: true };
            const httpClient = makeHttpClient(async () => ({ groups: [badPayload] }));
            const { publisher, calls } = makeRedisPublisher();
            const client = makeClient(httpClient, publisher);
            const received = [];
            client.onBreak((b) => received.push(b));
            await client.poll();
            expect(calls).toHaveLength(0);
            expect(received).toHaveLength(0);
        });
        it('processes valid items and skips invalid ones in the same batch', async () => {
            const validPayload = makeValidPayload();
            const badPayload = { id: 'bad', notValid: true };
            const httpClient = makeHttpClient(async () => ({ groups: [badPayload, validPayload] }));
            const { publisher, calls } = makeRedisPublisher();
            const client = makeClient(httpClient, publisher);
            const received = [];
            client.onBreak((b) => received.push(b));
            await client.poll();
            expect(calls).toHaveLength(1);
            expect(received).toHaveLength(1);
            expect(received[0].id).toBe('break-1');
        });
    });
    // ─── start() / stop() ────────────────────────────────────────────────────────
    describe('start() and stop()', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });
        afterEach(() => {
            jest.useRealTimers();
        });
        it('starts polling at the configured interval', async () => {
            const httpClient = makeHttpClient(async () => ({ groups: [] }));
            const { publisher } = makeRedisPublisher();
            const client = makeClient(httpClient, publisher, 1000);
            client.start();
            // Advance time by 3 intervals
            jest.advanceTimersByTime(3000);
            // Allow microtasks/promises to settle
            await Promise.resolve();
            expect(httpClient.get).toHaveBeenCalledTimes(3);
            client.stop();
        });
        it('stops polling after stop() is called', async () => {
            const httpClient = makeHttpClient(async () => ({ groups: [] }));
            const { publisher } = makeRedisPublisher();
            const client = makeClient(httpClient, publisher, 1000);
            client.start();
            jest.advanceTimersByTime(2000);
            await Promise.resolve();
            client.stop();
            // Advance further — no more calls expected
            jest.advanceTimersByTime(3000);
            await Promise.resolve();
            expect(httpClient.get).toHaveBeenCalledTimes(2);
        });
        it('calling start() twice does not double-poll', async () => {
            const httpClient = makeHttpClient(async () => ({ groups: [] }));
            const { publisher } = makeRedisPublisher();
            const client = makeClient(httpClient, publisher, 1000);
            client.start();
            client.start(); // second call should be a no-op
            jest.advanceTimersByTime(2000);
            await Promise.resolve();
            // Should still only poll once per interval, not twice
            expect(httpClient.get).toHaveBeenCalledTimes(2);
            client.stop();
        });
    });
});
//# sourceMappingURL=airbrakeClient.test.js.map