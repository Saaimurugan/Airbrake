export interface PubSubSubscriber {
    subscribe(channel: string, handler: (message: string) => void): void;
    unsubscribe(channel: string): void;
}
export interface WebSocketClient {
    send(data: string): void;
    isAlive: boolean;
    sessionToken?: string;
}
export interface EventReplayStore {
    store(channel: string, message: string, timestamp: Date): Promise<void>;
    getRecent(channel: string, since: Date): Promise<string[]>;
}
export declare const DISCONNECT_MESSAGE: string;
export declare class WebSocketServer {
    private readonly pubSub;
    private readonly replayStore;
    private readonly channels;
    private clients;
    constructor(pubSub: PubSubSubscriber, replayStore: EventReplayStore, channels?: string[]);
    addClient(client: WebSocketClient): void;
    removeClient(client: WebSocketClient): void;
    handleMessage(channel: string, message: string): void;
    replayMissedEvents(client: WebSocketClient, since: Date): Promise<void>;
    getClientCount(): number;
}
