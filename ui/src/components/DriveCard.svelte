<script lang="ts">
  import { onMount } from 'svelte';
  import { useApp } from '../lib/context.ts';
  import { onFrame } from '../lib/frameloop.ts';
  import SpeedLimitSign from './SpeedLimitSign.svelte';

  /**
   * Live speed / gear / RPM. Speed and RPM are interpolated and written straight
   * to the DOM each frame; gear, lap and delta are ordinary reactive values.
   * Later this becomes the "next corner / delta / callout" card.
   */
  let { onclick }: { onclick?: () => void } = $props();
  const { telemetry, units } = useApp();

  const mph = $derived(units() === 'mph');
  let speedEl: HTMLElement;
  let rpmFill: HTMLElement;
  let rpmText: HTMLElement;

  const gear = $derived(telemetry.slow.gear ?? '–');
  const delta = $derived(telemetry.slow.deltaSec);
  const maxRpm = $derived(typeof telemetry.slow.maxRpm === 'number' && telemetry.slow.maxRpm > 0 ? telemetry.slow.maxRpm : 8000);

  onMount(() => {
    let lastSpeed = '';
    let lastRpm = '';
    let lastFrac = -1;
    return onFrame((now) => {
      const kmh = telemetry.sample('speedKmh', now);
      const s = kmh === null ? '–' : String(Math.round(mph ? kmh * 0.621371 : kmh));
      if (s !== lastSpeed) speedEl.textContent = lastSpeed = s;

      const rpm = telemetry.sample('rpm', now);
      const frac = rpm === null ? 0 : Math.min(1, Math.max(0, rpm / maxRpm));
      if (Math.abs(frac - lastFrac) > 0.001) {
        rpmFill.style.transform = `scaleX(${frac})`;
        rpmFill.classList.toggle('hot', frac > 0.9);
        lastFrac = frac;
      }
      const r = rpm === null ? '–' : String(Math.round(rpm / 10) * 10);
      if (r !== lastRpm) rpmText.textContent = lastRpm = r;
    });
  });
</script>

<button class="card drive" data-nav {onclick} aria-label="Driving info">
  <div class="head">
    <span class="title">Drive</span>
    <SpeedLimitSign size={0.95} />
    {#if telemetry.has('deltaSec') && typeof delta === 'number'}
      <span class="delta tabular" class:gain={delta < 0} class:loss={delta > 0}>
        {delta > 0 ? '+' : ''}{delta.toFixed(2)}
      </span>
    {/if}
  </div>

  <div class="main">
    <div class="speed">
      <span class="value tabular" bind:this={speedEl}>–</span>
      <span class="unit">{mph ? 'mph' : 'km/h'}</span>
    </div>
    <div class="gear" aria-label="Gear">{gear}</div>
  </div>

  <div class="rpm">
    <div class="bar"><div class="fill" bind:this={rpmFill}></div></div>
    <div class="rpm-label"><span class="tabular" bind:this={rpmText}>–</span> rpm</div>
  </div>
</button>

<style>
  .drive {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0.75rem 0.95rem 0.85rem;
    text-align: left;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0)), var(--card);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .title {
    font-size: 0.95rem;
    font-weight: 700;
  }
  .delta {
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.12rem 0.5rem;
    border-radius: 999px;
    background: var(--card-2);
    color: var(--text-2);
  }
  .delta.gain {
    background: rgba(48, 209, 88, 0.18);
    color: var(--green);
  }
  .delta.loss {
    background: rgba(255, 69, 58, 0.18);
    color: var(--red);
  }
  .main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    min-height: 0;
  }
  .speed {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
  }
  .value {
    font-size: 3.6rem;
    font-weight: 650;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .unit {
    font-size: 0.9rem;
    color: var(--text-2);
    font-weight: 600;
  }
  .gear {
    min-width: 3.3rem;
    height: 3.3rem;
    padding: 0 0.5rem;
    border-radius: 0.8rem;
    background: var(--card-2);
    display: grid;
    place-items: center;
    font-size: 2.1rem;
    font-weight: 700;
  }
  .bar {
    height: 0.55rem;
    border-radius: 999px;
    background: #2f2f35;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    transform-origin: left center;
    transform: scaleX(0);
    background: linear-gradient(90deg, #30d158, #ffd60a 70%, #ff9f0a 88%);
    border-radius: inherit;
  }
  .fill:global(.hot) {
    background: linear-gradient(90deg, #30d158, #ffd60a 60%, #ff453a 90%);
  }
  .rpm-label {
    margin-top: 0.35rem;
    font-size: 0.75rem;
    color: var(--text-2);
  }
</style>
