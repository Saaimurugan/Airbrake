"use strict";
// Feature: live-airbrake-monitoring-portal, Property 20: Export Contains All Records
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
 * Validates: Requirements 8.5, 9.4
 *
 * Property 20: Export Contains All Records
 * For any set of search results, exporting in CSV format and in JSON format
 * should each produce output that contains exactly the same records as the
 * search result set, with no records omitted or added.
 */
const fc = __importStar(require("fast-check"));
const logsRouter_1 = require("../logsRouter");
// ─── Arbitraries ──────────────────────────────────────────────────────────────
const severities = ['info', 'warning', 'error', 'critical'];
const environments = ['production', 'qa', 'development'];
const arbitraryLogRecord = () => fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...environments),
    severity: fc.constantFrom(...severities),
    message: fc.string({ minLength: 1, maxLength: 100 }),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
    rawPayload: fc.constant({}),
});
const arbitraryBreak = () => fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...environments),
    severity: fc.constantFrom(...severities),
    errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
    stackTrace: fc.string({ minLength: 1, maxLength: 200 }),
    endpoint: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    requestPayload: fc.constant(null),
    userSession: fc.constant(null),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    fingerprint: fc.hexaString({ minLength: 8, maxLength: 32 }),
});
// ─── Mock response helper ─────────────────────────────────────────────────────
function makeMockResponse() {
    const mock = {
        statusCode: 200,
        capturedJson: undefined,
        capturedCsv: '',
        headers: {},
        status(code) { mock.statusCode = code; return mock; },
        json(body) { mock.capturedJson = body; },
        setHeader(name, value) { mock.headers[name] = value; },
        send(body) { mock.capturedCsv = body; },
    };
    return mock;
}
function makeMockRequest(format) {
    return {
        method: 'GET',
        path: '/export',
        headers: {},
        query: { format },
        params: {},
        session: undefined,
    };
}
// ─── CSV field definitions (mirrors logsRouter internals) ─────────────────────
const LOG_CSV_FIELDS = ['id', 'applicationId', 'environment', 'severity', 'message', 'timestamp', 'tags'];
const BREAK_CSV_FIELDS = ['id', 'applicationId', 'environment', 'severity', 'errorMessage', 'stackTrace', 'endpoint', 'timestamp', 'fingerprint'];
// ─── Property 20: Export Contains All Records ─────────────────────────────────
describe('Property 20: Export Contains All Records', () => {
    // ── LogRecord JSON export ──────────────────────────────────────────────────
    it('JSON export of LogRecords contains exactly the same records as input (no omissions, no additions)', async () => {
        await fc.assert(fc.asyncProperty(fc.array(arbitraryLogRecord(), { maxLength: 50 }), async (records) => {
            const repo = {
                search: async () => ({ data: records, total: records.length }),
                searchAll: async () => records,
            };
            const handler = (0, logsRouter_1.createExportLogsHandler)(repo);
            const req = makeMockRequest('json');
            const res = makeMockResponse();
            await handler(req, res, () => { });
            const exported = res.capturedJson;
            expect(exported).toHaveLength(records.length);
            const exportedIds = new Set(exported.map((r) => r.id));
            const inputIds = new Set(records.map((r) => r.id));
            expect(exportedIds).toEqual(inputIds);
        }), { numRuns: 100 });
    });
    // ── LogRecord CSV export ───────────────────────────────────────────────────
    it('CSV export of LogRecords has exactly header + N data rows for N input records', () => {
        fc.assert(fc.property(fc.array(arbitraryLogRecord(), { maxLength: 50 }), (records) => {
            const csv = (0, logsRouter_1.toCsv)(records, LOG_CSV_FIELDS);
            const lines = csv.split('\n');
            // header row + one row per record
            expect(lines).toHaveLength(records.length + 1);
        }), { numRuns: 100 });
    });
    // ── Break JSON export ──────────────────────────────────────────────────────
    it('JSON export of Breaks contains exactly the same records as input (no omissions, no additions)', async () => {
        await fc.assert(fc.asyncProperty(fc.array(arbitraryBreak(), { maxLength: 50 }), async (breaks) => {
            const repo = {
                exportAll: async () => breaks,
            };
            const handler = (0, logsRouter_1.createExportBreaksHandler)(repo);
            const req = makeMockRequest('json');
            const res = makeMockResponse();
            await handler(req, res, () => { });
            const exported = res.capturedJson;
            expect(exported).toHaveLength(breaks.length);
            const exportedIds = new Set(exported.map((b) => b.id));
            const inputIds = new Set(breaks.map((b) => b.id));
            expect(exportedIds).toEqual(inputIds);
        }), { numRuns: 100 });
    });
    // ── Break CSV export ───────────────────────────────────────────────────────
    it('CSV export of Breaks has exactly header + N data rows for N input records', () => {
        fc.assert(fc.property(fc.array(arbitraryBreak(), { maxLength: 50 }), (breaks) => {
            const csv = (0, logsRouter_1.toCsv)(breaks, BREAK_CSV_FIELDS);
            const lines = csv.split('\n');
            expect(lines).toHaveLength(breaks.length + 1);
        }), { numRuns: 100 });
    });
    // ── CSV round-trip: parse back and verify record count ────────────────────
    it('CSV round-trip: parsing CSV back yields the same number of records as input', () => {
        fc.assert(fc.property(fc.array(arbitraryLogRecord(), { maxLength: 50 }), (records) => {
            const csv = (0, logsRouter_1.toCsv)(records, LOG_CSV_FIELDS);
            const lines = csv.split('\n');
            // First line is header; remaining lines are data rows
            const dataRows = lines.slice(1);
            expect(dataRows).toHaveLength(records.length);
        }), { numRuns: 100 });
    });
    // ── Empty input ────────────────────────────────────────────────────────────
    it('empty input produces an empty JSON array', async () => {
        const repo = {
            search: async () => ({ data: [], total: 0 }),
            searchAll: async () => [],
        };
        const handler = (0, logsRouter_1.createExportLogsHandler)(repo);
        const req = makeMockRequest('json');
        const res = makeMockResponse();
        await handler(req, res, () => { });
        expect(res.capturedJson).toEqual([]);
    });
    it('empty input produces a header-only CSV (1 line, no data rows)', () => {
        const csv = (0, logsRouter_1.toCsv)([], LOG_CSV_FIELDS);
        const lines = csv.split('\n');
        expect(lines).toHaveLength(1);
        expect(lines[0]).toBe(LOG_CSV_FIELDS.join(','));
    });
    it('empty Breaks input produces a header-only CSV', () => {
        const csv = (0, logsRouter_1.toCsv)([], BREAK_CSV_FIELDS);
        const lines = csv.split('\n');
        expect(lines).toHaveLength(1);
        expect(lines[0]).toBe(BREAK_CSV_FIELDS.join(','));
    });
});
//# sourceMappingURL=export.property.test.js.map