<script lang="ts">
  import { onMount } from 'svelte';
  import { gameToLonLat, headingToBearing } from '@simhub-carplay/shared';
  import { useApp } from '../lib/context.ts';
  import { onFrame } from '../lib/frameloop.ts';
  import { canvasDpr } from '../lib/perf.svelte.ts';
  import { num } from '../lib/format.ts';
  import { decodeRoute, followZoom, remainingRoute, type LonLat } from '../lib/map/route.ts';
  import { C, roadWidthPx, type Game } from '../lib/map/style.ts';
  import { ROAD, ROAD_ORDER, TileCache, toWorldPx, type Tile2D } from '../lib/map/tiles2d.ts';

  /**
   * World map for browsers without WebGL 2 (e.g. a Raspberry Pi 3): the same
   * tiles drawn on a 2D canvas. Map areas, roads, route and truck only, redrawn
   * at most ~20 times a second, so it stays light on slow devices.
   */
  /** zoomOffset: added to the speed-based follow zoom (zoom buttons). */
  let { game, zoomOffset = 0 }: { game: Game; zoomOffset?: number } = $props();
  const { telemetry } = useApp();

  /** World pixel coordinates (truck, route) are at this zoom; tiles of any zoom up to it fit in. */
  const REF = 13;
  /** Tile zoom to read for a display zoom: a ~1000-2000 px tile on screen, within what was generated. */
  const tileZoom = (zoom: number) => Math.max(5, Math.min(13, Math.floor(zoom) - 1));
  const FRAME_MS = 50;

  let wrap: HTMLElement;
  let canvas: HTMLCanvasElement;

  let lines: LonLat[][] = [];
  $effect(() => {
    lines = decodeRoute(telemetry.route);
    routeAt = 0;
  });
  let routeAt = 0;
  let routePx: [number, number][] = [];

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    let dirty = true;
    const tiles = new TileCache(`${location.origin}/maps`, game, () => (dirty = true));

    let w = 0;
    let h = 0;
    // Full device resolution costs a lot on a Pi; 1.5x is plenty for lines.
    const dpr = canvasDpr(1.5);
    const ro = new ResizeObserver(() => {
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      dirty = true;
    });
    ro.observe(wrap);

    let zoom = 12;
    let last = 0;
    let drawnAt = 0;
    let prev = '';
    const off = onFrame((now) => {
      if (now - drawnAt < FRAME_MS) return;
      const x = telemetry.sample('pos.x', now);
      const z = telemetry.sample('pos.z', now);
      if (x === null || z === null || !w) return;
      const heading = telemetry.sample('pos.heading', now) ?? 0;
      const dt = last ? Math.min(0.2, (now - last) / 1000) : 0;
      last = now;
      zoom += (followZoom(telemetry.sample('speedKmh', now) ?? 0) + zoomOffset - zoom) * Math.min(1, dt * 2);

      const key = `${x.toFixed(1)},${z.toFixed(1)},${heading.toFixed(4)},${zoom.toFixed(3)}`;
      if (key === prev && !dirty) return;
      prev = key;
      dirty = false;
      drawnAt = now;

      const scsMap = game === 'ats' ? 'usa' : 'europe';
      const lonLat = gameToLonLat(scsMap, x, z);
      if (now - routeAt > 250) {
        routeAt = now;
        routePx = remainingRoute(lines, num(telemetry.get('nav.stepIndex')), lonLat).map(([lon, lat]) => toWorldPx(lon, lat, REF));
      }
      draw(ctx, tiles, w, h, dpr, toWorldPx(lonLat[0], lonLat[1], REF), headingToBearing(scsMap, x, z, heading), zoom);
    });

    return () => {
      off();
      ro.disconnect();
    };
  });

  function draw(
    ctx: CanvasRenderingContext2D,
    tiles: TileCache,
    w: number,
    h: number,
    dpr: number,
    [tx, ty]: [number, number],
    bearing: number,
    zoom: number,
  ) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.land;
    ctx.fillRect(0, 0, w, h);

    // MapLibre zoom uses 512 px tiles; world px here are 256 px tiles at REF.
    const s = 2 ** (zoom + 1 - REF);
    // Puck in the lower part of the view, like the MapLibre map.
    const ax = w / 2;
    const ay = h * 0.7;
    ctx.translate(ax, ay);
    ctx.rotate((-bearing * Math.PI) / 180);
    ctx.scale(s, s);
    ctx.translate(-tx, -ty);

    const r = Math.hypot(w / 2, h * 0.7) / s;
    const dz = tileZoom(zoom);
    const n = 2 ** dz;
    const ts = 256 * 2 ** (REF - dz); // tile size in world px
    const visible: { tile: Tile2D; i: number; j: number }[] = [];
    for (let i = Math.max(0, Math.floor((tx - r) / ts)); i <= Math.min(n - 1, Math.floor((tx + r) / ts)); i++) {
      for (let j = Math.max(0, Math.floor((ty - r) / ts)); j <= Math.min(n - 1, Math.floor((ty + r) / ts)); j++) {
        const tile = tiles.get(dz, i, j);
        if (tile) visible.push({ tile, i, j });
      }
    }

    const inTile = (t: { tile: Tile2D; i: number; j: number }, fn: (k: number) => void) => {
      const k = ts / t.tile.extent;
      ctx.save();
      ctx.translate(t.i * ts, t.j * ts);
      ctx.scale(k, k);
      fn(s * k); // screen px per tile unit
      ctx.restore();
    };

    for (const t of visible) {
      inTile(t, () => {
        for (const a of t.tile.areas) {
          ctx.fillStyle = a.color;
          ctx.fill(a.path);
        }
      });
    }

    // Roads: all casings, then all fills, so tile edges and crossings join cleanly.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Same widths as the MapLibre style; casing as in its roads-case layer.
    const width = roadWidthPx(zoom);
    const casing = Math.max(1, Math.min(3, zoom - 10));
    for (const pass of [1, 0] as const) {
      for (const [type, base] of ROAD_ORDER) {
        const px = Math.max(1, base * width) + (pass ? casing * 2 : 0);
        ctx.strokeStyle = ROAD[type][pass];
        for (const t of visible) {
          const path = t.tile.roads.get(type);
          if (!path) continue;
          inTile(t, (unit) => {
            ctx.lineWidth = px / unit;
            ctx.stroke(path);
          });
        }
      }
    }

    if (routePx.length > 1) {
      ctx.beginPath();
      routePx.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = C.routeCase;
      ctx.lineWidth = 9 / s;
      ctx.stroke();
      ctx.strokeStyle = C.route;
      ctx.lineWidth = 6 / s;
      ctx.stroke();
    }

    // Truck puck, pointing up (heading-up map).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pr = 17;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(ax, ay + 1.5, pr + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ax, ay, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a84ff';
    ctx.beginPath();
    ctx.arc(ax, ay, pr - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(ax, ay - 10);
    ctx.lineTo(ax + 7.5, ay + 9);
    ctx.lineTo(ax, ay + 5);
    ctx.lineTo(ax - 7.5, ay + 9);
    ctx.closePath();
    ctx.fill();
  }
</script>

<div class="world" bind:this={wrap}><canvas bind:this={canvas}></canvas></div>

<style>
  .world {
    position: absolute;
    inset: 0;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
