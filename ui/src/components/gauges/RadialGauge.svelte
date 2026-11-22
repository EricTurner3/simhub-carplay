<script lang="ts">
  import type { Reading } from './catalog.ts';

  /**
   * 270° ring with the value in the middle and the label in the gap at the
   * bottom. Sizes itself to the slot's height; text scales with the dial.
   */
  let {
    frac,
    value,
    unit = '',
    label,
    tone = 'normal',
    marker = null,
    color,
    smooth = true,
  }: Reading & { color: string; smooth?: boolean } = $props();

  const SWEEP = 75; // of pathLength 100
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  const fill = $derived(frac === null ? 0 : clamp01(frac));
</script>

<div class="gauge" class:warn={tone === 'warn'} class:bad={tone === 'bad'} class:smooth style:--tint={color}>
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <g transform="rotate(135 50 50)">
      <circle class="track" cx="50" cy="50" r="42" pathLength="100" style:stroke-dasharray={`${SWEEP} 100`} />
      {#if fill > 0}
        <circle class="fill" cx="50" cy="50" r="42" pathLength="100" style:stroke-dasharray={`${SWEEP * fill} 100`} />
      {/if}
      {#if marker !== null && marker > 0 && marker <= 1}
        <line class="marker" x1="84" y1="50" x2="99" y2="50" transform={`rotate(${270 * marker} 50 50)`} />
      {/if}
    </g>
  </svg>
  <div class="center">
    <span class="value tabular">{value}</span>
    {#if unit}<span class="unit">{unit}</span>{/if}
  </div>
  <span class="label">{label}</span>
</div>

<style>
  .gauge {
    position: relative;
    height: 100%;
    max-width: 100%;
    aspect-ratio: 1;
    margin: 0 auto;
    container-type: size;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: none;
    stroke-width: 7;
    stroke-linecap: round;
  }
  .track {
    stroke: rgba(255, 255, 255, 0.12);
  }
  .fill {
    stroke: var(--tint);
  }
  .smooth .fill {
    transition: stroke-dasharray 0.4s var(--ease-out), stroke 0.3s;
  }
  .warn .fill {
    stroke: var(--amber);
  }
  .bad .fill {
    stroke: var(--red);
  }
  .marker {
    stroke: #fff;
    stroke-width: 2.5;
  }
  .center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  .value {
    font-size: 27cqh;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .unit {
    margin-top: 2cqh;
    font-size: 10cqh;
    font-weight: 600;
    color: var(--text-2);
  }
  .label {
    position: absolute;
    left: 15%;
    right: 15%;
    bottom: 3%;
    text-align: center;
    font-size: 10.5cqh;
    font-weight: 650;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .warn .label {
    color: var(--amber);
  }
  .bad .label {
    color: var(--red);
  }
</style>
