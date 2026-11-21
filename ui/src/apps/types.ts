import type { Component } from 'svelte';
import type { Telemetry } from '../lib/telemetry.svelte.ts';

/**
 * Contract for a plug-in app. Each app lives in ui/src/apps/<id>/ and default-
 * exports one of these from index.ts. The registry discovers it automatically.
 *
 * Apps never name SimHub properties: they read channels (telemetry.slow[...],
 * telemetry.has(...)) and the game profiles in games/*.json decide where each
 * channel comes from.
 */
export interface AppModule {
  id: string;
  name: string;
  /** Icon tile gradient, top -> bottom. */
  colors: [string, string];
  /** Original line-art glyph: SVG markup inside a 24x24 viewBox, stroke only. */
  glyph: string;
  /** Position in the app grid (lower first). */
  order: number;
  /** Channels the active game must provide for this app to show up at all. */
  requires?: string[];
  /** Extra availability check, for apps that depend on more than channels. */
  available?: (t: Telemetry) => boolean;
  /** Dock shortcut priority (lower first). Omit to keep it out of the dock. */
  dock?: number;
  /** Full-screen body (the header/back button is provided by the shell). */
  screen: Component;
  /**
   * Optional widget for the split view's lower-right slot. The available card
   * with the highest priority whose `when` passes is shown.
   */
  card?: {
    component: Component;
    priority: number;
    when?: (t: Telemetry) => boolean;
  };
}
