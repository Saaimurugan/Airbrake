"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBreak = parseBreak;
exports.serializeBreak = serializeBreak;
const logParser_1 = require("./logParser");
// ─── Validation Helpers ───────────────────────────────────────────────────────
const VALID_SEVERITIES = new Set(['info', 'warning', 'error', 'critical']);
function isValidSeverity(v) {
    return typeof v === 'string' && VALID_SEVERITIES.has(v);
}
function isRecord(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isNullableRecord(v) {
    return v === null || v === undefined || isRecord(v);
}
// ─── parseBreak ───────────────────────────────────────────────────────────────
/**
 * Parses a raw Airbrake error payload into a normalized Break record.
 *
 * Returns { success: true, record } on success.
 * Returns { success: false, error, rawPayload } on malformed input and
 * writes the error to the parse_errors table via the provided writer.
 *
 * Never throws.
 */
async function parseBreak(raw, errorWriter = logParser_1.noopParseErrorWriter) {
    try {
        if (!isRecord(raw)) {
            const msg = 'Payload must be a non-null object';
            await errorWriter.write(raw, msg);
            return { success: false, error: msg, rawPayload: raw };
        }
        const missing = [];
        if (typeof raw.id !== 'string' || raw.id.trim() === '')
            missing.push('id');
        if (typeof raw.applicationId !== 'string' || raw.applicationId.trim() === '')
            missing.push('applicationId');
        if (typeof raw.environment !== 'string' || raw.environment.trim() === '')
            missing.push('environment');
        if (!isValidSeverity(raw.severity))
            missing.push('severity');
        if (typeof raw.errorMessage !== 'string')
            missing.push('errorMessage');
        if (typeof raw.stackTrace !== 'string')
            missing.push('stackTrace');
        if (typeof raw.fingerprint !== 'string' || raw.fingerprint.trim() === '')
            missing.push('fingerprint');
        if (raw.timestamp === undefined || raw.timestamp === null)
            missing.push('timestamp');
        const timestamp = raw.timestamp instanceof Date
            ? raw.timestamp
            : new Date(raw.timestamp);
        if (raw.timestamp !== undefined && raw.timestamp !== null && isNaN(timestamp.getTime())) {
            missing.push('timestamp (invalid date)');
        }
        if (missing.length > 0) {
            const msg = `Missing or invalid required fields: ${missing.join(', ')}`;
            await errorWriter.write(raw, msg);
            return { success: false, error: msg, rawPayload: raw };
        }
        // Optional fields — null if absent or wrong type
        const endpoint = typeof raw.endpoint === 'string' ? raw.endpoint : null;
        const requestPayload = isRecord(raw.requestPayload) ? raw.requestPayload : null;
        const userSession = isRecord(raw.userSession) ? raw.userSession : null;
        const record = {
            id: raw.id.trim(),
            applicationId: raw.applicationId.trim(),
            environment: raw.environment.trim(),
            severity: raw.severity,
            errorMessage: raw.errorMessage,
            stackTrace: raw.stackTrace,
            endpoint,
            requestPayload,
            userSession,
            timestamp,
            fingerprint: raw.fingerprint.trim(),
        };
        return { success: true, record };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        try {
            await errorWriter.write(raw, msg);
        }
        catch {
            // swallow writer errors — pipeline must not crash
        }
        return { success: false, error: msg, rawPayload: raw };
    }
}
// ─── serializeBreak ───────────────────────────────────────────────────────────
/**
 * Serializes a normalized Break record to a JSON string.
 * The timestamp is serialized as an ISO 8601 string.
 */
function serializeBreak(record) {
    return JSON.stringify({
        ...record,
        timestamp: record.timestamp.toISOString(),
    });
}
//# sourceMappingURL=breakParser.js.map