<script lang="ts" module>
  // Zoom stays where you left it between visits.
  let savedOffset = 0;
</script>

<script lang="ts">
  import { useApp } from '../../lib/context.ts';
  import { fmtDistance } from '../../lib/format.ts';
  import { hasWebGL2 } from '../../lib/map/index.ts';
  import type { Game } from '../../lib/map/style.ts';
  import { eta as etaOf } from '../../lib/nav.ts';
  import WorldMap from '../../components/WorldMap.svelte';
  import FallbackMap from '../../components/FallbackMap.svelte';
  import NavBanner from '../../components/NavBanner.svelte';
  import SpeedLimitSign from '../../components/SpeedLimitSign.svelte';

  /** Full-screen truck map (Map app, ATS/ETS2): map edge to edge with floating overlays. */
  let { game }: { game: Game } = $props();
  const { telemetry, units } = useApp();

  const MIN_OFFSET = -4;
  const MAX_OFFSET = 2;
  let zoomOffset = $state(savedOffset);
  function zoom(by: number) {
    zoomOffset = savedOffset = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, zoomOffset + by));
  }

  const eta = $derived(etaOf(telemetry.slow));
  // "255 mi" -> value + unit, to stack like the time.
  const left = $derived.by(() => {
    const [value, unit = ''] = fmtDistance(telemetry.slow['nav.distanceM'], units()).split(' ');
    return { value, unit };
  });
</script>

<div class="full">
  {#if hasWebGL2}<WorldMap {game} {zoomOffset} />{:else}<FallbackMap {game} {zoomOffset} />{/if}

  <div class="banner"><NavBanner /></div>
  <div class="sign"><SpeedLimitSign size={1.35} /></div>

  <div class="zoom">
    <button data-nav data-nav-default onclick={() => zoom(0.5)} disabled={zoomOffset >= MAX_OFFSET} aria-label="Zoom in">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
    </button>
    <button data-nav onclick={() => zoom(-0.5)} disabled={zoomOffset <= MIN_OFFSET} aria-label="Zoom out">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
    </button>
  </div>

  {#if eta}
    <div class="eta tabular">
      {#if eta.arrival}<div><b>{eta.arrival}</b><span>arrival</span></div>{/if}
      <div class="time"><b>{eta.left.value}</b><span>{eta.left.unit}</span></div>
      <div><b>{left.value}</b><span>{left.unit}</span></div>
    </div>
  {/if}
</div>

<style>
  .full {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    background: #1e1f22;
  }
  .banner {
    position: absolute;
    top: 0.8rem;
    left: 0.8rem;
    max-width: 48%;
  }
  .sign {
    position: absolute;
    top: 0.8rem;
    right: 0.8rem;
  }
  .zoom {
    position: absolute;
    right: 0.8rem;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    border-radius: 0.9rem;
    overflow: hidden;
    background: rgba(36, 37, 41, 0.92);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
  .zoom button {
    width: 3.2rem;
    height: 3.2rem;
    display: grid;
    place-items: center;
    color: var(--text);
  }
  .zoom button + button {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  .zoom button:disabled {
    color: var(--text-3);
  }
  .zoom svg {
    width: 1.5rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .eta {
    position: absolute;
    left: 0.8rem;
    bottom: 0.8rem;
    display: flex;
    gap: 1.6rem;
    padding: 0.6rem 1.2rem;
    border-radius: 0.8rem;
    background: rgba(36, 37, 41, 0.94);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
  .eta div {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.15;
  }
  .eta b {
    font-size: 1.35rem;
    font-weight: 700;
  }
  .eta span {
    font-size: 0.85rem;
    color: var(--text-2);
  }
  .eta .time b,
  .eta .time span {
    color: var(--green);
  }
</style>
