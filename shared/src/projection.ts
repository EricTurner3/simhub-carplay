/**
 * SCS game coordinates (metres; x east, z south) -> WGS84 lon/lat, matching the
 * projection truckermudgeon/maps uses to generate the map tiles
 * (vendor/maps/packages/libs/map/projections.ts). Spherical Lambert conformal
 * conic, inlined so the UI doesn't need proj4.
 */

export type ScsMap = 'usa' | 'europe';

const R = 6_370_997;
const lengthOfDegree = (R * Math.PI) / 180;
const rad = Math.PI / 180;

interface Lcc {
  n: number;
  rf: number; // R * F
  rho0: number;
  lon0: number;
  factor: [number, number];
}

function lcc(lat1: number, lat2: number, lat0: number, lon0: number, factor: [number, number]): Lcc {
  const [p1, p2, p0] = [lat1 * rad, lat2 * rad, lat0 * rad];
  const t = (p: number) => Math.tan(Math.PI / 4 + p / 2);
  const n = Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(t(p2) / t(p1));
  const rf = (R * Math.cos(p1) * Math.pow(t(p1), n)) / n;
  return { n, rf, rho0: rf / Math.pow(t(p0), n), lon0: lon0 * rad, factor };
}

// from def/climate.sii (mapFactor is [y, x])
const ATS = lcc(33, 45, 39, -96, [-0.00017706234, 0.000176689948]);
const ETS2 = lcc(37, 65, 50, 15, [-0.000171570875, 0.0001729241463]);
const ETS2_OFFSET = [16660, 4150];

function inverse(p: Lcc, x: number, y: number): [number, number] {
  const dy = p.rho0 - y;
  const rho = Math.sign(p.n) * Math.hypot(x, dy);
  const theta = Math.atan2(Math.sign(p.n) * x, Math.sign(p.n) * dy);
  const lat = 2 * Math.atan(Math.pow(p.rf / rho, 1 / p.n)) - Math.PI / 2;
  return [(p.lon0 + theta / p.n) / rad, lat / rad];
}

/** Game world position (truck X, Z) to [lon, lat]. */
export function gameToLonLat(map: ScsMap, x: number, z: number): [number, number] {
  if (map === 'usa') {
    return inverse(ATS, x * ATS.factor[1] * lengthOfDegree, z * ATS.factor[0] * lengthOfDegree);
  }
  const sx = Math.floor(x / 4000);
  const sy = Math.floor(z / 4000);
  x -= ETS2_OFFSET[0];
  z -= ETS2_OFFSET[1];
  // UK content is authored at a larger scale; same sector test as upstream.
  if (sx <= -8 && sy <= -2 && !(sx === -8 && sy === -2) && sy >= -14) {
    x = (x - 31100 / 2) * 0.75;
    z = (z - 5500 / 2) * 0.75;
  }
  return inverse(ETS2, x * ETS2.factor[1] * lengthOfDegree, z * ETS2.factor[0] * lengthOfDegree);
}

/**
 * SCS heading (0..1, counter-clockwise from north) to a compass bearing in
 * degrees (clockwise from north), as MapLibre expects.
 */
export function headingToBearing(heading: number): number {
  return (((-heading * 360) % 360) + 360) % 360;
}
