import type { RetentionPolicy } from '@portal/shared';
export interface PurgeRepository {
    deleteLogsBefore(cutoff: Date): Promise<number>;
    deleteBreaksBefore(cutoff: Date): Promise<number>;
}
export interface RetentionPolicyReader {
    findAll(): Promise<RetentionPolicy[]>;
}
export type SetIntervalFn = (callback: () => void, ms: number) => NodeJS.Timeout;
export declare class PurgeJob {
    private readonly purgeRepo;
    private readonly policyReader;
    private readonly setIntervalFn;
    constructor(purgeRepo: PurgeRepository, policyReader: RetentionPolicyReader, setIntervalFn?: SetIntervalFn);
    /**
     * Run the purge for all retention policies.
     * For each policy, computes cutoff = now - retentionDays, then deletes
     * logs and breaks older than that cutoff. Returns total counts deleted.
     */
    run(now?: Date): Promise<{
        logsDeleted: number;
        breaksDeleted: number;
    }>;
    /**
     * Schedule the purge job to run on a recurring interval.
     * @param intervalMs - interval in milliseconds (e.g. 86_400_000 for daily)
     */
    schedule(intervalMs: number): void;
}
