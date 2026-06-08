import type { Break, BreakGroup, AggregationResult } from '@portal/shared';
export interface BreakGroupRepository {
    findByFingerprint(fingerprint: string): Promise<BreakGroup | null>;
    save(group: BreakGroup): Promise<BreakGroup>;
    update(group: BreakGroup): Promise<BreakGroup>;
}
export interface BreakRepository {
    save(b: Break & {
        groupId: string;
    }): Promise<void>;
}
export interface SearchIndexer {
    indexBreak(b: Break & {
        groupId: string;
    }): Promise<void>;
    indexBreakGroup(group: BreakGroup): Promise<void>;
}
export interface ErrorAggregator {
    aggregate(b: Break): Promise<AggregationResult>;
}
export declare class DefaultErrorAggregator implements ErrorAggregator {
    private readonly breakGroups;
    private readonly breaks;
    private readonly indexer;
    constructor(breakGroups: BreakGroupRepository, breaks: BreakRepository, indexer: SearchIndexer);
    aggregate(b: Break): Promise<AggregationResult>;
}
