import { Break } from '@portal/shared';
export interface EncryptedValue {
    iv: string;
    tag: string;
    ciphertext: string;
}
/**
 * Encrypts a plaintext string using AES-256-GCM.
 * The passphrase is used to derive the encryption key.
 * Returns an EncryptedValue — never the plaintext.
 */
export declare function encryptApiKey(plaintext: string, passphrase: string): EncryptedValue;
/**
 * Decrypts an EncryptedValue produced by encryptApiKey.
 * Returns the original plaintext string.
 */
export declare function decryptApiKey(encrypted: EncryptedValue, passphrase: string): string;
export interface HttpClient {
    get(url: string, headers: Record<string, string>): Promise<unknown>;
}
export interface RedisPublisher {
    publish(channel: string, message: string): Promise<void>;
}
export interface AirbrakeClientConfig {
    apiKey: string;
    projectId: string;
    pollIntervalMs: number;
}
export declare class AirbrakeClient {
    private readonly encryptedApiKey;
    private readonly projectId;
    private readonly pollIntervalMs;
    private readonly httpClient;
    private readonly redisPublisher;
    private readonly breakHandlers;
    private timer;
    constructor(config: AirbrakeClientConfig, httpClient: HttpClient, redisPublisher: RedisPublisher);
    /** Start polling the Airbrake API at the configured interval. */
    start(): void;
    /** Stop polling. */
    stop(): void;
    /** Register a handler called for each successfully parsed Break. */
    onBreak(handler: (b: Break) => void): void;
    private poll;
    private processItem;
    private fetchBreaks;
}
