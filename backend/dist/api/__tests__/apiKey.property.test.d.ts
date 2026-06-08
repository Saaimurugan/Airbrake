/**
 * Checks whether a plaintext API key appears anywhere in the serialized response body.
 * Returns true if the key is found (i.e., the key IS exposed — bad).
 */
export declare function containsApiKey(responseBody: unknown, apiKey: string): boolean;
