import { LogRecord } from '@portal/shared';
export type ParseResult<T> = {
    success: true;
    record: T;
} | {
    success: false;
    error: string;
    rawPayload: unknown;
};
export interface ParseErrorWriter {
    write(rawPayload: unknown, errorMessage: string): Promise<void>;
}
/** No-op stub used until the real DB connection is wired in Task 6. */
export declare const noopParseErrorWriter: ParseErrorWriter;
/**
 * Parses a raw Airbrake/pipeline payload into a normalized LogRecord.
 *
 * Returns { success: true, record } on success.
 * Returns { success: false, error, rawPayload } on malformed input and
 * writes the error to the parse_errors table via the provided writer.
 *
 * Never throws.
 */
export declare function parseLogRecord(raw: unknown, errorWriter?: ParseErrorWriter): Promise<ParseResult<LogRecord>>;
/**
 * Serializes a normalized LogRecord to a JSON string.
 * The timestamp is serialized as an ISO 8601 string.
 */
export declare function serializeLogRecord(record: LogRecord): string;
