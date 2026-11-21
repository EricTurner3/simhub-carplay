import type { Telemetry } from '../lib/telemetry.svelte.ts';
import type { AppModule } from './types.ts';

export type { AppModule } from './types.ts';

// Every ui/src/apps/<id>/index.ts is an app. Add a folder, get an app.
const modules = import.meta.glob<{ default: AppModule }>('./*/index.ts', { eager: true });

export const APPS: AppModule[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.order - b.order);

/** The split view isn't an app, but it has a tile in the grid and dock. */
export const DASHBOARD = {
  id: 'dashboard',
  name: 'Dashboard',
  colors: ['#3a8dff', '#1650c8'] as [string, string],
  glyph: '<rect x="3" y="4" width="10" height="16" rx="2"/><rect x="15" y="4" width="6" height="7" rx="1.5"/><rect x="15" y="13" width="6" height="7" rx="1.5"/>',
};

export const appById = (id: string) => APPS.find((a) => a.id === id);

/** Does the active game provide everything this app needs? Reactive via t.has(). */
export function isAvailable(app: AppModule, t: Telemetry): boolean {
  return (app.requires ?? []).every((ch) => t.has(ch));
}

export function availableApps(t: Telemetry): AppModule[] {
  return APPS.filter((a) => isAvailable(a, t));
}

/** Up to `max` dock shortcuts for the current game. */
export function dockApps(t: Telemetry, max = 3): AppModule[] {
  return availableApps(t)
    .filter((a) => a.dock !== undefined)
    .sort((a, b) => a.dock! - b.dock!)
    .slice(0, max);
}

/** App whose card fills the split view's lower-right slot. */
export function activeCardApp(t: Telemetry): AppModule | undefined {
  return availableApps(t)
    .filter((a) => a.card && (a.card.when?.(t) ?? true))
    .sort((a, b) => b.card!.priority - a.card!.priority)[0];
}
