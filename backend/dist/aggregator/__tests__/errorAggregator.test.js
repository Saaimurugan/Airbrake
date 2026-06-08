"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errorAggregator_1 = require("../errorAggregator");
const fingerprint_1 = require("../fingerprint");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeBreak(overrides = {}) {
    return {
        id: 'break-1',
        applicationId: 'app-123',
        environment: 'production',
        severity: 'error',
        errorMessage: 'TypeError: Cannot read property of undefined',
        stackTrace: 'at Object.<anonymous> (app.js:10:5)',
        endpoint: '/api/users',
        requestPayload: null,
        userSession: null,
        timestamp: new Date('2024-01-15T10:00:00Z'),
        fingerprint: '',
        ...overrides,
    };
}
function makeGroup(overrides = {}) {
    return {
        id: 'group-1',
        fingerprint: 'abc123',
        applicationId: 'app-123',
        firstOccurrence: new Date('2024-01-10T08:00:00Z'),
        lastOccurrence: new Date('2024-01-14T09:00:00Z'),
        occurrenceCount: 5,
        status: 'open',
        severity: 'error',
        errorMessage: 'TypeError: Cannot read property of undefined',
        ...overrides,
    };
}
function makeRepos(existingGroup = null) {
    const savedGroups = [];
    const updatedGroups = [];
    const savedBreaks = [];
    const indexedBreaks = [];
    const indexedGroups = [];
    const breakGroups = {
        findByFingerprint: jest.fn().mockResolvedValue(existingGroup),
        save: jest.fn().mockImplementation(async (g) => {
            savedGroups.push(g);
            return g;
        }),
        update: jest.fn().mockImplementation(async (g) => {
            updatedGroups.push(g);
            return g;
        }),
    };
    const breaks = {
        save: jest.fn().mockImplementation(async (b) => {
            savedBreaks.push(b);
        }),
    };
    const indexer = {
        indexBreak: jest.fn().mockImplementation(async (b) => {
            indexedBreaks.push(b);
        }),
        indexBreakGroup: jest.fn().mockImplementation(async (g) => {
            indexedGroups.push(g);
        }),
    };
    return { breakGroups, breaks, indexer, savedGroups, updatedGroups, savedBreaks, indexedBreaks, indexedGroups };
}
// ─── Tests ────────────────────────────────────────────────────────────────────
describe('DefaultErrorAggregator', () => {
    describe('new break (no existing group)', () => {
        it('classifies as "new" and creates a BreakGroup with status "open"', async () => {
            const { breakGroups, breaks, indexer, savedGroups } = makeRepos(null);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const b = makeBreak();
            const result = await aggregator.aggregate(b);
            expect(result.status).toBe('new');
            expect(result.group.status).toBe('open');
            expect(result.group.occurrenceCount).toBe(1);
            expect(result.group.firstOccurrence).toEqual(b.timestamp);
            expect(result.group.lastOccurrence).toEqual(b.timestamp);
            expect(savedGroups).toHaveLength(1);
        });
        it('sets the fingerprint on the new group from the break fields', async () => {
            const { breakGroups, breaks, indexer } = makeRepos(null);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const b = makeBreak();
            const expectedFingerprint = (0, fingerprint_1.computeFingerprint)(b);
            const result = await aggregator.aggregate(b);
            expect(result.group.fingerprint).toBe(expectedFingerprint);
        });
        it('saves the break record with the new group id', async () => {
            const { breakGroups, breaks, indexer, savedBreaks } = makeRepos(null);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const b = makeBreak();
            const result = await aggregator.aggregate(b);
            expect(savedBreaks).toHaveLength(1);
            expect(savedBreaks[0].groupId).toBe(result.group.id);
        });
        it('indexes both the break and the group in Elasticsearch', async () => {
            const { breakGroups, breaks, indexer, indexedBreaks, indexedGroups } = makeRepos(null);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            await aggregator.aggregate(makeBreak());
            expect(indexedBreaks).toHaveLength(1);
            expect(indexedGroups).toHaveLength(1);
        });
    });
    describe('existing open group', () => {
        it('classifies as "existing" and increments occurrenceCount', async () => {
            const existing = makeGroup({ status: 'open', occurrenceCount: 5 });
            const { breakGroups, breaks, indexer, updatedGroups } = makeRepos(existing);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const result = await aggregator.aggregate(makeBreak());
            expect(result.status).toBe('existing');
            expect(result.group.occurrenceCount).toBe(6);
            expect(updatedGroups).toHaveLength(1);
        });
        it('updates lastOccurrence to the break timestamp', async () => {
            const existing = makeGroup({ status: 'open' });
            const { breakGroups, breaks, indexer } = makeRepos(existing);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const b = makeBreak({ timestamp: new Date('2024-01-15T12:00:00Z') });
            const result = await aggregator.aggregate(b);
            expect(result.group.lastOccurrence).toEqual(b.timestamp);
        });
        it('does not change group status from "open"', async () => {
            const existing = makeGroup({ status: 'open' });
            const { breakGroups, breaks, indexer } = makeRepos(existing);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const result = await aggregator.aggregate(makeBreak());
            expect(result.group.status).toBe('open');
        });
    });
    describe('existing regression group', () => {
        it('classifies as "existing" when group is already in regression', async () => {
            const existing = makeGroup({ status: 'regression', occurrenceCount: 3 });
            const { breakGroups, breaks, indexer } = makeRepos(existing);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const result = await aggregator.aggregate(makeBreak());
            expect(result.status).toBe('existing');
            expect(result.group.occurrenceCount).toBe(4);
        });
    });
    describe('resolved group (regression)', () => {
        it('classifies as "regression" when group was resolved', async () => {
            const existing = makeGroup({ status: 'resolved', occurrenceCount: 10 });
            const { breakGroups, breaks, indexer, updatedGroups } = makeRepos(existing);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const result = await aggregator.aggregate(makeBreak());
            expect(result.status).toBe('regression');
            expect(result.group.status).toBe('regression');
            expect(updatedGroups).toHaveLength(1);
        });
        it('increments occurrenceCount on regression', async () => {
            const existing = makeGroup({ status: 'resolved', occurrenceCount: 10 });
            const { breakGroups, breaks, indexer } = makeRepos(existing);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const result = await aggregator.aggregate(makeBreak());
            expect(result.group.occurrenceCount).toBe(11);
        });
        it('updates lastOccurrence on regression', async () => {
            const existing = makeGroup({ status: 'resolved' });
            const { breakGroups, breaks, indexer } = makeRepos(existing);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const b = makeBreak({ timestamp: new Date('2024-01-20T00:00:00Z') });
            const result = await aggregator.aggregate(b);
            expect(result.group.lastOccurrence).toEqual(b.timestamp);
        });
    });
    describe('known payload produces expected BreakGroup', () => {
        // Validates: Requirements 2.2, 2.3
        it('produces the correct deterministic fingerprint for a known Break payload', async () => {
            // Known inputs → known SHA-256 fingerprint
            const knownBreak = makeBreak({
                applicationId: 'app-123',
                errorMessage: 'TypeError: Cannot read property of undefined',
                stackTrace: 'at Object.<anonymous> (app.js:10:5)',
            });
            const knownFingerprint = '56422e79bc326086d773061d8d876e7e0ddb62d50808855b3868313f4d3778f4';
            const { breakGroups, breaks, indexer } = makeRepos(null);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const result = await aggregator.aggregate(knownBreak);
            expect(result.group.fingerprint).toBe(knownFingerprint);
            expect(result.group.applicationId).toBe('app-123');
            expect(result.group.errorMessage).toBe('TypeError: Cannot read property of undefined');
            expect(result.group.status).toBe('open');
            expect(result.group.occurrenceCount).toBe(1);
        });
        it('calls breakRepo.save with the correct groupId (PostgreSQL write verified)', async () => {
            const knownBreak = makeBreak({
                applicationId: 'app-123',
                errorMessage: 'TypeError: Cannot read property of undefined',
                stackTrace: 'at Object.<anonymous> (app.js:10:5)',
            });
            const { breakGroups, breaks, indexer } = makeRepos(null);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const result = await aggregator.aggregate(knownBreak);
            expect(breaks.save).toHaveBeenCalledTimes(1);
            expect(breaks.save).toHaveBeenCalledWith(expect.objectContaining({ groupId: result.group.id }));
        });
        it('calls indexer.indexBreak and indexer.indexBreakGroup (Elasticsearch write verified)', async () => {
            const { breakGroups, breaks, indexer } = makeRepos(null);
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const result = await aggregator.aggregate(makeBreak());
            expect(indexer.indexBreak).toHaveBeenCalledTimes(1);
            expect(indexer.indexBreak).toHaveBeenCalledWith(expect.objectContaining({ groupId: result.group.id }));
            expect(indexer.indexBreakGroup).toHaveBeenCalledTimes(1);
            expect(indexer.indexBreakGroup).toHaveBeenCalledWith(result.group);
        });
    });
    describe('occurrenceCount increments across multiple aggregations', () => {
        // Validates: Requirements 2.2, 2.3, 2.4
        it('increments occurrenceCount correctly across three sequential aggregations', async () => {
            // Simulate a stateful repo that tracks the current group
            let currentGroup = null;
            const breakGroups = {
                findByFingerprint: jest.fn().mockImplementation(async () => currentGroup),
                save: jest.fn().mockImplementation(async (g) => {
                    currentGroup = g;
                    return g;
                }),
                update: jest.fn().mockImplementation(async (g) => {
                    currentGroup = g;
                    return g;
                }),
            };
            const breaks = { save: jest.fn().mockResolvedValue(undefined) };
            const indexer = {
                indexBreak: jest.fn().mockResolvedValue(undefined),
                indexBreakGroup: jest.fn().mockResolvedValue(undefined),
            };
            const aggregator = new errorAggregator_1.DefaultErrorAggregator(breakGroups, breaks, indexer);
            const b = makeBreak();
            const r1 = await aggregator.aggregate(b);
            expect(r1.status).toBe('new');
            expect(r1.group.occurrenceCount).toBe(1);
            const r2 = await aggregator.aggregate(b);
            expect(r2.status).toBe('existing');
            expect(r2.group.occurrenceCount).toBe(2);
            const r3 = await aggregator.aggregate(b);
            expect(r3.status).toBe('existing');
            expect(r3.group.occurrenceCount).toBe(3);
            expect(breaks.save).toHaveBeenCalledTimes(3);
        });
    });
});
//# sourceMappingURL=errorAggregator.test.js.map