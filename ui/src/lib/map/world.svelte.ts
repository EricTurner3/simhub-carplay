import type { Telemetry } from '../telemetry.svelte.ts';
import { mapIndex, scsGame } from './index.ts';
import type { Game } from './style.ts';

/**
 * Whether to show the truck world map, reactively: a truck game with world
 * position whose map data has been built. Call during component init.
 */
export function worldMap(telemetry: Telemetry) {
  let built = $state<string[] | null>(null);
  void mapIndex().then((i) => (built = i.games));
  const game = $derived<Game | null>(telemetry.has('pos.x') ? scsGame(telemetry.profile?.id) : null);
  return {
    /** The truck game, whether or not its data is built. */
    get game() {
      return game;
    },
    /** null until the map index has loaded. */
    get built() {
      return built;
    },
    get ready() {
      return game !== null && built?.includes(game) === true;
    },
  };
}
