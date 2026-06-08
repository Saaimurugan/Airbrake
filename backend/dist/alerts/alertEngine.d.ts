import type { AlertRule, AlertEvent, Break, NotificationChannel, BreakStatus } from '@portal/shared';
export interface BreakCountRepository {
    countBreaksInWindow(windowSeconds: number): Promise<number>;
}
export interface NotificationDispatcher {
    send(channel: NotificationChannel, event: AlertEvent): Promise<void>;
}
export interface AlertNotificationRepository {
    markFailed(ruleId: string, event: AlertEvent): Promise<void>;
}
export type DelayFn = (ms: number) => Promise<void>;
export declare class AlertEngine {
    private readonly breakCountRepo;
    private readonly dispatcher;
    private readonly alertNotificationRepo;
    private readonly delay;
    constructor(breakCountRepo: BreakCountRepository, dispatcher: NotificationDispatcher, alertNotificationRepo: AlertNotificationRepository, delay?: DelayFn);
    /**
     * Evaluate all active alert rules. For each enabled rule:
     * - Count breaks in the rolling window; dispatch if count >= threshold
     * - If a newBreak is provided with status 'new' and rule.triggerOnNewError is true, dispatch
     */
    evaluate(rules: AlertRule[], newBreak?: Break, breakStatus?: BreakStatus): Promise<void>;
    /**
     * Dispatch an alert event to all channels configured on the rule.
     * Retries up to 3 attempts with exponential backoff (1s, 2s, 4s).
     * Marks as failed after exhaustion.
     */
    dispatch(rule: AlertRule, event: AlertEvent): Promise<void>;
}
