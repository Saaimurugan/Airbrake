"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFingerprint = computeFingerprint;
const crypto_1 = require("crypto");
/**
 * Computes a deterministic SHA-256 fingerprint for a Break record.
 * The fingerprint is derived from errorMessage, stackTrace, and applicationId.
 */
function computeFingerprint(b) {
    return (0, crypto_1.createHash)('sha256')
        .update(b.errorMessage)
        .update(b.stackTrace)
        .update(b.applicationId)
        .digest('hex');
}
//# sourceMappingURL=fingerprint.js.map