import type { LogRecord } from '@portal/shared';
import type { LogSearchFilters } from '../logsRouter';
/**
 * Mirrors the filtering logic that the repository layer would apply.
 * Only filters on the fields relevant to Property 1 (application, environment,
 * severity, timestamp range). Keyword/tags filtering is out of scope here.
 */
export declare function applyLogFilters(records: LogRecord[], filters: Partial<Pick<LogSearchFilters, 'applicationId' | 'environment' | 'severity' | 'from' | 'to'>>): LogRecord[];
