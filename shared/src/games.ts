/**
 * Game profiles (repo-root games/*.json) map channel names to SimHub property
 * names per game. A profile inherits from `extends` (and ultimately from
 * `_default`); a channel set to null is removed, so apps that need it are hidden.
 */

export type Units = 'kmh' | 'mph';

/**
 * A vehicle control the UI can operate. The bridge fires a SimHub input trigger
 * (Property Server `trigger-input-pressed/released`, named `<inputPrefix><id>`
 * unless `input` is set); in SimHub that input is mapped to a key via
 * Controls and events -> Keyboard emulation.
 *
 * - toggle:    one tap flips it; `state` is the channel showing whether it's on
 * - momentary: held while the button is held (horn); no state
 * - cycle:     one key steps through `steps` (e.g. lights off -> parking -> low);
 *              the current step is the last one whose `state` is on
 */
export interface ControlDef {
  kind: 'toggle' | 'momentary' | 'cycle';
  label?: string;
  state?: string;
  steps?: { label: string; state?: string }[];
  /** Override the SimHub input name (default `<controls.inputPrefix><id>`). */
  input?: string;
}

export type ControlInfo = ControlDef & { id: string };

/**
 * One candidate source for a switched channel. A channel mapped to a list of
 * cases takes its value from the first case whose `when` channel is on (a case
 * without `when` always matches). `prop: null` means "no value" for that case.
 * `when` must name a plain (non-switched) channel of the same profile.
 *
 *   "job.cargo": [
 *     { "when": "job.onCarJob", "prop": "...CarJobValues.CargoValues.Name" },
 *     { "prop": "...JobValues.CargoValues.Name" }
 *   ]
 */
export interface ChannelCase {
  when?: string;
  prop: string | null;
}

export type ChannelMapping = string | ChannelCase[];

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
  channels?: Record<string, ChannelMapping | null>;
  /** Controls this game supports (null removes an inherited one). */
  controls?: Record<string, ControlDef | null>;
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
  /** Controls the UI may operate for this game, in display order. */
  controls: ControlInfo[];
}
