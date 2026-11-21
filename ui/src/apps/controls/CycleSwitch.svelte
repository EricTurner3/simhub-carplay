<script lang="ts">
  import type { ControlInfo } from '@simhub-carplay/shared';
  import { useApp } from '../../lib/context.ts';
  import { isOn } from '../../lib/format.ts';
  import { CONFIRM_MS, GENERIC, LOOKS } from './catalog.ts';

  /**
   * One key that steps through positions (headlights: off -> parking -> on).
   * Picking a position sends as many taps as it takes to get there from the
   * position the game currently reports.
   */
  let { control, disabled = false }: { control: ControlInfo; disabled?: boolean } = $props();
  const { telemetry: t } = useApp();

  const steps = $derived(control.steps ?? []);
  const look = $derived(LOOKS[control.id] ?? GENERIC);
  const current = $derived.by(() => {
    let idx = 0;
    steps.forEach((s, i) => {
      if (s.state && isOn(t.slow[s.state] ?? null)) idx = i;
    });
    return idx;
  });

  let target = $state<number | null>(null);
  let miss = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (target !== null && current === target) {
      target = null;
      clearTimeout(timer);
    }
  });

  function pick(i: number) {
    if (disabled || steps.length === 0) return;
    const presses = (i - current + steps.length) % steps.length;
    if (presses === 0) return;
    if (!t.sendControl(control.id, 'tap', presses)) return;
    target = i;
    miss = false;
    clearTimeout(timer);
    // Allow for the bridge's spacing between taps.
    timer = setTimeout(() => {
      if (target === null) return;
      target = null;
      miss = true;
      setTimeout(() => (miss = false), 1800);
    }, CONFIRM_MS + presses * 450);
  }
</script>

<div class="cycle" style:--on={look.color}>
  <div class="head">
    <span class="icon" class:lit={current > 0}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        {@html look.glyph}
      </svg>
    </span>
    <span class="label">{control.label ?? control.id}</span>
    {#if miss}<span class="miss">No response</span>{/if}
  </div>
  <div class="seg" role="radiogroup" aria-label={control.label ?? control.id}>
    {#each steps as step, i (i)}
      <button
        data-nav
        role="radio"
        aria-checked={current === i}
        class:active={current === i}
        class:pending={target === i}
        {disabled}
        onclick={() => pick(i)}
      >
        {step.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .cycle {
    grid-column: span 2;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.75rem 0.85rem;
    border-radius: 1rem;
    background: var(--card-2);
    min-height: 6.4rem;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .icon {
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #3a3a41;
    transition: background 0.2s, color 0.2s;
  }
  .icon.lit {
    background: var(--on);
    color: #000;
  }
  .icon svg {
    width: 1.4rem;
  }
  .label {
    font-size: 0.85rem;
    font-weight: 650;
    flex: 1;
  }
  .miss {
    font-size: 0.75rem;
    color: var(--amber);
  }
  .seg {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 0.25rem;
    padding: 0.2rem;
    border-radius: 0.8rem;
    background: #1b1b1f;
  }
  .seg button {
    padding: 0.5rem 0.4rem;
    border-radius: 0.6rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-2);
    transition: background 0.2s, color 0.2s;
  }
  .seg button.active {
    background: var(--on);
    color: #000;
  }
  .seg button.pending {
    animation: pulse 0.8s ease-in-out infinite;
    background: #3a3a41;
    color: var(--text);
  }
  .seg button:disabled {
    opacity: 0.4;
  }
  @keyframes pulse {
    50% {
      opacity: 0.5;
    }
  }
</style>
