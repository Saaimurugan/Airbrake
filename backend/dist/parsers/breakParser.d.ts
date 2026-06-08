import { Break } from '@portal/shared';
import { ParseResult, ParseErrorWriter } from './logParser';
/**
 * Parses a raw Airbrake error payload into a normalized Break record.
 *
 * Returns { success: true, record } on success.
 * Returns { success: false, error, rawPayload } on malformed input and
 * writes the error to the parse_errors table via the provided writer.
 *
 * Never throws.
 */
export declare function parseBreak(raw: unknown, errorWriter?: ParseErrorWriter): Promise<ParseResult<Break>>;
/**
 * Serializes a normalized Break record to a JSON string.
 * The timestamp is serialized as an ISO 8601 string.
 */
export declare function serializeBreak(record: Break): string;
