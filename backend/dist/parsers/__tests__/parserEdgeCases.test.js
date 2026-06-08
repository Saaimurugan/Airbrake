"use strict";
/**
 * Edge case tests for parseLogRecord and parseBreak.
 * Validates Requirement 10.3 — parsers must never throw and must handle
 * all malformed / extreme inputs gracefully.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const logParser_1 = require("../logParser");
const breakParser_1 = require("../breakParser");
// ─── Base valid payloads ──────────────────────────────────────────────────────
const validLog = {
    id: 'log-edge',
    applicationId: 'app-edge',
    environment: 'production',
    severity: 'info',
    message: 'baseline',
    timestamp: '2024-01-15T10:00:00.000Z',
};
const validBreak = {
    id: 'break-edge',
    applicationId: 'app-edge',
    environment: 'production',
    severity: 'error',
    errorMessage: 'baseline error',
    stackTrace: 'at foo (/app/foo.js:1:1)',
    fingerprint: 'fp-edge',
    timestamp: '2024-01-15T10:00:00.000Z',
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
const MAX_STRING = 'x'.repeat(10000);
const UNICODE_STRING = '日本語テスト 🚀 émojis \u0000 \uFFFF Arabic: مرحبا';
// ─── 1. Empty object ──────────────────────────────────────────────────────────
describe('empty object {}', () => {
    it('parseLogRecord returns { success: false }', async () => {
        const result = await (0, logParser_1.parseLogRecord)({});
        expect(result.success).toBe(false);
    });
    it('parseBreak returns { success: false }', async () => {
        const result = await (0, breakParser_1.parseBreak)({});
        expect(result.success).toBe(false);
    });
});
// ─── 2. Null payload ──────────────────────────────────────────────────────────
describe('null payload', () => {
    it('parseLogRecord returns { success: false }', async () => {
        const result = await (0, logParser_1.parseLogRecord)(null);
        expect(result.success).toBe(false);
    });
    it('parseBreak returns { success: false }', async () => {
        const result = await (0, breakParser_1.parseBreak)(null);
        expect(result.success).toBe(false);
    });
});
// ─── 3. Undefined payload ─────────────────────────────────────────────────────
describe('undefined payload', () => {
    it('parseLogRecord returns { success: false }', async () => {
        const result = await (0, logParser_1.parseLogRecord)(undefined);
        expect(result.success).toBe(false);
    });
    it('parseBreak returns { success: false }', async () => {
        const result = await (0, breakParser_1.parseBreak)(undefined);
        expect(result.success).toBe(false);
    });
});
// ─── 4. Maximum-length strings ────────────────────────────────────────────────
describe('maximum-length strings (10,000 chars)', () => {
    it('parseLogRecord succeeds with 10k-char message', async () => {
        const result = await (0, logParser_1.parseLogRecord)({ ...validLog, message: MAX_STRING });
        expect(result.success).toBe(true);
    });
    it('parseLogRecord succeeds with 10k-char id', async () => {
        const result = await (0, logParser_1.parseLogRecord)({ ...validLog, id: MAX_STRING });
        expect(result.success).toBe(true);
    });
    it('parseBreak succeeds with 10k-char errorMessage', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, errorMessage: MAX_STRING });
        expect(result.success).toBe(true);
    });
    it('parseBreak succeeds with 10k-char stackTrace', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, stackTrace: MAX_STRING });
        expect(result.success).toBe(true);
    });
    it('parseBreak succeeds with 10k-char fingerprint', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, fingerprint: MAX_STRING });
        expect(result.success).toBe(true);
    });
});
// ─── 5. Whitespace-only required string fields ────────────────────────────────
describe('whitespace-only required string fields', () => {
    it('parseLogRecord fails when id is only whitespace', async () => {
        const result = await (0, logParser_1.parseLogRecord)({ ...validLog, id: '   ' });
        expect(result.success).toBe(false);
    });
    it('parseLogRecord fails when applicationId is only whitespace', async () => {
        const result = await (0, logParser_1.parseLogRecord)({ ...validLog, applicationId: '   ' });
        expect(result.success).toBe(false);
    });
    it('parseBreak fails when id is only whitespace', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, id: '   ' });
        expect(result.success).toBe(false);
    });
    it('parseBreak fails when applicationId is only whitespace', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, applicationId: '   ' });
        expect(result.success).toBe(false);
    });
    it('parseBreak fails when environment is only whitespace', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, environment: '   ' });
        expect(result.success).toBe(false);
    });
    it('parseBreak fails when fingerprint is only whitespace', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, fingerprint: '   ' });
        expect(result.success).toBe(false);
    });
});
// ─── 6. Numeric 0 as timestamp (Unix epoch) ───────────────────────────────────
describe('numeric 0 as timestamp (epoch)', () => {
    it('parseLogRecord succeeds with timestamp = 0', async () => {
        const result = await (0, logParser_1.parseLogRecord)({ ...validLog, timestamp: 0 });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.timestamp.getTime()).toBe(0);
    });
    it('parseBreak succeeds with timestamp = 0', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, timestamp: 0 });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.timestamp.getTime()).toBe(0);
    });
});
// ─── 7. Very large numeric timestamp ─────────────────────────────────────────
describe('very large numeric timestamp', () => {
    // Year ~2255 — still a valid JS Date
    const LARGE_TS = 9000000000000;
    it('parseLogRecord succeeds with a very large timestamp', async () => {
        const result = await (0, logParser_1.parseLogRecord)({ ...validLog, timestamp: LARGE_TS });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.timestamp.getTime()).toBe(LARGE_TS);
    });
    it('parseBreak succeeds with a very large timestamp', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, timestamp: LARGE_TS });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.timestamp.getTime()).toBe(LARGE_TS);
    });
});
// ─── 8. Unicode characters ────────────────────────────────────────────────────
describe('unicode characters in string fields', () => {
    it('parseLogRecord succeeds with unicode message', async () => {
        const result = await (0, logParser_1.parseLogRecord)({ ...validLog, message: UNICODE_STRING });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.message).toBe(UNICODE_STRING);
    });
    it('parseBreak succeeds with unicode errorMessage', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, errorMessage: UNICODE_STRING });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.errorMessage).toBe(UNICODE_STRING);
    });
    it('parseBreak succeeds with unicode stackTrace', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, stackTrace: UNICODE_STRING });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.stackTrace).toBe(UNICODE_STRING);
    });
});
// ─── 9. Nested objects in rawPayload / requestPayload / userSession ───────────
describe('nested objects in optional payload fields', () => {
    const deepNested = {
        level1: { level2: { level3: { value: 42, arr: [1, 2, 3] } } },
    };
    it('parseLogRecord accepts deeply nested rawPayload', async () => {
        const result = await (0, logParser_1.parseLogRecord)({ ...validLog, rawPayload: deepNested });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.rawPayload).toEqual(deepNested);
    });
    it('parseBreak accepts deeply nested requestPayload', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, requestPayload: deepNested });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.requestPayload).toEqual(deepNested);
    });
    it('parseBreak accepts deeply nested userSession', async () => {
        const result = await (0, breakParser_1.parseBreak)({ ...validBreak, userSession: deepNested });
        expect(result.success).toBe(true);
        if (!result.success)
            return;
        expect(result.record.userSession).toEqual(deepNested);
    });
});
// ─── 10. Array as payload ─────────────────────────────────────────────────────
describe('array as payload', () => {
    it('parseLogRecord returns { success: false }', async () => {
        const result = await (0, logParser_1.parseLogRecord)([]);
        expect(result.success).toBe(false);
    });
    it('parseLogRecord returns { success: false } for non-empty array', async () => {
        const result = await (0, logParser_1.parseLogRecord)([validLog]);
        expect(result.success).toBe(false);
    });
    it('parseBreak returns { success: false }', async () => {
        const result = await (0, breakParser_1.parseBreak)([]);
        expect(result.success).toBe(false);
    });
    it('parseBreak returns { success: false } for non-empty array', async () => {
        const result = await (0, breakParser_1.parseBreak)([validBreak]);
        expect(result.success).toBe(false);
    });
});
// ─── 11. Boolean as payload ───────────────────────────────────────────────────
describe('boolean as payload', () => {
    it('parseLogRecord returns { success: false } for true', async () => {
        const result = await (0, logParser_1.parseLogRecord)(true);
        expect(result.success).toBe(false);
    });
    it('parseLogRecord returns { success: false } for false', async () => {
        const result = await (0, logParser_1.parseLogRecord)(false);
        expect(result.success).toBe(false);
    });
    it('parseBreak returns { success: false } for true', async () => {
        const result = await (0, breakParser_1.parseBreak)(true);
        expect(result.success).toBe(false);
    });
    it('parseBreak returns { success: false } for false', async () => {
        const result = await (0, breakParser_1.parseBreak)(false);
        expect(result.success).toBe(false);
    });
});
// ─── 12. String as payload ────────────────────────────────────────────────────
describe('string as payload', () => {
    it('parseLogRecord returns { success: false }', async () => {
        const result = await (0, logParser_1.parseLogRecord)('{"id":"log-1"}');
        expect(result.success).toBe(false);
    });
    it('parseBreak returns { success: false }', async () => {
        const result = await (0, breakParser_1.parseBreak)('{"id":"break-1"}');
        expect(result.success).toBe(false);
    });
});
// ─── 13. Number as payload ────────────────────────────────────────────────────
describe('number as payload', () => {
    it('parseLogRecord returns { success: false } for integer', async () => {
        const result = await (0, logParser_1.parseLogRecord)(42);
        expect(result.success).toBe(false);
    });
    it('parseLogRecord returns { success: false } for float', async () => {
        const result = await (0, logParser_1.parseLogRecord)(3.14);
        expect(result.success).toBe(false);
    });
    it('parseBreak returns { success: false } for integer', async () => {
        const result = await (0, breakParser_1.parseBreak)(42);
        expect(result.success).toBe(false);
    });
    it('parseBreak returns { success: false } for float', async () => {
        const result = await (0, breakParser_1.parseBreak)(3.14);
        expect(result.success).toBe(false);
    });
});
//# sourceMappingURL=parserEdgeCases.test.js.map