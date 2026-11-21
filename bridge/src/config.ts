import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_APPEARANCE, DEFAULT_MEDIA, type AppConfig, type SourceKind } from '@simhub-carplay/shared';

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, '../..');

/**
 * Loads config.json from the repo root (or --config <path> / CARPLAY_CONFIG).
 * CLI overrides: --mock (same as --source mock), --source <mock|propertyServer>,
 * --game <SimHub game code> (which game the mock pretends to be, e.g. ATS).
 */
export function loadConfig(argv = process.argv.slice(2)): { config: AppConfig; path: string } {
  const arg = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const path = resolve(arg('--config') ?? process.env.CARPLAY_CONFIG ?? resolve(repoRoot, 'config.json'));
  let config: AppConfig;
  try {
    config = JSON.parse(readFileSync(path, 'utf8')) as AppConfig;
  } catch (err) {
    throw new Error(`Could not read config at ${path}: ${(err as Error).message}`);
  }

  const source = argv.includes('--mock') ? 'mock' : arg('--source');
  if (source) {
    if (source !== 'mock' && source !== 'propertyServer') throw new Error(`Unknown --source "${source}"`);
    config.bridge.source = source as SourceKind;
  }
  // Sections added after the first release: fill defaults so older config files keep working.
  const partial = config as Partial<AppConfig> & Pick<AppConfig, 'mock'>;
  config.controls = { inputPrefix: 'carplay.', tapMs: 120, gapMs: 300, ...partial.controls };
  config.mock = { ...config.mock, game: partial.mock.game ?? 'AssettoCorsa' };
  config.media = { ...DEFAULT_MEDIA, ...partial.media };
  const appearance = { ...DEFAULT_APPEARANCE, ...config.ui.appearance };
  config.ui.appearance = { ...appearance, custom: { ...DEFAULT_APPEARANCE.custom, ...appearance.custom } };

  const game = arg('--game');
  if (game) config.mock.game = game;
  return { config, path };
}
