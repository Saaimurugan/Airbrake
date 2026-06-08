"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogPipeline = createLogPipeline;
const logParser_1 = require("../parsers/logParser");
function createLogPipeline(repository, indexer, publisher, parseErrorRepository) {
    // Wire ParseErrorRepository to the ParseErrorWriter interface expected by parseLogRecord
    const parseErrorWriter = {
        write: (rawPayload, errorMessage) => parseErrorRepository.save(rawPayload, errorMessage),
    };
    return {
        async ingest(raw) {
            try {
                const result = await (0, logParser_1.parseLogRecord)(raw, parseErrorWriter);
                if (!result.success) {
                    // Parse error already written to parse_errors by parseLogRecord via parseErrorWriter
                    return;
                }
                const record = result.record;
                try {
                    await repository.save(record);
                }
                catch (err) {
                    console.error('[LogPipeline] Failed to save record to PostgreSQL:', err);
                    return;
                }
                try {
                    await indexer.indexLogRecord(record);
                }
                catch (err) {
                    console.error('[LogPipeline] Failed to index record in Elasticsearch:', err);
                }
                try {
                    await publisher.publish('logs', JSON.stringify(record));
                }
                catch (err) {
                    console.error('[LogPipeline] Failed to publish record to Redis:', err);
                }
            }
            catch (err) {
                // Top-level catch — pipeline must never throw
                console.error('[LogPipeline] Unexpected error during ingest:', err);
            }
        },
    };
}
//# sourceMappingURL=logPipeline.js.map