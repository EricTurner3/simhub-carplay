import polyline from '@mapbox/polyline';
import type { NavRoute } from '@simhub-carplay/shared';

export type LonLat = [number, number];

/** Each step's geometry as [lon, lat] points (upstream encodes lon/lat pairs directly). */
export function decodeRoute(route: NavRoute | null): LonLat[][] {
  return route?.steps.map((s) => polyline.decode(s.geometry) as LonLat[]) ?? [];
}

/**
 * Route still ahead: from the truck, along the rest of the step being driven
 * (the one before the next maneuver), then every later step. Empty without a route.
 */
export function remainingRoute(lines: LonLat[][], nextStep: number | null, at: LonLat): LonLat[] {
  if (!lines.length || nextStep === null) return [];
  const cur = Math.max(0, nextStep - 1);
  const line = lines[cur] ?? [];
  // Nearest vertex of the current step; the line starts at the truck from there.
  const k = Math.cos((at[1] * Math.PI) / 180);
  let best = -1;
  let bestD = Infinity;
  line.forEach(([x, y], i) => {
    const d = ((x - at[0]) * k) ** 2 + (y - at[1]) ** 2;
    if (d < bestD) (bestD = d), (best = i);
  });
  return [at, ...line.slice(best + 1), ...lines.slice(cur + 1).flat()];
}

/**
 * Follow-camera zoom (MapLibre zoom levels) for a speed: zooms out on the
 * highway. Game distances are ~1:20, hence the low zooms.
 */
export const followZoom = (kmh: number) => 12.8 - Math.min(1, Math.abs(kmh) / 100) * 1.4;
