import { LogRecord } from '@portal/shared';
export interface LogRecordRepository {
    save(record: LogRecord): Promise<void>;
}
export interface LogSearchIndexer {
    indexLogRecord(record: LogRecord): Promise<void>;
}
export interface LogRedisPublisher {
    publish(channel: string, message: string): Promise<void>;
}
export interface ParseErrorRepository {
    save(rawPayload: unknown, errorMessage: string): Promise<void>;
}
export interface LogPipeline {
    ingest(raw: unknown): Promise<void>;
}
export declare function createLogPipeline(repository: LogRecordRepository, indexer: LogSearchIndexer, publisher: LogRedisPublisher, parseErrorRepository: ParseErrorRepository): LogPipeline;
