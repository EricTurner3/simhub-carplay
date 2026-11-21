import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChannelMapping, ControlDef, GameProfileFile, ProfileInfo, Units } from '@simhub-carplay/shared';

export interface ResolvedProfile {
  id: string;
  name: string;
  short?: string;
  units?: Units;
  currency?: string;
  /** channel -> SimHub property or switch cases (nulls already removed) */
  channels: Record<string, ChannelMapping>;
  /** control id -> definition (nulls already removed), in display order */
  controls: Record<string, ControlDef>;
}

/** Channel every profile must keep: it's how the bridge knows which game is running. */
export const GAME_CHANNEL = 'game';

/** Loads games/*.json and resolves the effective profile for a SimHub game code. */
export class GameProfiles {
  private files = new Map<string, GameProfileFile>();

  constructor(dir: string) {
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const file = JSON.parse(readFileSync(join(dir, name), 'utf8')) as GameProfileFile;
      if (this.files.has(file.id)) throw new Error(`Duplicate game profile id "${file.id}" (${name})`);
      this.files.set(file.id, file);
    }
    if (!this.files.has('_default')) throw new Error(`games/_default.json is missing`);
    // Resolve everything once so a broken `extends` fails at startup, not mid-session.
    for (const id of this.files.keys()) this.flatten(id);
  }

  /** Profile for a game code (case-insensitive); `_default` if none matches. */
  resolve(game: string | null): ResolvedProfile {
    const code = game?.toLowerCase();
    const match = code
      ? [...this.files.values()].find((f) => !f.abstract && f.match?.some((m) => m.toLowerCase() === code))
      : undefined;
    return this.flatten(match?.id ?? '_default');
  }

  info(profile: ResolvedProfile, game: string | null): ProfileInfo {
    return {
      id: profile.id,
      game,
      name: profile.id === '_default' && game ? game : profile.name,
      short: profile.short ?? abbreviate(game),
      units: profile.units,
      currency: profile.currency,
      channels: Object.keys(profile.channels),
      controls: Object.entries(profile.controls).map(([id, def]) => ({ id, ...def })),
    };
  }

  private flatten(id: string, seen: string[] = []): ResolvedProfile {
    const file = this.files.get(id);
    if (!file) throw new Error(`Unknown game profile "${id}"${seen.length ? ` (extended by ${seen.at(-1)})` : ''}`);
    if (seen.includes(id)) throw new Error(`Circular game profile extends: ${[...seen, id].join(' -> ')}`);

    const parentId = file.extends ?? (id === '_default' ? undefined : '_default');
    const parent = parentId ? this.flatten(parentId, [...seen, id]) : undefined;

    const channels = { ...parent?.channels };
    for (const [ch, prop] of Object.entries(file.channels ?? {})) {
      if (prop === null) delete channels[ch];
      else channels[ch] = prop;
    }
    if (typeof channels[GAME_CHANNEL] !== 'string') throw new Error(`Game profile "${id}" removes or switches the "${GAME_CHANNEL}" channel`);
    for (const [ch, mapping] of Object.entries(channels)) {
      if (typeof mapping === 'string') continue;
      const bad = mapping.filter((c) => c.when !== undefined && typeof channels[c.when] !== 'string').map((c) => c.when);
      if (bad.length) throw new Error(`Game profile "${id}": channel "${ch}" switches on unknown or non-plain channel(s) ${bad.join(', ')}`);
    }

    const controls = { ...parent?.controls };
    for (const [ctl, def] of Object.entries(file.controls ?? {})) {
      if (def === null) delete controls[ctl];
      else controls[ctl] = def;
    }
    // A control whose state channel this game doesn't provide would never show feedback.
    for (const [ctl, def] of Object.entries(controls)) {
      const states = [def.state, ...(def.steps ?? []).map((s) => s.state)].filter(Boolean) as string[];
      const missing = states.filter((s) => !channels[s]);
      if (missing.length) throw new Error(`Game profile "${id}": control "${ctl}" uses unknown channel(s) ${missing.join(', ')}`);
    }

    return {
      id,
      name: file.name ?? parent?.name ?? id,
      short: file.short ?? parent?.short,
      units: file.units ?? parent?.units,
      currency: file.currency ?? parent?.currency,
      channels,
      controls,
    };
  }
}

/** "AssettoCorsaCompetizione" -> "ACC", "ForzaHorizon5" -> "FH5", "rf2" -> "RF2". */
export function abbreviate(game: string | null): string {
  if (!game) return '—';
  if (game.length <= 5) return game.toUpperCase();
  const caps = game.match(/[A-Z0-9]/g)?.join('') ?? '';
  return (caps.length >= 2 ? caps : game).slice(0, 5).toUpperCase();
}
