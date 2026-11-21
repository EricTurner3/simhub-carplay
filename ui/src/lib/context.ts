import { getContext, setContext } from 'svelte';
import type { ClientConfig, Units } from '@simhub-carplay/shared';
import type { Telemetry } from './telemetry.svelte.ts';
import type { ViewState } from './viewState.svelte.ts';
import type { Dir } from './focus.ts';

export interface UiFlags {
  /** Knob/key navigation active: show focus rings. Cleared by touch/mouse. */
  knob: boolean;
  debug: boolean;
  lastAction: string;
}

export interface AppContext {
  cfg: ClientConfig;
  telemetry: Telemetry;
  view: ViewState;
  ui: UiFlags;
  /** Display units: config.ui.units, or the game profile's when that's "auto". Reactive. */
  units: () => Units;
  /**
   * Called when focus can't move further in a direction. The active view can
   * claim it (e.g. the grid turns the page). Return true if handled.
   */
  nav: { edge: ((dir: Dir) => boolean) | null };
}

const KEY = Symbol('app');
export const setAppContext = (ctx: AppContext) => setContext(KEY, ctx);
export const useApp = () => getContext<AppContext>(KEY);
