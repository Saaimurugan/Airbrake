"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertHandler = exports.lambdaHandler = void 0;
require("dotenv/config");
const serverless_http_1 = __importDefault(require("serverless-http"));
// ── Import the fully-configured Express app ────────────────────────────────
const app_1 = require("./app");
// ── Wrap Express with serverless-http ──────────────────────────────────────
const handler = (0, serverless_http_1.default)(app_1.app, {
    request(req, event) {
        // Propagate the raw Lambda event for any middleware that needs it
        req.lambdaEvent = event;
    },
});
/**
 * Main Lambda handler — serves all HTTP API requests.
 * Point your Lambda Function URL at this export as `lambdaHandler`.
 */
const lambdaHandler = async (event, context) => {
    // Keep the DB connection warm across invocations in the same execution environment
    context.callbackWaitsForEmptyEventLoop = false;
    return handler(event, context);
};
exports.lambdaHandler = lambdaHandler;
/**
 * Alert Engine handler — for EventBridge scheduled rule (every 30 seconds).
 * Create a separate Lambda + EventBridge rule pointing at this export
 * so alerts fire reliably even when there is no incoming HTTP traffic.
 */
const alertHandler = async () => {
    const { pool } = await Promise.resolve().then(() => __importStar(require('./db/client')));
    const { runAlertCheckOnce } = await Promise.resolve().then(() => __importStar(require('./alerts/alertChecker')));
    await runAlertCheckOnce(pool);
};
exports.alertHandler = alertHandler;
//# sourceMappingURL=lambda.js.map