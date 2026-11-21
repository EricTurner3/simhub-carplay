import { DEFAULT_APPEARANCE, type ClientConfig } from '@simhub-carplay/shared';

const params = new URLSearchParams(location.search);

/**
 * WebSocket URL. Same origin by default (bridge serves the UI and /ws; Vite proxies
 * it in dev). Override with ?ws=ws://host:port/ws, e.g. when the page is loaded
 * from somewhere other than the bridge.
 */
export function wsUrl(): string {
  const override = params.get('ws');
  if (override) return override;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

/** URL of a bridge HTTP path (e.g. "media/art?v=3"): same origin, or the ?ws= bridge's. */
export function bridgeUrl(path: string): string {
  const ws = params.get('ws');
  if (!ws) return path;
  const u = new URL(ws);
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
  return new URL(path, `${u.origin}/`).toString();
}

const configUrl = () => bridgeUrl('config.json');

export const debugFromUrl = params.has('debug');

/**
 * Fill settings the bridge didn't send. A bridge started before a setting was
 * added (or an older backend) omits it, and e.g. a missing icon scale would
 * leave the app grid with NaN columns.
 */
function withDefaults(cfg: ClientConfig): ClientConfig {
  const a = { ...DEFAULT_APPEARANCE, ...cfg.ui.appearance };
  cfg.ui.appearance = { ...a, custom: { ...DEFAULT_APPEARANCE.custom, ...a.custom } };
  return cfg;
}

/** Fetch config from the bridge, retrying until it answers. */
export async function loadConfig(onWaiting: (attempt: number) => void): Promise<ClientConfig> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(configUrl(), { cache: 'no-store' });
      if (res.ok) return withDefaults((await res.json()) as ClientConfig);
    } catch {
      /* bridge not up yet */
    }
    onWaiting(attempt);
    await new Promise((r) => setTimeout(r, Math.min(5000, 500 * attempt)));
  }
}
