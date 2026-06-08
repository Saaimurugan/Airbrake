"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const alertEngine_1 = require("../alertEngine");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeRule(overrides = {}) {
    return {
        id: 'rule-1',
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
        id: 'break-1',
        applicationId: 'app-123',
        environment: 'production',
        severity: 'error',
        errorMessage: 'TypeError: Cannot read property of undefined',
        stackTrace: 'at Object.<anonymous> (app.js:10:5)',
        endpoint: '/api/users',
        requestPayload: null,
        userSession: null,
        timestamp: new Date('2024-01-15T10:00:00Z'),
        fingerprint: 'abc123',
        ...overrides,
    };
}
function makeDeps(breakCount = 0) {
    const noopDelay = jest.fn().mockResolvedValue(undefined);
    const breakCountRepo = {
        countBreaksInWindow: jest.fn().mockResolvedValue(breakCount),
    };
    const dispatchedCalls = [];
    const dispatcher = {
        send: jest.fn().mockImplementation(async (channel, event) => {
            dispatchedCalls.push({ channel, event });
        }),
    };
    const failedCalls = [];
    const alertNotificationRepo = {
        markFailed: jest.fn().mockImplementation(async (ruleId, event) => {
            failedCalls.push({ ruleId, event });
        }),
    };
    return { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay, dispatchedCalls, failedCalls };
}
// ─── evaluate() tests ─────────────────────────────────────────────────────────
describe('AlertEngine.evaluate()', () => {
    it('dispatches when break count >= threshold', async () => {
        const { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay } = makeDeps(5);
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule({ threshold: 5 });
        await engine.evaluate([rule]);
        expect(dispatcher.send).toHaveBeenCalledTimes(1);
    });
    it('dispatches when break count exceeds threshold', async () => {
        const { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay } = makeDeps(10);
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule({ threshold: 5 });
        await engine.evaluate([rule]);
        expect(dispatcher.send).toHaveBeenCalledTimes(1);
    });
    it('does NOT dispatch when count < threshold', async () => {
        const { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay } = makeDeps(3);
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule({ threshold: 5 });
        await engine.evaluate([rule]);
        expect(dispatcher.send).not.toHaveBeenCalled();
    });
    it('dispatches for new-error break when triggerOnNewError=true', async () => {
        const { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay } = makeDeps(0);
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule({ threshold: 100, triggerOnNewError: true });
        const newBreak = makeBreak();
        await engine.evaluate([rule], newBreak, 'new');
        expect(dispatcher.send).toHaveBeenCalledTimes(1);
    });
    it('does NOT dispatch for existing break when triggerOnNewError=true', async () => {
        const { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay } = makeDeps(0);
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule({ threshold: 100, triggerOnNewError: true });
        const existingBreak = makeBreak();
        await engine.evaluate([rule], existingBreak, 'existing');
        expect(dispatcher.send).not.toHaveBeenCalled();
    });
    it('does NOT dispatch for regression break when triggerOnNewError=true', async () => {
        const { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay } = makeDeps(0);
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule({ threshold: 100, triggerOnNewError: true });
        const regressionBreak = makeBreak();
        await engine.evaluate([rule], regressionBreak, 'regression');
        expect(dispatcher.send).not.toHaveBeenCalled();
    });
    it('skips disabled rules', async () => {
        const { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay } = makeDeps(100);
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule({ enabled: false, threshold: 1 });
        await engine.evaluate([rule]);
        expect(breakCountRepo.countBreaksInWindow).not.toHaveBeenCalled();
        expect(dispatcher.send).not.toHaveBeenCalled();
    });
    it('evaluates multiple rules independently', async () => {
        const { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay } = makeDeps(5);
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const ruleA = makeRule({ id: 'rule-a', threshold: 5 });
        const ruleB = makeRule({ id: 'rule-b', threshold: 10 }); // count=5 < 10, won't trigger
        await engine.evaluate([ruleA, ruleB]);
        // Only ruleA should dispatch (count=5 >= threshold=5)
        expect(dispatcher.send).toHaveBeenCalledTimes(1);
        const callArg = dispatcher.send.mock.calls[0][1];
        expect(callArg.ruleId).toBe('rule-a');
    });
    it('includes breakCount in the dispatched event', async () => {
        const { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay } = makeDeps(7);
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule({ threshold: 5 });
        await engine.evaluate([rule]);
        const event = dispatcher.send.mock.calls[0][1];
        expect(event.breakCount).toBe(7);
        expect(event.ruleId).toBe(rule.id);
    });
});
// ─── dispatch() tests ─────────────────────────────────────────────────────────
describe('AlertEngine.dispatch()', () => {
    const sampleEvent = {
        ruleId: 'rule-1',
        triggeredAt: new Date('2024-01-15T10:00:00Z'),
        breakCount: 5,
    };
    it('calls dispatcher.send for all configured channels', async () => {
        const { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay } = makeDeps();
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule({
            channels: [
                { type: 'email', address: 'ops@example.com' },
                { type: 'slack', webhookUrl: 'https://hooks.slack.com/abc' },
                { type: 'teams', webhookUrl: 'https://outlook.office.com/webhook/xyz' },
                { type: 'webhook', url: 'https://example.com/hook' },
            ],
        });
        await engine.dispatch(rule, sampleEvent);
        expect(dispatcher.send).toHaveBeenCalledTimes(4);
    });
    it('retries on failure up to 3 attempts', async () => {
        const noopDelay = jest.fn().mockResolvedValue(undefined);
        const breakCountRepo = { countBreaksInWindow: jest.fn() };
        const alertNotificationRepo = { markFailed: jest.fn().mockResolvedValue(undefined) };
        const dispatcher = {
            send: jest.fn()
                .mockRejectedValueOnce(new Error('timeout'))
                .mockRejectedValueOnce(new Error('timeout'))
                .mockRejectedValueOnce(new Error('timeout')),
        };
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule();
        await engine.dispatch(rule, sampleEvent);
        expect(dispatcher.send).toHaveBeenCalledTimes(3);
    });
    it('marks as failed after 3 failed attempts', async () => {
        const noopDelay = jest.fn().mockResolvedValue(undefined);
        const breakCountRepo = { countBreaksInWindow: jest.fn() };
        const alertNotificationRepo = {
            markFailed: jest.fn().mockResolvedValue(undefined),
        };
        const dispatcher = {
            send: jest.fn().mockRejectedValue(new Error('network error')),
        };
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule();
        await engine.dispatch(rule, sampleEvent);
        expect(alertNotificationRepo.markFailed).toHaveBeenCalledTimes(1);
        expect(alertNotificationRepo.markFailed).toHaveBeenCalledWith(rule.id, sampleEvent);
    });
    it('succeeds on second attempt (retry works)', async () => {
        const noopDelay = jest.fn().mockResolvedValue(undefined);
        const breakCountRepo = { countBreaksInWindow: jest.fn() };
        const alertNotificationRepo = {
            markFailed: jest.fn().mockResolvedValue(undefined),
        };
        const dispatcher = {
            send: jest.fn()
                .mockRejectedValueOnce(new Error('transient'))
                .mockResolvedValueOnce(undefined),
        };
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule();
        await engine.dispatch(rule, sampleEvent);
        expect(dispatcher.send).toHaveBeenCalledTimes(2);
        expect(alertNotificationRepo.markFailed).not.toHaveBeenCalled();
    });
    it('applies exponential backoff delays between retries', async () => {
        const delayFn = jest.fn().mockResolvedValue(undefined);
        const breakCountRepo = { countBreaksInWindow: jest.fn() };
        const alertNotificationRepo = {
            markFailed: jest.fn().mockResolvedValue(undefined),
        };
        const dispatcher = {
            send: jest.fn().mockRejectedValue(new Error('fail')),
        };
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, delayFn);
        const rule = makeRule();
        await engine.dispatch(rule, sampleEvent);
        // 3 attempts → 2 delays (after attempt 0 and attempt 1, not after the last)
        expect(delayFn).toHaveBeenCalledTimes(2);
        expect(delayFn).toHaveBeenNthCalledWith(1, 1000);
        expect(delayFn).toHaveBeenNthCalledWith(2, 2000);
    });
    it('does not call markFailed when dispatch succeeds on first attempt', async () => {
        const { breakCountRepo, dispatcher, alertNotificationRepo, noopDelay } = makeDeps();
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule();
        await engine.dispatch(rule, sampleEvent);
        expect(alertNotificationRepo.markFailed).not.toHaveBeenCalled();
    });
    it('marks each failing channel as failed independently', async () => {
        const noopDelay = jest.fn().mockResolvedValue(undefined);
        const breakCountRepo = { countBreaksInWindow: jest.fn() };
        const alertNotificationRepo = {
            markFailed: jest.fn().mockResolvedValue(undefined),
        };
        const dispatcher = {
            send: jest.fn().mockRejectedValue(new Error('fail')),
        };
        const engine = new alertEngine_1.AlertEngine(breakCountRepo, dispatcher, alertNotificationRepo, noopDelay);
        const rule = makeRule({
            channels: [
                { type: 'email', address: 'a@example.com' },
                { type: 'slack', webhookUrl: 'https://hooks.slack.com/abc' },
            ],
        });
        await engine.dispatch(rule, sampleEvent);
        // 2 channels × 3 attempts each = 6 send calls
        expect(dispatcher.send).toHaveBeenCalledTimes(6);
        // Both channels fail → markFailed called twice
        expect(alertNotificationRepo.markFailed).toHaveBeenCalledTimes(2);
    });
});
//# sourceMappingURL=alertEngine.test.js.map