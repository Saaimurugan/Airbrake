"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fc = __importStar(require("fast-check"));
const node_crypto_1 = require("node:crypto");
const alertEngine_1 = require("../alertEngine");
// Feature: live-airbrake-monitoring-portal, Property 13: Alert Threshold Triggering
// Feature: live-airbrake-monitoring-portal, Property 14: New Error Alert Triggering
// ─── Helpers ──────────────────────────────────────────────────────────────────
const noopDelay = () => Promise.resolve();
function makeBreakCountRepo(count) {
    return { countBreaksInWindow: jest.fn().mockResolvedValue(count) };
}
function makeDispatcher() {
    const dispatcher = {
        send: jest.fn().mockResolvedValue(undefined),
    };
    return { dispatcher };
}
function makeAlertNotificationRepo() {
    return { markFailed: jest.fn().mockResolvedValue(undefined) };
}
function makeRule(overrides = {}) {
    return {
        id: (0, node_crypto_1.randomUUID)(),
        name: 'Test Rule',
        threshold: 5,
        windowSeconds: 300,
        triggerOnNewError: false,
        channels: [{ type: 'email', address: 'ops@example.com' }],
        createdBy: 'user-1',
        enabled: true,
        ...overrides,
    };
}
function makeBreak(overrides = {}) {
    return {
        id: (0, node_crypto_1.randomUUID)(),
        applicationId: 'app-123',
        environment: 'production',
        severity: 'error',
        errorMessage: 'TypeError: Cannot read property of undefined',
        stackTrace: 'at Object.<anonymous> (app.js:10:5)',
        endpoint: '/api/users',
        requestPayload: null,
        userSession: null,
        timestamp: new Date(),
        fingerprint: 'abc123',
        ...overrides,
    };
}
/** Arbitrary for a threshold T in [1, 100] */
const arbThreshold = fc.integer({ min: 1, max: 100 });
/** Arbitrary for a single NotificationChannel */
const arbChannel = fc.oneof(fc.record({ type: fc.constant('email'), address: fc.emailAddress() }), fc.record({ type: fc.constant('slack'), webhookUrl: fc.webUrl() }), fc.record({ type: fc.constant('webhook'), url: fc.webUrl() }));
/** Arbitrary for a non-empty array of channels (1–3) */
const arbChannels = fc.array(arbChannel, { minLength: 1, maxLength: 3 });
// ─── Property 13: Alert Threshold Triggering ─────────────────────────────────
/**
 * Validates: Requirements 5.1, 5.2
 *
 * For any alert rule with threshold T and window W:
 * - If break count >= T, dispatch is called for all channels.
 * - If break count < T, dispatch is NOT called.
 */
describe('Property 13: Alert Threshold Triggering', () => {
    // Feature: live-airbrake-monitoring-portal, Property 13: Alert Threshold Triggering
    it('count >= threshold → dispatch called for all channels', async () => {
        await fc.assert(fc.asyncProperty(arbThreshold, arbChannels, fc.integer({ min: 0, max: 200 }), async (threshold, channels, extra) => {
            const count = threshold + extra; // count >= threshold always
            const { dispatcher } = makeDispatcher();
            const engine = new alertEngine_1.AlertEngine(makeBreakCountRepo(count), dispatcher, makeAlertNotificationRepo(), noopDelay);
            const rule = makeRule({ threshold, channels, triggerOnNewError: false });
            await engine.evaluate([rule]);
            expect(dispatcher.send.mock.calls.length).toBe(channels.length);
        }), { numRuns: 100 });
    });
    it('count < threshold → dispatch NOT called', async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 2, max: 100 }), // threshold >= 2 so count can be threshold-1 >= 1
        arbChannels, async (threshold, channels) => {
            const count = threshold - 1; // count < threshold always
            const { dispatcher } = makeDispatcher();
            const engine = new alertEngine_1.AlertEngine(makeBreakCountRepo(count), dispatcher, makeAlertNotificationRepo(), noopDelay);
            const rule = makeRule({ threshold, channels, triggerOnNewError: false });
            await engine.evaluate([rule]);
            expect(dispatcher.send.mock.calls.length).toBe(0);
        }), { numRuns: 100 });
    });
});
// ─── Property 14: New Error Alert Triggering ─────────────────────────────────
/**
 * Validates: Requirements 5.3
 *
 * For any alert rule with triggerOnNewError=true:
 * - A Break classified as 'new' → dispatch is called.
 * - A Break classified as 'existing' → dispatch is NOT called.
 * - For any rule with triggerOnNewError=false and a 'new' break (count < threshold) → dispatch is NOT called.
 */
describe('Property 14: New Error Alert Triggering', () => {
    // Feature: live-airbrake-monitoring-portal, Property 14: New Error Alert Triggering
    it('triggerOnNewError=true + new break → dispatch called', async () => {
        await fc.assert(fc.asyncProperty(arbChannels, async (channels) => {
            // Use a very high threshold so count-based trigger won't fire
            const { dispatcher } = makeDispatcher();
            const engine = new alertEngine_1.AlertEngine(makeBreakCountRepo(0), dispatcher, makeAlertNotificationRepo(), noopDelay);
            const rule = makeRule({ threshold: 1000, channels, triggerOnNewError: true });
            const newBreak = makeBreak();
            await engine.evaluate([rule], newBreak, 'new');
            expect(dispatcher.send.mock.calls.length).toBe(channels.length);
        }), { numRuns: 100 });
    });
    it('triggerOnNewError=true + existing break → dispatch NOT called', async () => {
        await fc.assert(fc.asyncProperty(arbChannels, async (channels) => {
            const { dispatcher } = makeDispatcher();
            const engine = new alertEngine_1.AlertEngine(makeBreakCountRepo(0), dispatcher, makeAlertNotificationRepo(), noopDelay);
            const rule = makeRule({ threshold: 1000, channels, triggerOnNewError: true });
            const existingBreak = makeBreak();
            await engine.evaluate([rule], existingBreak, 'existing');
            expect(dispatcher.send.mock.calls.length).toBe(0);
        }), { numRuns: 100 });
    });
    it('triggerOnNewError=false + new break (count < threshold) → dispatch NOT called', async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 2, max: 100 }), arbChannels, async (threshold, channels) => {
            const count = threshold - 1; // below threshold
            const { dispatcher } = makeDispatcher();
            const engine = new alertEngine_1.AlertEngine(makeBreakCountRepo(count), dispatcher, makeAlertNotificationRepo(), noopDelay);
            const rule = makeRule({ threshold, channels, triggerOnNewError: false });
            const newBreak = makeBreak();
            await engine.evaluate([rule], newBreak, 'new');
            expect(dispatcher.send.mock.calls.length).toBe(0);
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=alert.property.test.js.map