import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig, SourceKind } from '@simhub-carplay/shared';

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
  const game = arg('--game');
  if (game) config.mock.game = game;
  return { config, path };
}
