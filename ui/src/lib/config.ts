import type { ClientConfig } from '@simhub-carplay/shared';

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

function configUrl(): string {
  const ws = params.get('ws');
  if (!ws) return 'config.json';
  const u = new URL(ws);
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
  u.pathname = '/config.json';
  return u.toString();
}

export const debugFromUrl = params.has('debug');

/** Fetch config from the bridge, retrying until it answers. */
export async function loadConfig(onWaiting: (attempt: number) => void): Promise<ClientConfig> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(configUrl(), { cache: 'no-store' });
      if (res.ok) return (await res.json()) as ClientConfig;
    } catch {
      /* bridge not up yet */
    }
    onWaiting(attempt);
    await new Promise((r) => setTimeout(r, Math.min(5000, 500 * attempt)));
  }
}
