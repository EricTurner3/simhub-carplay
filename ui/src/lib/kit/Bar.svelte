<script lang="ts">
  /** Horizontal level bar, 0..1. `invert` for "lower is better" (damage). */
  let {
    label,
    value,
    text,
    invert = false,
  }: { label: string; value: number | null; text?: string; invert?: boolean } = $props();

  const frac = $derived(value === null ? 0 : Math.min(1, Math.max(0, value)));
  const level = $derived(invert ? 1 - frac : frac);
  const tone = $derived(value === null ? 'none' : level < 0.15 ? 'bad' : level < 0.35 ? 'warn' : 'good');
</script>

<div class="bar-tile">
  <div class="row">
    <span class="label">{label}</span>
    <span class="text tabular">{text ?? (value === null ? '—' : `${Math.round(frac * 100)}%`)}</span>
  </div>
  <div class="track"><div class="fill" data-tone={tone} style:transform={`scaleX(${frac})`}></div></div>
</div>

<style>
  .bar-tile {
    background: var(--card-2);
    border-radius: 0.9rem;
    padding: 0.7rem 0.9rem 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .label {
    color: var(--text-2);
    font-size: 0.75rem;
  }
  .text {
    font-size: 0.85rem;
    font-weight: 650;
  }
  .track {
    height: 0.45rem;
    border-radius: 999px;
    background: #34343b;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: inherit;
    transform-origin: left center;
    transition: transform 0.4s var(--ease-out);
    background: var(--green);
  }
  [data-tone='warn'] {
    background: var(--amber);
  }
  [data-tone='bad'] {
    background: var(--red);
  }
  [data-tone='none'] {
    background: transparent;
  }
</style>
