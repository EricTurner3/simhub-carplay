<script lang="ts">
  import { Turn, type TurnKind } from '@simhub-carplay/shared';

  /** Maneuver arrow (CarPlay style): white stroked path with an arrowhead, 48×48 viewBox. */
  let { turn, dim = false }: { turn: TurnKind; dim?: boolean } = $props();

  type Pt = [number, number];

  // Roundabout exits, as compass angles (clockwise from straight ahead).
  const ROUND_ANGLE: Partial<Record<TurnKind, number>> = {
    [Turn.RoundBR]: 135,
    [Turn.RoundR]: 90,
    [Turn.RoundTR]: 45,
    [Turn.RoundT]: 0,
    [Turn.RoundTL]: -45,
    [Turn.RoundL]: -90,
    [Turn.RoundBL]: -135,
    [Turn.RoundB]: -180,
  };

  const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [48 - x, y]);
  const RIGHT: Partial<Record<TurnKind, Pt[]>> = {
    [Turn.SlightRight]: [[20, 44], [20, 27], [34, 12]],
    [Turn.Right]: [[16, 44], [16, 24], [18, 20], [22, 18], [40, 18]],
    [Turn.SharpRight]: [[16, 44], [16, 14], [36, 34]],
    [Turn.UTurnRight]: [[14, 44], [14, 18], [16, 11], [23, 8], [30, 11], [32, 18], [32, 32]],
  };
  const LEFT_OF: Partial<Record<TurnKind, TurnKind>> = {
    [Turn.SlightLeft]: Turn.SlightRight,
    [Turn.Left]: Turn.Right,
    [Turn.SharpLeft]: Turn.SharpRight,
    [Turn.UTurnLeft]: Turn.UTurnRight,
  };

  const polar = (deg: number, r: number): Pt => [24 + r * Math.sin((deg * Math.PI) / 180), 26 - r * Math.cos((deg * Math.PI) / 180)];

  const shape = $derived.by((): { main: Pt[]; ghost?: string; ring?: boolean } => {
    const round = ROUND_ANGLE[turn];
    if (round !== undefined) {
      // Enter at the bottom, go round counter-clockwise (right-hand traffic) to the exit.
      const arc: Pt[] = [[24, 44], polar(180, 8)];
      for (let a = 165; a > round; a -= 15) arc.push(polar(a, 8));
      arc.push(polar(round, 8), polar(round, 19));
      return { main: arc, ring: true };
    }
    if (turn in RIGHT) return { main: RIGHT[turn]! };
    const left = LEFT_OF[turn];
    if (left !== undefined) return { main: mirror(RIGHT[left]!) };
    if (turn === Turn.Merge) return { main: [[30, 44], [30, 30], [24, 20], [24, 6]], ghost: 'M17 44V30l7-10' };
    return { main: [[24, 44], [24, 7]] };
  });

  const d = $derived(shape.main.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(''));
  // Arrowhead along the last segment.
  const head = $derived.by(() => {
    const pts = shape.main;
    const [x1, y1] = pts[pts.length - 2];
    const [x2, y2] = pts[pts.length - 1];
    const a = Math.atan2(y2 - y1, x2 - x1);
    const s = 7.5;
    const tip: Pt = [x2 + Math.cos(a) * 3, y2 + Math.sin(a) * 3];
    const l: Pt = [tip[0] - Math.cos(a - 0.62) * s * 1.4, tip[1] - Math.sin(a - 0.62) * s * 1.4];
    const r: Pt = [tip[0] - Math.cos(a + 0.62) * s * 1.4, tip[1] - Math.sin(a + 0.62) * s * 1.4];
    return `M${tip.join(' ')}L${l.join(' ')}L${r.join(' ')}Z`;
  });
</script>

<svg viewBox="0 0 48 48" class:dim aria-hidden="true">
  {#if turn === Turn.Arrive}
    <path d="M24 44s-12-13.5-12-22a12 12 0 0 1 24 0c0 8.5-12 22-12 22z" fill="currentColor" />
    <circle cx="24" cy="22" r="4.5" fill="var(--card, #222)" />
  {:else}
    {#if shape.ring}<circle cx="24" cy="26" r="8" class="ghost" />{/if}
    {#if shape.ghost}<path d={shape.ghost} class="ghost" />{/if}
    <path {d} class="main" />
    <path d={head} fill="currentColor" />
  {/if}
</svg>

<style>
  svg {
    width: 100%;
    height: 100%;
    color: #fff;
    overflow: visible;
  }
  svg.dim {
    color: rgba(255, 255, 255, 0.35);
  }
  .main,
  .ghost {
    fill: none;
    stroke: currentColor;
    stroke-width: 4.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ghost {
    opacity: 0.35;
  }
</style>
