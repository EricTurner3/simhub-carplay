<script lang="ts">
  import { onMount } from 'svelte';
  import { useApp } from '../lib/context.ts';
  import { onFrame } from '../lib/frameloop.ts';
  import { hasWebGL2 } from '../lib/map/index.ts';
  import { worldMap } from '../lib/map/world.svelte.ts';
  import { eta as etaOf } from '../lib/nav.ts';
  import WorldMap from './WorldMap.svelte';
  import FallbackMap from './FallbackMap.svelte';
  import SpeedLimitSign from './SpeedLimitSign.svelte';

  /**
   * Racing: placeholder track map, a fictional circuit drawn on canvas with the
   * player puck placed by `trackPct` (0..1 around the lap).
   * Truck games (ATS/ETS2): the world map (WorldMap) with speed limit and ETA.
   */
  let { onclick, label = true }: { onclick?: () => void; label?: boolean } = $props();
  const { telemetry } = useApp();

  // Control points of a fictional circuit in unit space (closed loop).
  const CONTROL: [number, number][] = [
    [0.18, 0.78], [0.5, 0.82], [0.78, 0.8], [0.9, 0.66], [0.82, 0.5], [0.66, 0.46],
    [0.62, 0.3], [0.78, 0.2], [0.68, 0.1], [0.42, 0.14], [0.3, 0.3], [0.14, 0.36], [0.08, 0.58],
  ];
  const path = buildPath(CONTROL, 24);

  let canvas: HTMLCanvasElement;
  let wrap: HTMLElement;

  function buildPath(pts: [number, number][], steps: number) {
    // Closed Catmull-Rom spline -> polyline with cumulative arc length.
    const out: { x: number; y: number; s: number }[] = [];
    const n = pts.length;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number) =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        const x = f(p0[0], p1[0], p2[0], p3[0]);
        const y = f(p0[1], p1[1], p2[1], p3[1]);
        const prev = out[out.length - 1];
        if (prev) s += Math.hypot(x - prev.x, y - prev.y);
        out.push({ x, y, s });
      }
    }
    const first = out[0];
    const last = out[out.length - 1];
    const total = s + Math.hypot(first.x - last.x, first.y - last.y);
    return { pts: out, total };
  }

  function pointAt(pct: number) {
    const target = (((pct % 1) + 1) % 1) * path.total;
    const pts = path.pts;
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (pts[mid].s <= target) lo = mid;
      else hi = mid - 1;
    }
    const a = pts[lo];
    const b = pts[(lo + 1) % pts.length];
    const segEnd = lo + 1 < pts.length ? b.s : path.total;
    const k = segEnd > a.s ? (target - a.s) / (segEnd - a.s) : 0;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let lastPct: number | null | undefined;
    let dirty = true;

    const ro = new ResizeObserver(() => {
      dpr = window.devicePixelRatio || 1;
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      dirty = true;
    });
    ro.observe(wrap);

    const off = onFrame((now) => {
      const pct = telemetry.sample('trackPct', now);
      if (!dirty && (pct === lastPct || (pct !== null && lastPct != null && Math.abs(pct - lastPct) < 1e-5))) return;
      lastPct = pct;
      dirty = false;
      draw(ctx, w, h, dpr, pct);
    });

    return () => {
      off();
      ro.disconnect();
    };
  });

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, pct: number | null) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (w === 0 || h === 0) return;

    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const pad = rem * 2.2;
    const size = Math.min(w - pad * 2, h - pad * 2);
    const ox = (w - size) / 2;
    const oy = (h - size) / 2;
    const X = (x: number) => ox + x * size;
    const Y = (y: number) => oy + y * size;

    // Faint grid for a "map" feel.
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    const step = rem * 2.5;
    ctx.beginPath();
    for (let x = (w % step) / 2; x < w; x += step) ctx.moveTo(x, 0), ctx.lineTo(x, h);
    for (let y = (h % step) / 2; y < h; y += step) ctx.moveTo(0, y), ctx.lineTo(w, y);
    ctx.stroke();

    const trace = () => {
      ctx.beginPath();
      path.pts.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    trace();
    ctx.strokeStyle = '#2a2b31';
    ctx.lineWidth = rem * 1.15;
    ctx.stroke();
    ctx.strokeStyle = '#4a4c55';
    ctx.lineWidth = rem * 0.75;
    ctx.stroke();

    // Start/finish line.
    const s0 = pointAt(0);
    const s1 = pointAt(0.004);
    const ang = Math.atan2(Y(s1.y) - Y(s0.y), X(s1.x) - X(s0.x)) + Math.PI / 2;
    const half = rem * 0.6;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = rem * 0.18;
    ctx.beginPath();
    ctx.moveTo(X(s0.x) - Math.cos(ang) * half, Y(s0.y) - Math.sin(ang) * half);
    ctx.lineTo(X(s0.x) + Math.cos(ang) * half, Y(s0.y) + Math.sin(ang) * half);
    ctx.stroke();

    const known = pct !== null;
    const p = known ? pct : 0;

    // Short trail behind the car.
    if (known) {
      const grad = 24;
      for (let i = 0; i < grad; i++) {
        const a = pointAt(p - 0.05 * (1 - i / grad));
        const b = pointAt(p - 0.05 * (1 - (i + 1) / grad));
        ctx.strokeStyle = `rgba(10,132,255,${(i / grad) * 0.85})`;
        ctx.lineWidth = rem * 0.45;
        ctx.beginPath();
        ctx.moveTo(X(a.x), Y(a.y));
        ctx.lineTo(X(b.x), Y(b.y));
        ctx.stroke();
      }
    }

    // Player puck.
    const c = pointAt(p);
    const r = rem * 0.62;
    ctx.globalAlpha = known ? 1 : 0.35;
    ctx.fillStyle = 'rgba(10,132,255,0.28)';
    ctx.beginPath();
    ctx.arc(X(c.x), Y(c.y), r * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(X(c.x), Y(c.y), r * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a84ff';
    ctx.beginPath();
    ctx.arc(X(c.x), Y(c.y), r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const lap = $derived(telemetry.slow.lap);
  const circuit = $derived(!telemetry.profile || telemetry.has('trackPct'));

  const wm = worldMap(telemetry);
  const game = $derived(wm.game);
  const built = $derived(wm.built);
  const world = $derived(wm.ready);
  // In-game GPS: arrival on the game clock, time left.
  const eta = $derived(world ? etaOf(telemetry.slow) : null);
</script>

<button class="card map" data-nav data-nav-default {onclick} aria-label="Map" bind:this={wrap}>
  <canvas bind:this={canvas} class:hidden={!circuit}></canvas>
  {#if world && game}
    {#if hasWebGL2}<WorldMap {game} />{:else}<FallbackMap {game} />{/if}
    <div class="sign"><SpeedLimitSign size={1.35} /></div>
    {#if eta}
      <div class="eta tabular">
        {#if eta.arrival}<span><b>{eta.arrival}</b> ETA</span>{/if}
        <span class="left">{eta.left.value} {eta.left.unit === 'hr' ? 'hrs' : 'min'}</span>
      </div>
    {/if}
  {:else if !circuit && (game === null || built !== null)}
    <div class="placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" /><path d="M9 4v13.5M15 6.5V20" />
      </svg>
      <span>{game ? 'Map data not built yet: run npm run maps:build' : 'No map for this game yet'}</span>
    </div>
  {/if}
  {#if label && !world}
    <div class="label">
      <span class="title">{circuit ? 'Track Map' : 'Map'}</span>
      {#if circuit && typeof lap === 'number'}<span class="lap tabular">Lap {lap}</span>{/if}
    </div>
  {/if}
</button>

<style>
  .map {
    display: block;
    width: 100%;
    height: 100%;
    /* The map stays solid: it's a picture of its own, not a glass panel. */
    background: radial-gradient(120% 90% at 50% 40%, #17181c, #0e0f12);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    text-align: left;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  canvas.hidden {
    visibility: hidden;
  }
  .placeholder {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.6rem;
    color: var(--text-3);
    font-size: 0.9rem;
  }
  .placeholder svg {
    width: 3.5rem;
  }
  .sign {
    position: absolute;
    top: 0.7rem;
    right: 0.7rem;
  }
  .eta {
    position: absolute;
    left: 0.6rem;
    right: 0.6rem;
    bottom: 0.6rem;
    display: flex;
    justify-content: space-around;
    align-items: baseline;
    gap: 1rem;
    padding: 0.55rem 0.9rem;
    border-radius: 0.7rem;
    background: rgba(40, 40, 44, 0.92);
    font-size: 1.1rem;
    font-weight: 600;
  }
  .eta b {
    font-weight: 700;
  }
  .eta .left {
    color: var(--green);
    font-weight: 700;
  }
  .label {
    position: absolute;
    left: 0.9rem;
    top: 0.75rem;
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
  }
  .title {
    font-size: 0.95rem;
    font-weight: 700;
  }
  .lap {
    font-size: 0.8rem;
    color: var(--text-2);
  }
</style>
