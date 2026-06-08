"use strict";
/**
 * Ingest API — POST endpoints for reporting logs and errors (breaks) into the system.
 *
 * POST /api/ingest/logs   — report a single log entry
 * POST /api/ingest/errors — report an error/break
 *
 * Both endpoints are unauthenticated (API-key protected) so external services
 * can push data without an OAuth session.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIngestLogHandler = createIngestLogHandler;
exports.createIngestErrorHandler = createIngestErrorHandler;
exports.createIngestRouter = createIngestRouter;
const node_crypto_1 = require("node:crypto");
const logParser_1 = require("../parsers/logParser");
const breakParser_1 = require("../parsers/breakParser");
const fingerprint_1 = require("../aggregator/fingerprint");
// ─── API-key guard ────────────────────────────────────────────────────────────
/**
 * Validates the X-API-Key header against the configured secret.
 * Returns true if the key is valid or if no key is configured (dev mode).
 */
function isAuthorized(req, apiKey) {
    if (!apiKey)
        return true; // no key configured → open in dev
    const provided = req.headers['x-api-key'];
    return provided === apiKey;
}
// ─── Handler factories ────────────────────────────────────────────────────────
/**
 * POST /api/ingest/logs
 *
 * Body (JSON):
 * {
 *   "applicationId": "my-service",       // required
 *   "environment":   "production",        // required: production | qa | development
 *   "severity":      "error",             // required: info | warning | error | critical
 *   "message":       "Something failed",  // required
 *   "timestamp":     "2026-03-18T...",    // optional — defaults to now
 *   "tags":          ["db", "timeout"],   // optional
 *   "id":            "uuid",              // optional — auto-generated if omitted
 * }
 *
 * Response 202: { "id": "<uuid>", "status": "accepted" }
 * Response 400: { "error": "Bad Request", "message": "..." }
 */
function createIngestLogHandler(pipeline, parseErrorWriter, apiKey) {
    return async (req, res) => {
        if (!isAuthorized(req, apiKey)) {
            res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing X-API-Key header.' });
            return;
        }
        const body = req.body;
        const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : (0, node_crypto_1.randomUUID)();
        const timestamp = body?.timestamp ?? new Date().toISOString();
        const raw = { ...body, id, timestamp };
        const result = await (0, logParser_1.parseLogRecord)(raw, parseErrorWriter);
        if (!result.success) {
            res.status(400).json({ error: 'Bad Request', message: result.error });
            return;
        }
        await pipeline.ingest(raw);
        res.status(202).json({ id, status: 'accepted' });
    };
}
/**
 * POST /api/ingest/errors
 *
 * Body (JSON):
 * {
 *   "applicationId":  "my-service",           // required
 *   "environment":    "production",            // required
 *   "severity":       "error",                 // required: info | warning | error | critical
 *   "errorMessage":   "TypeError: ...",        // required
 *   "stackTrace":     "at foo (bar.ts:12)",    // required
 *   "endpoint":       "/api/users",            // optional
 *   "requestPayload": { ... },                 // optional
 *   "userSession":    { "userId": "..." },     // optional
 *   "timestamp":      "2026-03-18T...",        // optional — defaults to now
 *   "id":             "uuid",                  // optional — auto-generated if omitted
 * }
 *
 * Response 202: { "id": "<uuid>", "groupId": "<uuid>", "status": "new|existing|regression" }
 * Response 400: { "error": "Bad Request", "message": "..." }
 */
function createIngestErrorHandler(aggregator, parseErrorWriter, apiKey) {
    return async (req, res) => {
        if (!isAuthorized(req, apiKey)) {
            res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing X-API-Key header.' });
            return;
        }
        const body = req.body;
        const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : (0, node_crypto_1.randomUUID)();
        const timestamp = body?.timestamp ?? new Date().toISOString();
        // Compute fingerprint server-side so callers don't need to supply it
        const appId = typeof body?.applicationId === 'string' ? body.applicationId : '';
        const errMsg = typeof body?.errorMessage === 'string' ? body.errorMessage : '';
        const stack = typeof body?.stackTrace === 'string' ? body.stackTrace : '';
        const fingerprint = (0, fingerprint_1.computeFingerprint)({ applicationId: appId, errorMessage: errMsg, stackTrace: stack });
        const raw = { ...body, id, timestamp, fingerprint };
        const result = await (0, breakParser_1.parseBreak)(raw, parseErrorWriter);
        if (!result.success) {
            res.status(400).json({ error: 'Bad Request', message: result.error });
            return;
        }
        const { group, status } = await aggregator.aggregate(result.record);
        res.status(202).json({ id, groupId: group.id, status });
    };
}
// ─── Router factory ───────────────────────────────────────────────────────────
function createIngestRouter(pipeline, aggregator, parseErrorWriter, apiKey) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    const router = express.Router();
    router.post('/logs', createIngestLogHandler(pipeline, parseErrorWriter, apiKey));
    router.post('/errors', createIngestErrorHandler(aggregator, parseErrorWriter, apiKey));
    return router;
}
//# sourceMappingURL=ingestRouter.js.map