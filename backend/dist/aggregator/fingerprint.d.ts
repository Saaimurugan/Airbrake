import type { Break } from '@portal/shared';
/**
 * Computes a deterministic SHA-256 fingerprint for a Break record.
 * The fingerprint is derived from errorMessage, stackTrace, and applicationId.
 */
export declare function computeFingerprint(b: Pick<Break, 'errorMessage' | 'stackTrace' | 'applicationId'>): string;
