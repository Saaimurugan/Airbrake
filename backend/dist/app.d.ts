/**
 * Express application factory — shared between the local dev server (index.ts)
 * and the Lambda handler (lambda.ts).
 *
 * Exports `app` so serverless-http can wrap it, and `buildApp` for testing.
 */
import 'dotenv/config';
export declare const app: any;
