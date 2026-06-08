/**
 * Jira Router
 * POST /api/jira/create-ticket
 *
 * Creates a Jira issue with:
 *   summary    = short error (e.g. "json.JSONDecodeError")
 *   description = full error_detail traceback
 *   + fixed default custom fields
 *
 * Credentials from .env:
 *   JIRA_BASE_URL, JIRA_PROJECT_KEY, JIRA_EMAIL, JIRA_API_TOKEN
 */
export declare function createJiraRouter(): any;
