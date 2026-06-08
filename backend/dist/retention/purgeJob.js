"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurgeJob = void 0;
const defaultSetInterval = (callback, ms) => setInterval(callback, ms);
// ─── PurgeJob ─────────────────────────────────────────────────────────────────
class PurgeJob {
    constructor(purgeRepo, policyReader, setIntervalFn) {
        this.purgeRepo = purgeRepo;
        this.policyReader = policyReader;
        this.setIntervalFn = setIntervalFn ?? defaultSetInterval;
    }
    /**
     * Run the purge for all retention policies.
     * For each policy, computes cutoff = now - retentionDays, then deletes
     * logs and breaks older than that cutoff. Returns total counts deleted.
     */
    async run(now = new Date()) {
        const policies = await this.policyReader.findAll();
        let logsDeleted = 0;
        let breaksDeleted = 0;
        for (const policy of policies) {
            const cutoff = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
            const logs = await this.purgeRepo.deleteLogsBefore(cutoff);
            const breaks = await this.purgeRepo.deleteBreaksBefore(cutoff);
            console.log(`[PurgeJob] app=${policy.applicationId} retentionDays=${policy.retentionDays} ` +
                `logsDeleted=${logs} breaksDeleted=${breaks}`);
            logsDeleted += logs;
            breaksDeleted += breaks;
        }
        return { logsDeleted, breaksDeleted };
    }
    /**
     * Schedule the purge job to run on a recurring interval.
     * @param intervalMs - interval in milliseconds (e.g. 86_400_000 for daily)
     */
    schedule(intervalMs) {
        this.setIntervalFn(() => {
            this.run().catch((err) => {
                console.error('[PurgeJob] scheduled run failed:', err);
            });
        }, intervalMs);
    }
}
exports.PurgeJob = PurgeJob;
//# sourceMappingURL=purgeJob.js.map