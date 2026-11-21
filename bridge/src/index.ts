import { resolve } from 'node:path';
import { loadConfig, repoRoot } from './config.ts';
import { GAME_CHANNEL, GameProfiles } from './games.ts';
import { TelemetryStore } from './store.ts';
import { startServer } from './server.ts';
import { MockSource } from './sources/mock.ts';
import { PropertyServerSource } from './sources/propertyServer.ts';
import type { TelemetrySource } from './sources/source.ts';

const { config, path } = loadConfig();
console.log(`[bridge] config: ${path}`);

const games = new GameProfiles(resolve(repoRoot, 'games'));
let game: string | null = null;
let profile = games.resolve(null);

const source: TelemetrySource =
  config.bridge.source === 'mock' ? new MockSource(config.mock) : new PropertyServerSource(config.propertyServer);
console.log(`[bridge] source: ${source.name}`);

const store = new TelemetryStore(Object.keys(profile.channels));
const server = startServer(config, store, source.name, resolve(repoRoot, 'ui/dist'), games.info(profile, game));
source.setProperties(profile.channels);

/** The running game changed: swap the channel set and resubscribe. */
function switchGame(next: string | null) {
  const prev = profile.channels;
  game = next;
  profile = games.resolve(next);
  // Keep values whose property didn't change; the source won't resend those.
  store.setChannels(Object.keys(profile.channels), (ch) => prev[ch] === profile.channels[ch]);
  source.setProperties(profile.channels);
  server.setProfile(games.info(profile, game));
  console.log(`[bridge] game: ${next ?? 'none'} -> profile "${profile.id}" (${Object.keys(profile.channels).length} channels)`);
}

let lastLogged = '';
source.start({
  set: (channel, value) => {
    store.set(channel, value);
    if (channel === GAME_CHANNEL) {
      const next = typeof value === 'string' && value.trim() ? value.trim() : null;
      if (next !== game) switchGame(next);
    }
  },
  clear: () => store.clear(),
  status: (upstream, detail) => {
    const line = `${upstream}${detail ? ` (${detail})` : ''}`;
    if (line !== lastLogged) console.log(`[${source.name}] ${line}`);
    lastLogged = line;
    server.setStatus(upstream, detail);
  },
});

function shutdown() {
  source.stop();
  server.close();
  setTimeout(() => process.exit(0), 200).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
