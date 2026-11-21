<script lang="ts">
  /** A labelled value. Apps compose screens out of these. */
  let {
    label,
    value,
    unit = '',
    tone = 'normal',
    big = false,
  }: {
    label: string;
    value: string;
    unit?: string;
    tone?: 'normal' | 'good' | 'warn' | 'bad';
    big?: boolean;
  } = $props();
</script>

<div class="tile" class:big data-tone={tone}>
  <span class="label">{label}</span>
  <span class="value tabular">{value}{#if unit && value !== '—'}<small>{unit}</small>{/if}</span>
</div>

<style>
  .tile {
    background: var(--card-2);
    border-radius: 0.9rem;
    padding: 0.7rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  .label {
    color: var(--text-2);
    font-size: 0.75rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .value {
    font-size: 1.45rem;
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .big .value {
    font-size: 2rem;
  }
  small {
    font-size: 0.6em;
    font-weight: 600;
    color: var(--text-2);
    margin-left: 0.2em;
  }
  [data-tone='good'] .value {
    color: var(--green);
  }
  [data-tone='warn'] .value {
    color: var(--amber);
  }
  [data-tone='bad'] .value {
    color: var(--red);
  }
</style>
