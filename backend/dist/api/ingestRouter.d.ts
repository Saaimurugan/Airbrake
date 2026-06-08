/**
 * Ingest API — POST endpoints for reporting logs and errors (breaks) into the system.
 *
 * POST /api/ingest/logs   — report a single log entry
 * POST /api/ingest/errors — report an error/break
 *
 * Both endpoints are unauthenticated (API-key protected) so external services
 * can push data without an OAuth session.
 */
import type { LogPipeline } from '../pipeline/logPipeline';
import type { ErrorAggregator } from '../aggregator/errorAggregator';
import type { ParseErrorWriter } from '../parsers/logParser';
export interface IngestRequest {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
}
export interface IngestResponse {
    statusCode: number;
    status(code: number): IngestResponse;
    json(body: unknown): void;
}
export type IngestHandler = (req: IngestRequest, res: IngestResponse) => Promise<void>;
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
export declare function createIngestLogHandler(pipeline: LogPipeline, parseErrorWriter: ParseErrorWriter, apiKey?: string): IngestHandler;
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
export declare function createIngestErrorHandler(aggregator: ErrorAggregator, parseErrorWriter: ParseErrorWriter, apiKey?: string): IngestHandler;
export declare function createIngestRouter(pipeline: LogPipeline, aggregator: ErrorAggregator, parseErrorWriter: ParseErrorWriter, apiKey?: string): any;
