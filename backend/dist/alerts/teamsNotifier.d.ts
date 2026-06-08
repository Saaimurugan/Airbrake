/**
 * Teams Notifier — Direct Incoming Webhook (webhook.office.com)
 *
 * Uses the MessageCard format which is required by Teams Incoming Webhooks.
 * No Power Automate. Posts directly to the Teams channel.
 */
export interface TeamsAlertPayload {
    ruleName: string;
    alertType: string;
    projectName: string;
    errorMsg: string;
    count?: number;
    errorDetail?: string;
    label?: string;
}
export declare function sendTeamsAlert(p: TeamsAlertPayload): Promise<void>;
export declare function testTeamsWebhook(): Promise<{
    webhookUrl: string;
    configured: boolean;
    status?: number;
    ok?: boolean;
    error?: string;
    message: string;
}>;
