<script lang="ts">
  import { Turn, type NavStep } from '@simhub-carplay/shared';
  import { useApp } from '../lib/context.ts';
  import { fmtDistance, num } from '../lib/format.ts';
  import { destinationName, maneuverText } from '../lib/nav.ts';
  import TurnIcon from './TurnIcon.svelte';

  /** Floating turn-by-turn banner for the full-screen map: arrow, distance, road, lanes, "then". */
  const { telemetry, units } = useApp();

  const index = $derived(num(telemetry.slow['nav.stepIndex']));
  const step = $derived<NavStep | null>(index === null ? null : (telemetry.route?.steps[index] ?? null));
  const text = $derived(step ? maneuverText(step, destinationName(telemetry.slow)) : null);
  const dist = $derived(fmtDistance(telemetry.slow['nav.maneuverDistM'], units()));
</script>

{#if step && text}
  <div class="banner">
    <div class="main">
      <div class="top">
        <span class="arrow"><TurnIcon turn={step.turn} /></span>
        <span class="dist tabular">{dist}</span>
      </div>
      <div class="primary">
        {#if text.exit}<span class="exit">EXIT {text.exit}</span>{/if}
        {text.primary}
      </div>
      {#if text.secondary}<div class="secondary">{text.secondary}</div>{/if}
    </div>
    {#if step.lanes && step.lanes.length > 1}
      <div class="lanes" aria-label="Lanes">
        {#each step.lanes as lane, i (i)}
          <span class="lane"><TurnIcon turn={lane.active ?? lane.turns[0] ?? Turn.Through} dim={lane.active === undefined} /></span>
        {/each}
      </div>
    {/if}
    {#if step.then !== undefined}
      <div class="then">Then <span class="then-icon"><TurnIcon turn={step.then} /></span></div>
    {/if}
  </div>
{/if}

<style>
  .banner {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: 100%;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.45));
  }
  .main {
    background: #1d6b3f;
    border-radius: 0.8rem;
    padding: 0.7rem 1rem 0.8rem;
    min-width: 15rem;
    max-width: 100%;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }
  .arrow {
    width: 2.6rem;
    height: 2.6rem;
    flex-shrink: 0;
  }
  .dist {
    font-size: 1.9rem;
    font-weight: 700;
    line-height: 1;
  }
  .primary {
    margin-top: 0.45rem;
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .exit {
    display: inline-block;
    margin-right: 0.35rem;
    background: #fff;
    color: #1d6b3f;
    font-weight: 800;
    font-size: 0.8rem;
    padding: 0.05rem 0.4rem;
    border-radius: 0.25rem;
    vertical-align: 0.1rem;
  }
  .secondary {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
  }
  .lanes {
    display: flex;
    gap: 0.1rem;
    margin-top: 0.3rem;
    padding: 0.3rem 0.5rem;
    border-radius: 0.6rem;
    background: rgba(18, 52, 32, 0.95);
  }
  .lane {
    width: 1.7rem;
    height: 1.7rem;
  }
  .then {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.3rem;
    padding: 0.3rem 0.7rem;
    border-radius: 0.6rem;
    background: rgba(18, 52, 32, 0.95);
    font-size: 0.9rem;
    font-weight: 600;
  }
  .then-icon {
    width: 1.3rem;
    height: 1.3rem;
  }
</style>
