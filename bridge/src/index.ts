import { resolve } from 'node:path';
import { loadConfig, repoRoot } from './config.ts';
import { GAME_CHANNEL, GameProfiles, type ResolvedProfile } from './games.ts';
import { MEDIA_CHANNELS, WindowsMedia } from './media/windowsMedia.ts';
import { ChannelMux } from './channelMux.ts';
import { SettingsStore } from './settings.ts';
import { ControlRunner } from './controls.ts';
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

// With media.source "windows" the bridge reads Now Playing itself; the profile's
// SimHub media.* mappings are dropped so they can't overwrite it.
const media = config.media.source === 'windows' ? new WindowsMedia(config.media, (ch, v) => store.set(ch, v)) : null;
const mediaChannels: string[] = media ? [...MEDIA_CHANNELS] : [];
const isMedia = (ch: string) => media !== null && ch.startsWith('media.');

/** The profile's channel -> property map, minus what another source provides. */
const sourceChannels = (p: ResolvedProfile) => Object.fromEntries(Object.entries(p.channels).filter(([ch]) => !isMedia(ch)));
const allChannels = () => [...Object.keys(sourceChannels(profile)), ...mediaChannels];
function profileInfo() {
  const info = games.info(profile, game);
  return { ...info, channels: [...new Set([...info.channels, ...mediaChannels])] };
}

const store = new TelemetryStore(allChannels());
const mux = new ChannelMux((channel, value) => store.set(channel, value));
const controls = new ControlRunner(config.controls, source, () => profile.controls);
const settings = new SettingsStore(path, config.ui);
const server = startServer(config, store, source.name, resolve(repoRoot, 'ui/dist'), profileInfo(), controls, settings, media);
source.setProperties(mux.setChannels(sourceChannels(profile)));
media?.start();

/** The running game changed: swap the channel set and resubscribe. */
function switchGame(next: string | null) {
  const prev = sourceChannels(profile);
  controls.releaseAll();
  game = next;
  profile = games.resolve(next);
  const channels = sourceChannels(profile);
  const props = mux.setChannels(channels);
  // Keep values whose property didn't change; the source won't resend those.
  // Switched channels are recomputed from what the mux still has cached.
  store.setChannels(allChannels(), (ch) => {
    if (isMedia(ch)) return true;
    const mapping = channels[ch];
    return typeof mapping === 'string' && prev[ch] === mapping;
  });
  for (const [ch, mapping] of Object.entries(channels)) {
    if (typeof mapping !== 'string') store.set(ch, mux.resolve(ch));
  }
  source.setProperties(props);
  server.setProfile(profileInfo());
  console.log(`[bridge] game: ${next ?? 'none'} -> profile "${profile.id}" (${Object.keys(profile.channels).length} channels)`);
}

let lastLogged = '';
source.start({
  set: (channel, value) => {
    if (isMedia(channel)) return; // e.g. the mock's fake track
    mux.set(channel, value);
    if (channel === GAME_CHANNEL) {
      const next = typeof value === 'string' && value.trim() ? value.trim() : null;
      if (next !== game) switchGame(next);
    }
  },
  clear: () => {
    mux.clear();
    store.clear();
    media?.replay(); // SimHub going away doesn't stop the music
  },
  status: (upstream, detail) => {
    const line = `${upstream}${detail ? ` (${detail})` : ''}`;
    if (line !== lastLogged) console.log(`[${source.name}] ${line}`);
    lastLogged = line;
    server.setStatus(upstream, detail);
  },
});

function shutdown() {
  source.stop();
  media?.stop();
  server.close();
  setTimeout(() => process.exit(0), 200).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
