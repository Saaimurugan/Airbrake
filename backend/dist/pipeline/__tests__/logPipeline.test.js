"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logPipeline_1 = require("../logPipeline");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeValidPayload(overrides = {}) {
    return {
        id: 'log-001',
        applicationId: 'app-1',
        environment: 'production',
        severity: 'error',
        message: 'Something went wrong',
        timestamp: new Date('2024-01-01T00:00:00Z').toISOString(),
        tags: ['api'],
        rawPayload: {},
        ...overrides,
    };
}
function makeDeps() {
    const savedRecords = [];
    const indexedRecords = [];
    const publishedMessages = [];
    const parseErrors = [];
    const repository = {
        save: async (record) => { savedRecords.push(record); },
    };
    const indexer = {
        indexLogRecord: async (record) => { indexedRecords.push(record); },
    };
    const publisher = {
        publish: async (channel, message) => { publishedMessages.push({ channel, message }); },
    };
    const parseErrorRepository = {
        save: async (rawPayload, errorMessage) => { parseErrors.push({ rawPayload, errorMessage }); },
    };
    return { repository, indexer, publisher, parseErrorRepository, savedRecords, indexedRecords, publishedMessages, parseErrors };
}
// ─── Tests ────────────────────────────────────────────────────────────────────
describe('LogPipeline.ingest', () => {
    it('saves a valid record to PostgreSQL', async () => {
        const { repository, indexer, publisher, parseErrorRepository, savedRecords } = makeDeps();
        const pipeline = (0, logPipeline_1.createLogPipeline)(repository, indexer, publisher, parseErrorRepository);
        await pipeline.ingest(makeValidPayload());
        expect(savedRecords).toHaveLength(1);
        expect(savedRecords[0].id).toBe('log-001');
    });
    it('indexes a valid record in Elasticsearch', async () => {
        const { repository, indexer, publisher, parseErrorRepository, indexedRecords } = makeDeps();
        const pipeline = (0, logPipeline_1.createLogPipeline)(repository, indexer, publisher, parseErrorRepository);
        await pipeline.ingest(makeValidPayload());
        expect(indexedRecords).toHaveLength(1);
        expect(indexedRecords[0].id).toBe('log-001');
    });
    it('publishes a valid record to Redis logs channel', async () => {
        const { repository, indexer, publisher, parseErrorRepository, publishedMessages } = makeDeps();
        const pipeline = (0, logPipeline_1.createLogPipeline)(repository, indexer, publisher, parseErrorRepository);
        await pipeline.ingest(makeValidPayload());
        expect(publishedMessages).toHaveLength(1);
        expect(publishedMessages[0].channel).toBe('logs');
        const parsed = JSON.parse(publishedMessages[0].message);
        expect(parsed.id).toBe('log-001');
    });
    it('writes parse error and does not save/index/publish on malformed payload', async () => {
        const { repository, indexer, publisher, parseErrorRepository, savedRecords, indexedRecords, publishedMessages, parseErrors } = makeDeps();
        const pipeline = (0, logPipeline_1.createLogPipeline)(repository, indexer, publisher, parseErrorRepository);
        await pipeline.ingest({ id: '', applicationId: 'app-1', environment: 'production', severity: 'error', message: 'x', timestamp: new Date() });
        expect(parseErrors.length).toBeGreaterThan(0);
        expect(savedRecords).toHaveLength(0);
        expect(indexedRecords).toHaveLength(0);
        expect(publishedMessages).toHaveLength(0);
    });
    it('writes parse error for null payload and continues without throwing', async () => {
        const { repository, indexer, publisher, parseErrorRepository, parseErrors } = makeDeps();
        const pipeline = (0, logPipeline_1.createLogPipeline)(repository, indexer, publisher, parseErrorRepository);
        await expect(pipeline.ingest(null)).resolves.toBeUndefined();
        expect(parseErrors.length).toBeGreaterThan(0);
    });
    it('does not throw when repository.save throws', async () => {
        const { indexer, publisher, parseErrorRepository } = makeDeps();
        const failingRepo = {
            save: async () => { throw new Error('DB down'); },
        };
        const pipeline = (0, logPipeline_1.createLogPipeline)(failingRepo, indexer, publisher, parseErrorRepository);
        await expect(pipeline.ingest(makeValidPayload())).resolves.toBeUndefined();
    });
    it('does not throw when indexer throws', async () => {
        const { repository, publisher, parseErrorRepository } = makeDeps();
        const failingIndexer = {
            indexLogRecord: async () => { throw new Error('ES down'); },
        };
        const pipeline = (0, logPipeline_1.createLogPipeline)(repository, failingIndexer, publisher, parseErrorRepository);
        await expect(pipeline.ingest(makeValidPayload())).resolves.toBeUndefined();
    });
    it('does not throw when publisher throws', async () => {
        const { repository, indexer, parseErrorRepository } = makeDeps();
        const failingPublisher = {
            publish: async () => { throw new Error('Redis down'); },
        };
        const pipeline = (0, logPipeline_1.createLogPipeline)(repository, indexer, failingPublisher, parseErrorRepository);
        await expect(pipeline.ingest(makeValidPayload())).resolves.toBeUndefined();
    });
});
//# sourceMappingURL=logPipeline.test.js.map