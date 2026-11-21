<script lang="ts">
  import { Turn, type NavStep } from '@simhub-carplay/shared';
  import { useApp } from '../lib/context.ts';
  import { fmtDistance, num } from '../lib/format.ts';
  import { destinationName, isRoundabout, maneuverText } from '../lib/nav.ts';
  import TurnIcon from './TurnIcon.svelte';

  /**
   * Next turn-by-turn maneuver (truck games with a route): arrow, distance,
   * exit badge, road name, lane guidance and a "then" hint. Takes the Drive
   * card's place in the split view while navigating.
   */
  let { onclick }: { onclick?: () => void } = $props();
  const { telemetry, units } = useApp();

  const index = $derived(num(telemetry.slow['nav.stepIndex']));
  const step = $derived<NavStep | null>(index === null ? null : (telemetry.route?.steps[index] ?? null));
  const dist = $derived(fmtDistance(telemetry.slow['nav.maneuverDistM'], units()));

  const text = $derived(step ? maneuverText(step, destinationName(telemetry.slow)) : null);
</script>

<button class="card maneuver" data-nav {onclick} aria-label="Next maneuver">
  {#if step && text}
    <div class="top">
      <div class="arrow"><TurnIcon turn={step.turn} /></div>
      <div class="dist tabular">{dist}</div>
    </div>
    {#if text.exit || step.roundaboutExit}
      <div class="badges">
        {#if text.exit}<span class="exit">EXIT {text.exit}</span>{/if}
        {#if step.roundaboutExit && isRoundabout(step.turn)}<span class="pill">Exit {step.roundaboutExit}</span>{/if}
      </div>
    {/if}
    <div class="road">{text.primary}</div>
    {#if text.secondary}<div class="sub">{text.secondary}</div>{/if}

    <div class="foot">
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
</button>

<style>
  .maneuver {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.9rem 1rem 0.85rem;
    text-align: left;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0)), var(--card);
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }
  .arrow {
    width: 3.6rem;
    height: 3.6rem;
    flex-shrink: 0;
  }
  .dist {
    font-size: 2.3rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1;
  }
  .badges {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.15rem;
  }
  /* US exit tab: green with a white border. */
  .exit {
    background: #1f7a4d;
    color: #fff;
    font-weight: 800;
    font-size: 0.85rem;
    padding: 0.12rem 0.45rem;
    border-radius: 0.25rem;
    box-shadow: inset 0 0 0 0.12rem #fff;
  }
  .pill {
    background: var(--card-2);
    font-weight: 700;
    font-size: 0.85rem;
    padding: 0.12rem 0.5rem;
    border-radius: 999px;
  }
  .road {
    font-size: 1.55rem;
    font-weight: 700;
    line-height: 1.15;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .sub {
    font-size: 0.95rem;
    color: var(--text-2);
  }
  .foot {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
  }
  .lanes {
    display: flex;
    gap: 0.15rem;
    padding: 0.25rem 0.4rem;
    border-radius: 0.5rem;
    background: rgba(0, 0, 0, 0.25);
  }
  .lane {
    width: 1.6rem;
    height: 1.6rem;
  }
  .then {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-2);
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    background: var(--card-2);
  }
  .then-icon {
    width: 1.3rem;
    height: 1.3rem;
  }
</style>
