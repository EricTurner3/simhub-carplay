<script lang="ts">
  import { useApp } from '../../lib/context.ts';
  import { fmtNum, num, unitLabel } from '../../lib/format.ts';

  const { telemetry: t } = useApp();
  const v = t.slow;

  const corners = [
    { id: 'FL', name: 'Front left' },
    { id: 'FR', name: 'Front right' },
    { id: 'RL', name: 'Rear left' },
    { id: 'RR', name: 'Rear right' },
  ] as const;

  const tempUnit = $derived(unitLabel(v.temperatureUnit) || '°C');
  const presUnit = $derived(unitLabel(v.tyrePressureUnit));

  /** Rough operating window. Real windows vary by game, car and compound. */
  function tempTone(temp: number | null): string {
    if (temp === null) return 'none';
    const c = tempUnit === '°F' ? ((temp - 32) * 5) / 9 : temp;
    return c < 65 ? 'cold' : c > 105 ? 'hot' : 'ok';
  }
</script>

<div class="screen">
  <div class="car">
    {#each corners as c (c.id)}
      {@const temp = num(v[`tyreTemp${c.id}`])}
      <div class="corner {c.id}" data-tone={tempTone(temp)}>
        <span class="name">{c.name}</span>
        <span class="temp tabular">{fmtNum(temp)}<small>{tempUnit}</small></span>
        {#if t.has(`tyrePres${c.id}`)}
          <span class="sub tabular">{fmtNum(v[`tyrePres${c.id}`], 1)} {presUnit}</span>
        {/if}
        {#if t.has(`tyreWear${c.id}`)}
          <span class="sub tabular">Wear {fmtNum(v[`tyreWear${c.id}`])}%</span>
        {/if}
      </div>
    {/each}
    <svg class="body" viewBox="0 0 60 120" aria-hidden="true">
      <rect x="8" y="4" width="44" height="112" rx="16" fill="none" stroke="currentColor" stroke-width="2.5" />
      <path d="M14 38h32M14 84h32" stroke="currentColor" stroke-width="2" />
    </svg>
  </div>
  <p class="note">Colour bands are a generic guide, not a compound-specific window.</p>
</div>

<style>
  .screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .car {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    grid-template-rows: 1fr 1fr;
    grid-template-areas:
      'FL body FR'
      'RL body RR';
    gap: var(--gap) 1.2rem;
    align-items: stretch;
  }
  .body {
    grid-area: body;
    height: 100%;
    width: 5rem;
    color: var(--text-3);
    align-self: center;
  }
  .corner {
    background: var(--card-2);
    border-radius: 1rem;
    padding: 0.8rem 1rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.15rem;
    border: 2px solid transparent;
  }
  .FL { grid-area: FL; }
  .FR { grid-area: FR; text-align: right; }
  .RL { grid-area: RL; }
  .RR { grid-area: RR; text-align: right; }
  .name {
    color: var(--text-2);
    font-size: 0.75rem;
  }
  .temp {
    font-size: 2.2rem;
    font-weight: 700;
  }
  .temp small {
    font-size: 0.45em;
    color: var(--text-2);
    margin-left: 0.15em;
  }
  .sub {
    color: var(--text-2);
    font-size: 0.85rem;
  }
  [data-tone='cold'] {
    border-color: rgba(90, 200, 250, 0.6);
  }
  [data-tone='cold'] .temp {
    color: #5ac8fa;
  }
  [data-tone='ok'] {
    border-color: rgba(48, 209, 88, 0.5);
  }
  [data-tone='hot'] {
    border-color: rgba(255, 69, 58, 0.7);
  }
  [data-tone='hot'] .temp {
    color: var(--red);
  }
  .note {
    margin: 0;
    color: var(--text-3);
    font-size: 0.7rem;
  }
</style>
