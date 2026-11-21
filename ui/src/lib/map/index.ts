import type { MapIndex } from '@simhub-carplay/shared';
import type { Game } from './style.ts';

let index: Promise<MapIndex> | undefined;

/** Which games have generated map data (fetched once; the bridge serves /maps/index.json). */
export function mapIndex(): Promise<MapIndex> {
  index ??= fetch('/maps/index.json')
    .then((r) => (r.ok ? (r.json() as Promise<MapIndex>) : { games: [] }))
    .catch(() => ({ games: [] }));
  return index;
}

/** Map game for a profile id, if it's a truck game. */
export const scsGame = (profileId: string | undefined): Game | null =>
  profileId === 'ats' || profileId === 'ets2' ? profileId : null;

/**
 * Can this browser run the MapLibre map (WebGL 2)? `?map=2d` in the URL forces
 * the 2D canvas fallback, for testing.
 */
export const hasWebGL2: boolean = (() => {
  if (new URLSearchParams(location.search).get('map') === '2d') return false;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
})();
