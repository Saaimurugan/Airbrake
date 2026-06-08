"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirbrakeClient = void 0;
exports.encryptApiKey = encryptApiKey;
exports.decryptApiKey = decryptApiKey;
const crypto = __importStar(require("node:crypto"));
const breakParser_1 = require("../parsers/breakParser");
// ─── Encryption Helpers ───────────────────────────────────────────────────────
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits (recommended for GCM)
const TAG_LENGTH = 16; // 128 bits
/**
 * Derives a 256-bit key from an arbitrary-length passphrase using SHA-256.
 * In production, use a dedicated KMS-managed key instead.
 */
function deriveKey(passphrase) {
    return crypto.createHash('sha256').update(passphrase).digest();
}
/**
 * Encrypts a plaintext string using AES-256-GCM.
 * The passphrase is used to derive the encryption key.
 * Returns an EncryptedValue — never the plaintext.
 */
function encryptApiKey(plaintext, passphrase) {
    const key = deriveKey(passphrase);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        ciphertext: ciphertext.toString('hex'),
    };
}
/**
 * Decrypts an EncryptedValue produced by encryptApiKey.
 * Returns the original plaintext string.
 */
function decryptApiKey(encrypted, passphrase) {
    const key = deriveKey(passphrase);
    const iv = Buffer.from(encrypted.iv, 'hex');
    const tag = Buffer.from(encrypted.tag, 'hex');
    const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
}
// ─── Retry Helper ─────────────────────────────────────────────────────────────
const RETRY_DELAYS_MS = [1000, 2000, 4000];
async function withRetry(fn, delays = RETRY_DELAYS_MS) {
    let lastError;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            if (attempt < delays.length) {
                await sleep(delays[attempt]);
            }
        }
    }
    throw lastError;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// ─── Response Helpers ─────────────────────────────────────────────────────────
function hasGroupsArray(v) {
    return (v !== null &&
        typeof v === 'object' &&
        'groups' in v &&
        Array.isArray(v.groups));
}
function extractItems(response) {
    if (hasGroupsArray(response))
        return response.groups;
    if (Array.isArray(response))
        return response;
    return [];
}
// Internal passphrase used to encrypt the API key in memory.
// In production this should come from an environment variable / secrets manager.
const INTERNAL_PASSPHRASE = process.env.AIRBRAKE_KEY_PASSPHRASE ?? 'default-dev-passphrase';
// ─── AirbrakeClient ───────────────────────────────────────────────────────────
class AirbrakeClient {
    constructor(config, httpClient, redisPublisher) {
        this.breakHandlers = [];
        this.timer = null;
        // Encrypt the API key immediately — plaintext is never stored
        this.encryptedApiKey = encryptApiKey(config.apiKey, INTERNAL_PASSPHRASE);
        this.projectId = config.projectId;
        this.pollIntervalMs = config.pollIntervalMs;
        this.httpClient = httpClient;
        this.redisPublisher = redisPublisher;
    }
    /** Start polling the Airbrake API at the configured interval. */
    start() {
        if (this.timer !== null)
            return; // already running
        this.timer = setInterval(() => {
            this.poll().catch(() => {
                // errors are already logged inside poll(); prevent unhandled rejection
            });
        }, this.pollIntervalMs);
    }
    /** Stop polling. */
    stop() {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    /** Register a handler called for each successfully parsed Break. */
    onBreak(handler) {
        this.breakHandlers.push(handler);
    }
    // ─── Internal ──────────────────────────────────────────────────────────────
    async poll() {
        let rawItems;
        try {
            rawItems = await withRetry(() => this.fetchBreaks());
        }
        catch (err) {
            // All 3 attempts failed — log without exposing the API key and bail
            const message = err instanceof Error ? err.message : String(err);
            console.error('[AirbrakeClient] Failed to fetch breaks after retries:', message);
            return;
        }
        for (const item of rawItems) {
            await this.processItem(item);
        }
    }
    async processItem(item) {
        const result = await (0, breakParser_1.parseBreak)(item);
        if (!result.success)
            return;
        const breakRecord = result.record;
        try {
            await this.redisPublisher.publish('breaks', (0, breakParser_1.serializeBreak)(breakRecord));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[AirbrakeClient] Failed to publish break to Redis:', message);
        }
        for (const handler of this.breakHandlers) {
            try {
                handler(breakRecord);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error('[AirbrakeClient] Break handler threw:', message);
            }
        }
    }
    async fetchBreaks() {
        // Decrypt the key only at the moment of use — never store plaintext
        const apiKey = decryptApiKey(this.encryptedApiKey, INTERNAL_PASSPHRASE);
        const url = `https://api.airbrake.io/api/v4/projects/${this.projectId}/groups`;
        const response = await this.httpClient.get(url, {
            Authorization: `Bearer ${apiKey}`,
        });
        return extractItems(response);
    }
}
exports.AirbrakeClient = AirbrakeClient;
//# sourceMappingURL=airbrakeClient.js.map