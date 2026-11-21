/**
 * Game profiles (repo-root games/*.json) map channel names to SimHub property
 * names per game. A profile inherits from `extends` (and ultimately from
 * `_default`); a channel set to null is removed, so apps that need it are hidden.
 */

export type Units = 'kmh' | 'mph';

export interface GameProfileFile {
  id: string;
  name?: string;
  /** Short label shown in the dock, e.g. "ATS". */
  short?: string;
  /** SimHub `DataCorePlugin.CurrentGame` codes this profile applies to. */
  match?: string[];
  /** Parent profile id. Everything implicitly extends `_default`. */
  extends?: string;
  /** Base profiles that only exist to be extended. */
  abstract?: boolean;
  units?: Units;
  currency?: string;
  channels?: Record<string, string | null>;
}

/** What the UI learns about the active game. */
export interface ProfileInfo {
  id: string;
  /** Raw SimHub game code, or null when no game is reported. */
  game: string | null;
  name: string;
  short: string;
  units?: Units;
  currency?: string;
  /** Channels this game provides. Apps use it to decide whether they're available. */
  channels: string[];
}
