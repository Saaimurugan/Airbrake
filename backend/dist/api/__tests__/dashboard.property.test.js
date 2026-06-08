"use strict";
// Feature: live-airbrake-monitoring-portal, Property 7: Dashboard Break Count Aggregation
// Feature: live-airbrake-monitoring-portal, Property 8: Top Services Ranking
// Feature: live-airbrake-monitoring-portal, Property 9: Bucketing Preserves Total Count
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
/**
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */
const fc = __importStar(require("fast-check"));
// ─── Pure Aggregation Functions Under Test ────────────────────────────────────
function countBreaksInWindow(breaks, windowHours, now) {
    const cutoff = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    return breaks.filter((b) => b.timestamp >= cutoff && b.timestamp <= now).length;
}
function getTopServices(breaks, limit) {
    const counts = new Map();
    for (const b of breaks) {
        counts.set(b.applicationId, (counts.get(b.applicationId) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([applicationId, count]) => ({ applicationId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}
function bucketByHour(breaks, from, to) {
    const buckets = new Map();
    for (const b of breaks) {
        if (b.timestamp < from || b.timestamp > to)
            continue;
        const hour = new Date(b.timestamp);
        hour.setMinutes(0, 0, 0);
        const key = hour.getTime();
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).map(([ts, count]) => ({
        timestamp: new Date(ts),
        count,
    }));
}
function bucketByDay(breaks, from, to) {
    const buckets = new Map();
    for (const b of breaks) {
        if (b.timestamp < from || b.timestamp > to)
            continue;
        const day = new Date(b.timestamp);
        day.setHours(0, 0, 0, 0);
        const key = day.getTime();
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).map(([ts, count]) => ({
        timestamp: new Date(ts),
        count,
    }));
}
function groupBySeverity(breaks) {
    const result = {};
    for (const b of breaks) {
        result[b.severity] = (result[b.severity] ?? 0) + 1;
    }
    return result;
}
// ─── Arbitraries ──────────────────────────────────────────────────────────────
const severities = ['info', 'warning', 'error', 'critical'];
const environments = ['production', 'qa', 'development'];
const BASE_DATE = new Date('2024-01-15T12:00:00.000Z');
const arbitraryBreak = (timestampArb) => fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...environments),
    severity: fc.constantFrom(...severities),
    errorMessage: fc.string({ minLength: 1, maxLength: 80 }),
    stackTrace: fc.string({ minLength: 1, maxLength: 100 }),
    endpoint: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
    requestPayload: fc.constant(null),
    userSession: fc.constant(null),
    timestamp: timestampArb ??
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    fingerprint: fc.hexaString({ minLength: 8, maxLength: 32 }),
});
// ─── Property 7: Dashboard Break Count Aggregation ───────────────────────────
describe('Property 7: Dashboard Break Count Aggregation', () => {
    /**
     * Validates: Requirements 3.1, 3.2
     */
    it('countBreaksInWindow returns exactly the count of breaks within the window', () => {
        fc.assert(fc.property(fc.array(arbitraryBreak(fc.date({ min: new Date('2024-01-01'), max: new Date('2024-01-31') })), { maxLength: 50 }), fc.integer({ min: 1, max: 168 }), // 1h – 7 days
        (breaks, windowHours) => {
            const now = BASE_DATE;
            const result = countBreaksInWindow(breaks, windowHours, now);
            const cutoff = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
            const expected = breaks.filter((b) => b.timestamp >= cutoff && b.timestamp <= now).length;
            expect(result).toBe(expected);
        }), { numRuns: 100 });
    });
    it('breaks outside the window are not counted', () => {
        fc.assert(fc.property(fc.array(arbitraryBreak(
        // timestamps strictly before the 24h window
        fc.date({
            min: new Date('2020-01-01'),
            max: new Date('2024-01-14T11:59:59.999Z'),
        })), { minLength: 1, maxLength: 30 }), (breaks) => {
            const now = BASE_DATE; // 2024-01-15T12:00:00Z
            const windowHours = 24;
            const result = countBreaksInWindow(breaks, windowHours, now);
            // All timestamps are before the 24h cutoff (2024-01-14T12:00:00Z)
            expect(result).toBe(0);
        }), { numRuns: 100 });
    });
});
// ─── Property 8: Top Services Ranking ────────────────────────────────────────
describe('Property 8: Top Services Ranking', () => {
    /**
     * Validates: Requirements 3.3
     */
    it('getTopServices returns services in descending order of break count', () => {
        fc.assert(fc.property(fc.array(arbitraryBreak(), { maxLength: 60 }), fc.integer({ min: 1, max: 20 }), (breaks, limit) => {
            const result = getTopServices(breaks, limit);
            for (let i = 1; i < result.length; i++) {
                expect(result[i - 1].count).toBeGreaterThanOrEqual(result[i].count);
            }
        }), { numRuns: 100 });
    });
    it('no service with a higher count appears after a service with a lower count', () => {
        fc.assert(fc.property(fc.array(arbitraryBreak(), { maxLength: 60 }), fc.integer({ min: 1, max: 20 }), (breaks, limit) => {
            const result = getTopServices(breaks, limit);
            for (let i = 0; i < result.length; i++) {
                for (let j = i + 1; j < result.length; j++) {
                    expect(result[i].count).toBeGreaterThanOrEqual(result[j].count);
                }
            }
        }), { numRuns: 100 });
    });
});
// ─── Property 9: Bucketing Preserves Total Count ─────────────────────────────
describe('Property 9: Bucketing Preserves Total Count', () => {
    /**
     * Validates: Requirements 3.4, 3.5
     */
    const WINDOW_FROM = new Date('2024-01-01T00:00:00.000Z');
    const WINDOW_TO = new Date('2024-01-31T23:59:59.999Z');
    const arbitraryBreakInWindow = arbitraryBreak(fc.date({ min: WINDOW_FROM, max: WINDOW_TO }));
    it('sum of hourly bucket counts equals total break count', () => {
        fc.assert(fc.property(fc.array(arbitraryBreakInWindow, { maxLength: 60 }), (breaks) => {
            const buckets = bucketByHour(breaks, WINDOW_FROM, WINDOW_TO);
            const sum = buckets.reduce((acc, b) => acc + b.count, 0);
            expect(sum).toBe(breaks.length);
        }), { numRuns: 100 });
    });
    it('sum of daily bucket counts equals total break count', () => {
        fc.assert(fc.property(fc.array(arbitraryBreakInWindow, { maxLength: 60 }), (breaks) => {
            const buckets = bucketByDay(breaks, WINDOW_FROM, WINDOW_TO);
            const sum = buckets.reduce((acc, b) => acc + b.count, 0);
            expect(sum).toBe(breaks.length);
        }), { numRuns: 100 });
    });
    it('sum of severity group counts equals total break count', () => {
        fc.assert(fc.property(fc.array(arbitraryBreak(), { maxLength: 60 }), (breaks) => {
            const groups = groupBySeverity(breaks);
            const sum = Object.values(groups).reduce((acc, c) => acc + c, 0);
            expect(sum).toBe(breaks.length);
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=dashboard.property.test.js.map