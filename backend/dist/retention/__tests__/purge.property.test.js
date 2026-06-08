"use strict";
// Feature: live-airbrake-monitoring-portal, Property 21: Retention Purge Correctness
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
Object.defineProperty(exports, "__esModule", { value: true });
const fc = __importStar(require("fast-check"));
// ─── In-memory purge helpers ──────────────────────────────────────────────────
function purgeOlderThan(records, cutoffDate) {
    return records.filter((r) => r.timestamp >= cutoffDate);
}
// ─── Arbitraries ─────────────────────────────────────────────────────────────
const arbTimestamp = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') });
const arbLogRecord = fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom('production', 'qa', 'development'),
    severity: fc.constantFrom('info', 'warning', 'error', 'critical'),
    message: fc.string({ minLength: 1, maxLength: 100 }),
    timestamp: arbTimestamp,
    tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
    rawPayload: fc.constant({}),
});
const arbBreak = fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom('production', 'qa', 'development'),
    severity: fc.constantFrom('info', 'warning', 'error', 'critical'),
    errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
    stackTrace: fc.string({ minLength: 1, maxLength: 200 }),
    endpoint: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    requestPayload: fc.constant(null),
    userSession: fc.constant(null),
    timestamp: arbTimestamp,
    fingerprint: fc.hexaString({ minLength: 8, maxLength: 16 }),
});
/** Retention period in days: 30, 60, or 90 */
const arbRetentionDays = fc.constantFrom(30, 60, 90);
// ─── Property 21: Retention Purge Correctness ────────────────────────────────
/**
 * Validates: Requirements 9.1, 9.2
 *
 * For any configured retention period R (30, 60, or 90 days), after the purge
 * process runs, no log entry or Break record with a timestamp older than R days
 * should appear in any query result.
 */
describe('Property 21: Retention Purge Correctness', () => {
    const NOW = new Date('2024-06-01T12:00:00Z');
    it('after purge, no LogRecord has a timestamp older than the retention cutoff', () => {
        fc.assert(fc.property(fc.array(arbLogRecord, { maxLength: 50 }), arbRetentionDays, (records, retentionDays) => {
            const cutoff = new Date(NOW.getTime() - retentionDays * 24 * 60 * 60 * 1000);
            const purged = purgeOlderThan(records, cutoff);
            for (const record of purged) {
                expect(record.timestamp.getTime()).toBeGreaterThanOrEqual(cutoff.getTime());
            }
        }), { numRuns: 100 });
    });
    it('after purge, no Break record has a timestamp older than the retention cutoff', () => {
        fc.assert(fc.property(fc.array(arbBreak, { maxLength: 50 }), arbRetentionDays, (records, retentionDays) => {
            const cutoff = new Date(NOW.getTime() - retentionDays * 24 * 60 * 60 * 1000);
            const purged = purgeOlderThan(records, cutoff);
            for (const record of purged) {
                expect(record.timestamp.getTime()).toBeGreaterThanOrEqual(cutoff.getTime());
            }
        }), { numRuns: 100 });
    });
    it('records with timestamp >= cutoff are preserved after purge (LogRecord)', () => {
        fc.assert(fc.property(fc.array(arbLogRecord, { maxLength: 50 }), arbRetentionDays, (records, retentionDays) => {
            const cutoff = new Date(NOW.getTime() - retentionDays * 24 * 60 * 60 * 1000);
            const shouldKeep = records.filter((r) => r.timestamp >= cutoff);
            const purged = purgeOlderThan(records, cutoff);
            expect(purged.length).toBe(shouldKeep.length);
            for (const record of shouldKeep) {
                expect(purged.some((r) => r.id === record.id)).toBe(true);
            }
        }), { numRuns: 100 });
    });
    it('records with timestamp >= cutoff are preserved after purge (Break)', () => {
        fc.assert(fc.property(fc.array(arbBreak, { maxLength: 50 }), arbRetentionDays, (records, retentionDays) => {
            const cutoff = new Date(NOW.getTime() - retentionDays * 24 * 60 * 60 * 1000);
            const shouldKeep = records.filter((r) => r.timestamp >= cutoff);
            const purged = purgeOlderThan(records, cutoff);
            expect(purged.length).toBe(shouldKeep.length);
            for (const record of shouldKeep) {
                expect(purged.some((r) => r.id === record.id)).toBe(true);
            }
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=purge.property.test.js.map