/**
 * Local development server entry point.
 *
 * Imports the shared Express app from app.ts and starts an HTTP server
 * with WebSocket support on PORT (default 3001).
 *
 * This file is NOT used by Lambda — see lambda.ts for the Lambda handler.
 */

import 'dotenv/config';
import WS from 'ws';
import { app } from './app';
import { pool } from './db/client';
import { startAlertEngine } from './alerts/alertChecker';
import { WebSocketServer } from './websocket/wsServer';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');

// ─── Serve frontend build (local dev only) ────────────────────────────────────
const distPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback — only for non-API routes
  app.get(/^(?!\/api).*$/, (_req: any, res: any) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log(`[Server] serving frontend build from ${distPath}`);
} else {
  console.log('[Server] no frontend dist found — skipping static file serving');
}

// ─── WebSocket stub adapters ──────────────────────────────────────────────────
const redisPubSub = {
  subscribe: (channel: string, _handler: (msg: string) => void) => {
    console.log(`[Redis] subscribed to ${channel}`);
  },
  unsubscribe: (channel: string) => {
    console.log(`[Redis] unsubscribed from ${channel}`);
  },
};
const replayStore = {
  store: async (_channel: string, _message: string, _ts: Date) => {},
  getRecent: async (_channel: string, _since: Date): Promise<string[]> => [],
};
const wsServer = new WebSocketServer(redisPubSub, replayStore);

// ─── HTTP server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3001', 10);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] listening on http://localhost:${PORT}`);
  console.log(`[Server] API docs at http://localhost:${PORT}/api/docs`);
  startAlertEngine(pool).catch(err => console.error('[AlertEngine] failed to start:', err));
});

// ─── WebSocket upgrade ────────────────────────────────────────────────────────
const wss = new WS.Server({ noServer: true });

server.on('upgrade', (request: any, socket: any, head: any) => {
  wss.handleUpgrade(request, socket, head, (ws: any) => {
    const client = {
      isAlive: true,
      send: (data: string) => ws.send(data),
    };
    wsServer.addClient(client);
    ws.on('close', () => wsServer.removeClient(client));
  });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down…');
  server.close(() => {
    pool.end();
    process.exit(0);
  });
});

// Prevent unhandled DB/async errors from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});
