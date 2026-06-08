"use strict";
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
const logParser_1 = require("../logParser");
// Feature: live-airbrake-monitoring-portal, Property 22: Parsing Produces Valid Normalized Records
/**
 * Validates: Requirements 10.1, 10.2
 *
 * For any valid log entry payload, parsing it should produce a normalized
 * LogRecord with all required fields populated and no required field null or missing.
 */
const validEnvironments = ['production', 'qa', 'development'];
const validSeverities = ['info', 'warning', 'error', 'critical'];
/** Arbitrary that generates valid log entry payloads with all required fields present and valid. */
const arbitraryValidLogPayload = () => fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...validEnvironments),
    severity: fc.constantFrom(...validSeverities),
    message: fc.string({ minLength: 1, maxLength: 500 }),
    timestamp: fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
    rawPayload: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
});
describe('Property 22: Parsing Produces Valid Normalized Records', () => {
    // Feature: live-airbrake-monitoring-portal, Property 22: Parsing Produces Valid Normalized Records
    it('for any valid log payload, parseLogRecord returns success with all required fields populated', async () => {
        await fc.assert(fc.asyncProperty(arbitraryValidLogPayload(), async (payload) => {
            const result = await (0, logParser_1.parseLogRecord)(payload);
            expect(result.success).toBe(true);
            if (!result.success)
                return;
            const { record } = result;
            // All required fields must be present and non-null
            expect(record.id).toBeTruthy();
            expect(typeof record.id).toBe('string');
            expect(record.applicationId).toBeTruthy();
            expect(typeof record.applicationId).toBe('string');
            expect(record.environment).toBeDefined();
            expect(['production', 'qa', 'development']).toContain(record.environment);
            expect(record.severity).toBeDefined();
            expect(['info', 'warning', 'error', 'critical']).toContain(record.severity);
            expect(record.message).toBeDefined();
            expect(typeof record.message).toBe('string');
            expect(record.timestamp).toBeDefined();
            expect(record.timestamp).toBeInstanceOf(Date);
            expect(Number.isNaN(record.timestamp.getTime())).toBe(false);
        }), { numRuns: 100 });
    });
});
// Feature: live-airbrake-monitoring-portal, Property 23: Malformed Payload Handled Without Crash
/**
 * Validates: Requirements 10.3
 *
 * For any malformed or incomplete payload (missing required fields, invalid JSON,
 * unexpected types), the parse function should return an error result and not throw
 * an unhandled exception, leaving the ingestion pipeline in a running state.
 */
const invalidEnvironments = ['staging', 'test', 'prod', '', 123, null, undefined, true, {}];
const invalidSeverities = ['debug', 'fatal', 'verbose', '', 0, null, undefined, false, []];
/** Arbitrary that generates malformed payloads of various kinds. */
const arbitraryMalformedPayload = () => fc.oneof(
// null / undefined / primitives
fc.constant(null), fc.constant(undefined), fc.integer(), fc.float(), fc.boolean(), fc.string(), fc.array(fc.anything()), 
// Object missing all required fields
fc.constant({}), 
// Object with some required fields missing
fc.record({
    id: fc.uuid(),
    // applicationId missing
    environment: fc.constantFrom(...validEnvironments),
    severity: fc.constantFrom(...validSeverities),
    message: fc.string(),
    timestamp: fc.date(),
}), fc.record({
    // id missing
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...validEnvironments),
    severity: fc.constantFrom(...validSeverities),
    message: fc.string(),
    timestamp: fc.date(),
}), 
// Wrong types for required fields
fc.record({
    id: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
    applicationId: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)),
    environment: fc.constantFrom(...validEnvironments),
    severity: fc.constantFrom(...validSeverities),
    message: fc.string(),
    timestamp: fc.date(),
}), 
// Invalid enum values for environment
fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...invalidEnvironments),
    severity: fc.constantFrom(...validSeverities),
    message: fc.string(),
    timestamp: fc.date(),
}), 
// Invalid enum values for severity
fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...validEnvironments),
    severity: fc.constantFrom(...invalidSeverities),
    message: fc.string(),
    timestamp: fc.date(),
}), 
// Invalid timestamps
fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...validEnvironments),
    severity: fc.constantFrom(...validSeverities),
    message: fc.string(),
    timestamp: fc.oneof(fc.constant('not-a-date'), fc.constant(''), fc.constant(NaN), fc.constant(Infinity), fc.constant(null), fc.constant(undefined), fc.string().filter((s) => isNaN(Date.parse(s)))),
}), 
// Empty string id / applicationId
fc.record({
    id: fc.constant(''),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...validEnvironments),
    severity: fc.constantFrom(...validSeverities),
    message: fc.string(),
    timestamp: fc.date(),
}), fc.record({
    id: fc.uuid(),
    applicationId: fc.constant(''),
    environment: fc.constantFrom(...validEnvironments),
    severity: fc.constantFrom(...validSeverities),
    message: fc.string(),
    timestamp: fc.date(),
}), 
// Completely random objects
fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.anything()));
describe('Property 23: Malformed Payload Handled Without Crash', () => {
    // Feature: live-airbrake-monitoring-portal, Property 23: Malformed Payload Handled Without Crash
    it('for any malformed payload, parseLogRecord never throws and always returns { success: false }', async () => {
        await fc.assert(fc.asyncProperty(arbitraryMalformedPayload(), async (payload) => {
            let result;
            // Must never throw
            try {
                result = await (0, logParser_1.parseLogRecord)(payload);
            }
            catch (err) {
                throw new Error(`parseLogRecord threw an exception for payload ${JSON.stringify(payload)}: ${err}`);
            }
            expect(result.success).toBe(false);
        }), { numRuns: 100 });
    });
});
// Feature: live-airbrake-monitoring-portal, Property 24: Parse-Serialize-Parse Round-Trip
/**
 * Validates: Requirements 10.4, 10.5
 *
 * For any valid normalized LogRecord, serializing it to JSON and then parsing
 * the resulting JSON should produce a record equivalent to the original.
 */
const logParser_2 = require("../logParser");
describe('Property 24: Parse-Serialize-Parse Round-Trip', () => {
    // Feature: live-airbrake-monitoring-portal, Property 24: Parse-Serialize-Parse Round-Trip
    it('parse → serialize → parse produces a record equal to the first parse result', async () => {
        await fc.assert(fc.asyncProperty(arbitraryValidLogPayload(), async (payload) => {
            // First parse
            const result1 = await (0, logParser_1.parseLogRecord)(payload);
            expect(result1.success).toBe(true);
            if (!result1.success)
                return;
            const record1 = result1.record;
            // Serialize to JSON
            const json = (0, logParser_2.serializeLogRecord)(record1);
            // Parse the deserialized JSON object
            const result2 = await (0, logParser_1.parseLogRecord)(JSON.parse(json));
            expect(result2.success).toBe(true);
            if (!result2.success)
                return;
            const record2 = result2.record;
            // The two records must be equivalent
            expect(record2.id).toEqual(record1.id);
            expect(record2.applicationId).toEqual(record1.applicationId);
            expect(record2.environment).toEqual(record1.environment);
            expect(record2.severity).toEqual(record1.severity);
            expect(record2.message).toEqual(record1.message);
            expect(record2.timestamp.toISOString()).toEqual(record1.timestamp.toISOString());
            expect(record2.tags).toEqual(record1.tags);
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=parser.property.test.js.map