import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import {
  PROTOCOL_VERSION,
  isInputAction,
  MEDIA_ACTIONS,
  type AppConfig,
  type ClientConfig,
  type ProfileInfo,
  type ClientMessage,
  type ProfileMsg,
  type RouteMsg,
  type ServerMessage,
  type StatusMsg,
} from '@simhub-carplay/shared';
import type { TelemetryStore } from './store.ts';
import type { ControlRunner } from './controls.ts';
import type { SettingsStore } from './settings.ts';
import { ART_PATH, type WindowsMedia } from './media/windowsMedia.ts';
import { serveMapFile } from './mapFiles.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

export interface BridgeServer {
  setStatus(upstream: StatusMsg['upstream'], detail?: string): void;
  /** Game profile changed: tell clients, then resync them (the channel set changed). */
  setProfile(profile: ProfileInfo): void;
  /** Truck navigation route changed (null: none). */
  setRoute(route: RouteMsg['route']): void;
  close(): void;
}

/**
 * One port serves everything, same-origin:
 *   GET  /config.json         client part of config.json
 *   WS   /ws                  telemetry protocol (see shared/src/protocol.ts)
 *   POST /api/input/<action>  inject a navigation action (testing / external triggers)
 *   POST /api/control/<id>    tap a vehicle control (?count=n); handy while mapping it in SimHub
 *   GET  /media/art           current album art (media.source "windows")
 *   GET  /maps/*              generated map tiles and sprites (see mapFiles.ts)
 *   GET  /*                   built UI from ui/dist
 */
export function startServer(
  config: AppConfig,
  store: TelemetryStore,
  backend: string,
  uiDist: string,
  initialProfile: ProfileInfo,
  controls: ControlRunner,
  settings: SettingsStore,
  media: WindowsMedia | null,
  mapsDir: string,
): BridgeServer {
  let status: StatusMsg = { t: 'status', upstream: 'connecting' };
  let profileMsg: ProfileMsg = { t: 'profile', profile: initialProfile };
  let routeMsg: RouteMsg = { t: 'route', route: null };

  const clientConfig: ClientConfig = {
    protocolVersion: PROTOCOL_VERSION,
    ui: config.ui,
  };

  const http = createServer((req, res) => {
    handleHttp(req, res).catch((err) => {
      console.error('[http]', err);
      if (!res.headersSent) res.writeHead(500).end('Internal error');
    });
  });

  async function handleHttp(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/config.json') {
      res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
      res.end(JSON.stringify(clientConfig));
      return;
    }

    if (url.pathname === `/${ART_PATH}`) {
      const art = media?.art();
      if (!art) {
        res.writeHead(404).end();
        return;
      }
      // The URL carries ?v=<art id>, so a given URL always means the same image.
      res.writeHead(200, { 'content-type': art.mime, 'cache-control': 'public, max-age=86400' });
      res.end(art.data);
      return;
    }

    const input = /^\/api\/input\/(\w+)$/.exec(url.pathname);
    if (input && req.method === 'POST') {
      const action = input[1];
      if (!isInputAction(action)) {
        res.writeHead(400).end(`Unknown action "${action}"`);
        return;
      }
      broadcast({ t: 'input', action });
      res.writeHead(204).end();
      return;
    }

    const control = /^\/api\/control\/(\w+)$/.exec(url.pathname);
    if (control && req.method === 'POST') {
      const err = controls.handle({ id: control[1], action: 'tap', count: Number(url.searchParams.get('count') ?? 1) });
      if (err) res.writeHead(409, { 'content-type': 'text/plain' }).end(err);
      else res.writeHead(204).end();
      return;
    }

    if (await serveMapFile(mapsDir, url.pathname, req, res)) return;
    await serveStatic(url.pathname, res);
  }

  async function serveStatic(pathname: string, res: ServerResponse) {
    const root = resolve(uiDist);
    let file = normalize(join(root, decodeURIComponent(pathname)));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    } catch {
      file = join(root, 'index.html'); // SPA fallback
    }
    try {
      const body = await readFile(file);
      const ext = extname(file);
      res.writeHead(200, {
        'content-type': MIME[ext] ?? 'application/octet-stream',
        'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('UI not built. Run "npm run build" (or use "npm run dev" and open the Vite URL).');
    }
  }

  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  const alive = new WeakMap<WebSocket, boolean>();

  http.on('upgrade', (req, socket, head) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    ws.on('message', (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(data)) as ClientMessage;
      } catch {
        return;
      }
      if (msg.t === 'settings') {
        try {
          const err = settings.apply(msg.patch);
          if (err) console.warn(`[settings] rejected: ${err}`);
          // Always broadcast, so a rejected change snaps the sender back to the real value.
          broadcast({ t: 'config', ui: config.ui });
        } catch (e) {
          console.error('[settings]', e);
        }
      }
      if (msg.t === 'media' && (MEDIA_ACTIONS as readonly string[]).includes(msg.action)) {
        if (!media?.command(msg.action)) console.warn(`[media] ${msg.action}: no Windows media source running`);
      }
      if (msg.t === 'control') {
        try {
          const err = controls.handle(msg);
          if (err) console.warn(`[control] ${msg.id}/${msg.action}: ${err}`);
        } catch (e) {
          console.error('[control]', e);
        }
      }
    });
    // A held control (horn) must not stay down if the screen drops off the network.
    ws.on('close', () => controls.releaseAll());
    send(ws, { t: 'hello', v: PROTOCOL_VERSION, backend });
    send(ws, status);
    send(ws, profileMsg);
    send(ws, { t: 'snapshot', ts: Date.now(), d: store.snapshot() });
    send(ws, routeMsg);
    console.log(`[ws] client connected from ${req.socket.remoteAddress} (${wss.clients.size} total)`);
    ws.on('close', () => console.log(`[ws] client disconnected (${wss.clients.size} total)`));
  });

  const flush = setInterval(() => {
    const d = store.takeDelta();
    if (d) broadcast({ t: 'delta', ts: Date.now(), d });
  }, 1000 / config.bridge.broadcastHz);

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, 10_000);

  function send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }

  http.listen(config.bridge.port, config.bridge.host, () => {
    console.log(`[http] UI + WebSocket on http://${config.bridge.host === '0.0.0.0' ? 'localhost' : config.bridge.host}:${config.bridge.port}  (ws path /ws)`);
  });

  return {
    setStatus(upstream, detail) {
      if (status.upstream === upstream && status.detail === detail) return;
      status = { t: 'status', upstream, detail };
      broadcast(status);
    },
    setProfile(profile) {
      profileMsg = { t: 'profile', profile };
      broadcast(profileMsg);
      broadcast({ t: 'snapshot', ts: Date.now(), d: store.snapshot() });
    },
    setRoute(route) {
      routeMsg = { t: 'route', route };
      broadcast(routeMsg);
    },
    close() {
      clearInterval(flush);
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.close(1001, 'bridge shutting down');
      http.close();
    },
  };
}
