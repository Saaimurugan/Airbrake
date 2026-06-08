"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const purgeJob_1 = require("../purgeJob");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makePurgeRepo(logsDeleted = 0, breaksDeleted = 0) {
    return {
        deleteLogsBefore: jest.fn().mockResolvedValue(logsDeleted),
        deleteBreaksBefore: jest.fn().mockResolvedValue(breaksDeleted),
    };
}
function makePolicyReader(policies) {
    return {
        findAll: jest.fn().mockResolvedValue(policies),
    };
}
const NOW = new Date('2024-06-01T12:00:00Z');
function cutoffFor(days) {
    return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}
// ─── PurgeJob.run() tests ─────────────────────────────────────────────────────
describe('PurgeJob.run()', () => {
    it('calls deleteLogsBefore with correct cutoff for a 30-day policy', async () => {
        const repo = makePurgeRepo(5, 0);
        const job = new purgeJob_1.PurgeJob(repo, makePolicyReader([{ applicationId: 'app-1', retentionDays: 30 }]));
        await job.run(NOW);
        expect(repo.deleteLogsBefore).toHaveBeenCalledWith(cutoffFor(30));
    });
    it('calls deleteBreaksBefore with correct cutoff for a 30-day policy', async () => {
        const repo = makePurgeRepo(0, 3);
        const job = new purgeJob_1.PurgeJob(repo, makePolicyReader([{ applicationId: 'app-1', retentionDays: 30 }]));
        await job.run(NOW);
        expect(repo.deleteBreaksBefore).toHaveBeenCalledWith(cutoffFor(30));
    });
    it('returns correct total counts from a single policy', async () => {
        const repo = makePurgeRepo(10, 4);
        const job = new purgeJob_1.PurgeJob(repo, makePolicyReader([{ applicationId: 'app-1', retentionDays: 60 }]));
        const result = await job.run(NOW);
        expect(result.logsDeleted).toBe(10);
        expect(result.breaksDeleted).toBe(4);
    });
    it('handles multiple retention policies and sums totals', async () => {
        const repo = {
            deleteLogsBefore: jest.fn()
                .mockResolvedValueOnce(7) // app-1
                .mockResolvedValueOnce(3), // app-2
            deleteBreaksBefore: jest.fn()
                .mockResolvedValueOnce(2) // app-1
                .mockResolvedValueOnce(5), // app-2
        };
        const policies = [
            { applicationId: 'app-1', retentionDays: 30 },
            { applicationId: 'app-2', retentionDays: 90 },
        ];
        const job = new purgeJob_1.PurgeJob(repo, makePolicyReader(policies));
        const result = await job.run(NOW);
        expect(result.logsDeleted).toBe(10);
        expect(result.breaksDeleted).toBe(7);
        expect(repo.deleteLogsBefore).toHaveBeenCalledTimes(2);
        expect(repo.deleteLogsBefore).toHaveBeenNthCalledWith(1, cutoffFor(30));
        expect(repo.deleteLogsBefore).toHaveBeenNthCalledWith(2, cutoffFor(90));
    });
    it('does nothing and returns zeros when there are no policies', async () => {
        const repo = makePurgeRepo(0, 0);
        const job = new purgeJob_1.PurgeJob(repo, makePolicyReader([]));
        const result = await job.run(NOW);
        expect(result.logsDeleted).toBe(0);
        expect(result.breaksDeleted).toBe(0);
        expect(repo.deleteLogsBefore).not.toHaveBeenCalled();
        expect(repo.deleteBreaksBefore).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=purgeJob.test.js.map