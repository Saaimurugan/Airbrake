"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultErrorAggregator = void 0;
const node_crypto_1 = require("node:crypto");
const fingerprint_1 = require("./fingerprint");
class DefaultErrorAggregator {
    constructor(breakGroups, breaks, indexer) {
        this.breakGroups = breakGroups;
        this.breaks = breaks;
        this.indexer = indexer;
    }
    async aggregate(b) {
        const fingerprint = (0, fingerprint_1.computeFingerprint)(b);
        const now = b.timestamp;
        let group;
        let status;
        const existing = await this.breakGroups.findByFingerprint(fingerprint);
        if (existing === null) {
            // New error — no group exists yet
            group = {
                id: (0, node_crypto_1.randomUUID)(),
                fingerprint,
                applicationId: b.applicationId,
                firstOccurrence: now,
                lastOccurrence: now,
                occurrenceCount: 1,
                status: 'open',
                severity: b.severity,
                errorMessage: b.errorMessage,
            };
            group = await this.breakGroups.save(group);
            status = 'new';
        }
        else if (existing.status === 'resolved') {
            // Regression — previously resolved, now re-occurring
            group = {
                ...existing,
                status: 'regression',
                lastOccurrence: now,
                occurrenceCount: existing.occurrenceCount + 1,
                severity: b.severity,
            };
            group = await this.breakGroups.update(group);
            status = 'regression';
        }
        else {
            // Existing open or regression group — just update counters
            group = {
                ...existing,
                lastOccurrence: now,
                occurrenceCount: existing.occurrenceCount + 1,
            };
            group = await this.breakGroups.update(group);
            status = 'existing';
        }
        const breakWithGroup = { ...b, fingerprint, groupId: group.id };
        await this.breaks.save(breakWithGroup);
        await this.indexer.indexBreak(breakWithGroup);
        await this.indexer.indexBreakGroup(group);
        return { group, status };
    }
}
exports.DefaultErrorAggregator = DefaultErrorAggregator;
//# sourceMappingURL=errorAggregator.js.map