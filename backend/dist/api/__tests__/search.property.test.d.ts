import type { Break, LogRecord } from '@portal/shared';
/** Case-insensitive substring match on the `message` field. */
export declare function applyKeywordSearch(records: LogRecord[], keyword: string): LogRecord[];
/** Exact membership match: record must have the given tag in its `tags` array. */
export declare function applyTagSearch(records: LogRecord[], tag: string): LogRecord[];
/** Case-insensitive substring match on the `errorMessage` field. */
export declare function applyBreakKeywordSearch(breaks: Break[], keyword: string): Break[];
