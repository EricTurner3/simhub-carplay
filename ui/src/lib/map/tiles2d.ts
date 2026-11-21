import { PMTiles } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { AREA, ROAD, type Game } from './style.ts';

/**
 * Game map tiles for the 2D canvas fallback (FallbackMap): reads the same
 * PMTiles as the MapLibre map and turns each vector tile into a few Path2Ds,
 * once, in tile units (0..extent). Only map areas and roads; no labels or icons.
 */

export interface Tile2D {
  extent: number;
  /** Filled in order (by zIndex). */
  areas: { color: string; path: Path2D }[];
  /** roadType -> all its lines, stroked as one path. */
  roads: Map<string, Path2D>;
}

/** Road draw order (bottom to top), with widths relative to the style's road width. */
export const ROAD_ORDER: [type: string, factor: number][] = [
  ['no_vehicles', 0.6],
  ['local', 0.85],
  ['unknown', 0.85],
  ['divided', 1],
  ['freeway', 1],
];
export { ROAD };

const MAX_TILES = 48;

export class TileCache {
  private pm: PMTiles;
  private tiles = new Map<string, Tile2D | null>(); // null: loading or empty
  private pending = new Set<string>();

  constructor(
    base: string,
    private game: Game,
    private onLoad: () => void,
  ) {
    this.pm = new PMTiles(`${base}/${game}.pmtiles`);
  }

  /** The tile if decoded; otherwise starts loading it and returns null. */
  get(z: number, x: number, y: number): Tile2D | null {
    const key = `${z}/${x}/${y}`;
    const t = this.tiles.get(key);
    if (t !== undefined) {
      // Refresh LRU position.
      this.tiles.delete(key);
      this.tiles.set(key, t);
      return t;
    }
    if (!this.pending.has(key)) {
      this.pending.add(key);
      void this.load(z, x, y, key);
    }
    return null;
  }

  private async load(z: number, x: number, y: number, key: string) {
    let tile: Tile2D | null = null;
    try {
      const res = await this.pm.getZxy(z, x, y);
      if (res) tile = decode(new VectorTile(new PbfReader(new Uint8Array(res.data))), this.game);
    } catch (err) {
      console.warn('[map2d] tile', key, err);
    }
    this.pending.delete(key);
    this.tiles.set(key, tile);
    while (this.tiles.size > MAX_TILES) this.tiles.delete(this.tiles.keys().next().value!);
    this.onLoad();
  }
}

function decode(vt: VectorTile, game: Game): Tile2D | null {
  const layer = vt.layers[game];
  if (!layer) return null;
  const polys: { z: number; color: string; rings: { x: number; y: number }[][] }[] = [];
  const roads = new Map<string, Path2D>();

  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    const p = f.properties;
    if (f.type === 3 && (p.type === 'mapArea' || p.type === 'prefab')) {
      polys.push({ z: Number(p.zIndex ?? 0), color: AREA[Number(p.color)] ?? AREA[0], rings: f.loadGeometry() });
    } else if (f.type === 2 && p.type === 'road' && p.hidden !== true && p.roadType !== 'train' && p.roadType !== 'tram') {
      const type = ROAD[String(p.roadType)] ? String(p.roadType) : 'unknown';
      let path = roads.get(type);
      if (!path) roads.set(type, (path = new Path2D()));
      for (const line of f.loadGeometry()) {
        line.forEach((pt, j) => (j ? path!.lineTo(pt.x, pt.y) : path!.moveTo(pt.x, pt.y)));
      }
    }
  }

  // Map areas first, then prefabs on top, each by zIndex; batch runs of one colour.
  polys.sort((a, b) => a.z - b.z);
  const areas: Tile2D['areas'] = [];
  for (const poly of polys) {
    let last = areas[areas.length - 1];
    if (!last || last.color !== poly.color) areas.push((last = { color: poly.color, path: new Path2D() }));
    for (const ring of poly.rings) {
      ring.forEach((pt, j) => (j ? last.path.lineTo(pt.x, pt.y) : last.path.moveTo(pt.x, pt.y)));
      last.path.closePath();
    }
  }
  return { extent: layer.extent, areas, roads };
}

/** [lon, lat] -> Web Mercator world pixels at zoom z (256 px tiles). */
export function toWorldPx(lon: number, lat: number, z: number): [number, number] {
  const size = 256 * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * size, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size];
}
