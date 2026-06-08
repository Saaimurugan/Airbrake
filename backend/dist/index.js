"use strict";
/**
 * Local development server entry point.
 *
 * Imports the shared Express app from app.ts and starts an HTTP server
 * with WebSocket support on PORT (default 3001).
 *
 * This file is NOT used by Lambda — see lambda.ts for the Lambda handler.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const ws_1 = __importDefault(require("ws"));
const app_1 = require("./app");
const client_1 = require("./db/client");
const alertChecker_1 = require("./alerts/alertChecker");
const wsServer_1 = require("./websocket/wsServer");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');
// ─── Serve frontend build (local dev only) ────────────────────────────────────
const distPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
    app_1.app.use(express.static(distPath));
    // SPA fallback — only for non-API routes
    app_1.app.get(/^(?!\/api).*$/, (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`[Server] serving frontend build from ${distPath}`);
}
else {
    console.log('[Server] no frontend dist found — skipping static file serving');
}
// ─── WebSocket stub adapters ──────────────────────────────────────────────────
const redisPubSub = {
    subscribe: (channel, _handler) => {
        console.log(`[Redis] subscribed to ${channel}`);
    },
    unsubscribe: (channel) => {
        console.log(`[Redis] unsubscribed from ${channel}`);
    },
};
const replayStore = {
    store: async (_channel, _message, _ts) => { },
    getRecent: async (_channel, _since) => [],
};
const wsServer = new wsServer_1.WebSocketServer(redisPubSub, replayStore);
// ─── HTTP server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const server = app_1.app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] listening on http://localhost:${PORT}`);
    console.log(`[Server] API docs at http://localhost:${PORT}/api/docs`);
    (0, alertChecker_1.startAlertEngine)(client_1.pool).catch(err => console.error('[AlertEngine] failed to start:', err));
});
// ─── WebSocket upgrade ────────────────────────────────────────────────────────
const wss = new ws_1.default.Server({ noServer: true });
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        const client = {
            isAlive: true,
            send: (data) => ws.send(data),
        };
        wsServer.addClient(client);
        ws.on('close', () => wsServer.removeClient(client));
    });
});
// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down…');
    server.close(() => {
        client_1.pool.end();
        process.exit(0);
    });
});
// Prevent unhandled DB/async errors from crashing the process
process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection:', reason);
});
//# sourceMappingURL=index.js.map