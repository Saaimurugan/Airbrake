/**
 * AWS Lambda entry point.
 *
 * Wraps the Express app from app.ts with serverless-http so it can be
 * invoked via a Lambda Function URL (HTTP event format v2).
 *
 * Lambda-specific concerns handled here:
 *  1. The Alert Engine cannot use setInterval (Lambda is stateless per invocation).
 *     Instead, schedule a separate EventBridge rule → Lambda to run runAlertCheckOnce.
 *     This file exports a second handler (`alertHandler`) for that purpose.
 *  2. WebSocket upgrades are not supported by Lambda Function URLs.
 *     The /ws proxy in vite.config.ts is for local dev only.
 *  3. The Express static file serving block (frontend/dist) is a no-op in Lambda
 *     because the frontend is served from a CDN / S3, not the backend.
 */
import 'dotenv/config';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
/**
 * Main Lambda handler — serves all HTTP API requests.
 * Point your Lambda Function URL at this export as `lambdaHandler`.
 */
export declare const lambdaHandler: (event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyResultV2>;
/**
 * Alert Engine handler — for EventBridge scheduled rule (every 30 seconds).
 * Create a separate Lambda + EventBridge rule pointing at this export
 * so alerts fire reliably even when there is no incoming HTTP traffic.
 */
export declare const alertHandler: () => Promise<void>;
