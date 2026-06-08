"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertEngine = void 0;
const defaultDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// ─── AlertEngine ──────────────────────────────────────────────────────────────
class AlertEngine {
    constructor(breakCountRepo, dispatcher, alertNotificationRepo, delay) {
        this.breakCountRepo = breakCountRepo;
        this.dispatcher = dispatcher;
        this.alertNotificationRepo = alertNotificationRepo;
        this.delay = delay ?? defaultDelay;
    }
    /**
     * Evaluate all active alert rules. For each enabled rule:
     * - Count breaks in the rolling window; dispatch if count >= threshold
     * - If a newBreak is provided with status 'new' and rule.triggerOnNewError is true, dispatch
     */
    async evaluate(rules, newBreak, breakStatus) {
        for (const rule of rules) {
            if (!rule.enabled)
                continue;
            const count = await this.breakCountRepo.countBreaksInWindow(rule.windowSeconds);
            const thresholdMet = count >= rule.threshold;
            const newErrorTrigger = rule.triggerOnNewError &&
                newBreak !== undefined &&
                breakStatus === 'new';
            if (thresholdMet || newErrorTrigger) {
                const event = {
                    ruleId: rule.id,
                    triggeredAt: new Date(),
                    breakCount: count,
                    newBreak: newBreak,
                };
                await this.dispatch(rule, event);
            }
        }
    }
    /**
     * Dispatch an alert event to all channels configured on the rule.
     * Retries up to 3 attempts with exponential backoff (1s, 2s, 4s).
     * Marks as failed after exhaustion.
     */
    async dispatch(rule, event) {
        const backoffDelays = [1000, 2000, 4000];
        for (const channel of rule.channels) {
            let lastError;
            let succeeded = false;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    await this.dispatcher.send(channel, event);
                    succeeded = true;
                    break;
                }
                catch (err) {
                    lastError = err;
                    if (attempt < 2) {
                        await this.delay(backoffDelays[attempt]);
                    }
                }
            }
            if (!succeeded) {
                await this.alertNotificationRepo.markFailed(rule.id, event);
            }
        }
    }
}
exports.AlertEngine = AlertEngine;
//# sourceMappingURL=alertEngine.js.map