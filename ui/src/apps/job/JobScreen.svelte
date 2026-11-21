<script lang="ts">
  import { useApp } from '../../lib/context.ts';
  import {
    fmtDistance,
    fmtDuration,
    fmtFraction,
    fmtGameClock,
    fmtMass,
    fmtMoney,
    fmtText,
    isOn,
    num,
  } from '../../lib/format.ts';
  import Section from '../../lib/kit/Section.svelte';
  import Tile from '../../lib/kit/Tile.svelte';

  const { telemetry: t, units } = useApp();
  const v = t.slow;

  const onJob = $derived(isOn(v['job.onJob']));
  const remainingMin = $derived(num(v['job.remainingMinutes']));
  const damage = $derived(num(v['job.cargoDamage']));
  const plannedM = $derived(num(v['job.plannedDistanceKm']) === null ? null : num(v['job.plannedDistanceKm'])! * 1000);
</script>

<div class="screen">
  {#if !onJob}
    <div class="empty">
      <p class="big">No active job</p>
      <p>Game time {fmtGameClock(v['world.gameMinutes'])}</p>
    </div>
  {:else}
    <div class="route card-2">
      <div class="stop">
        <span class="city">{fmtText(v['job.sourceCity'])}</span>
        <span class="company">{fmtText(v['job.sourceCompany'])}</span>
      </div>
      <svg class="arrow" viewBox="0 0 48 12" aria-hidden="true">
        <path d="M2 6h40M36 1l6 5-6 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div class="stop dest">
        <span class="city">{fmtText(v['job.destinationCity'])}</span>
        <span class="company">{fmtText(v['job.destinationCompany'])}</span>
      </div>
      <div class="cargo">
        <span>{fmtText(v['job.cargo'])} · {fmtMass(v['job.cargoMassKg'], units())}</span>
        {#if isOn(v['job.special'])}<span class="badge">Special transport</span>{/if}
        {#if t.has('job.cargoLoaded') && !isOn(v['job.cargoLoaded'])}<span class="badge warn">Pick up cargo</span>{/if}
      </div>
    </div>

    <Section title="Trip" min="14rem">
      {#if t.has('nav.distanceM')}<Tile label="Distance left" value={fmtDistance(v['nav.distanceM'], units())} big />{/if}
      {#if t.has('nav.timeSec')}<Tile label="Est. drive time" value={fmtDuration(v['nav.timeSec'])} big />{/if}
      <Tile
        label="Delivery window"
        value={remainingMin === null ? '—' : remainingMin < 0 ? `Late ${fmtDuration(-remainingMin * 60)}` : fmtDuration(remainingMin * 60)}
        tone={remainingMin === null ? 'normal' : remainingMin < 0 ? 'bad' : remainingMin < 60 ? 'warn' : 'good'}
        big
      />
    </Section>

    <Section title="Job">
      <Tile label="Deadline" value={fmtGameClock(v['job.deadlineMinutes'])} />
      <Tile label="Income" value={fmtMoney(v['job.income'], t.profile?.currency)} />
      <Tile label="Planned distance" value={fmtDistance(plannedM, units())} />
      <Tile label="Cargo damage" value={fmtFraction(damage)} tone={damage !== null && damage > 0.05 ? 'warn' : 'normal'} />
    </Section>
  {/if}

  <Section title="World">
    {#if t.has('world.gameMinutes')}<Tile label="Game time" value={fmtGameClock(v['world.gameMinutes'])} />{/if}
    {#if t.has('world.restStopMinutes')}
      <Tile
        label="Rest needed in"
        value={num(v['world.restStopMinutes']) === null ? '—' : fmtDuration(num(v['world.restStopMinutes'])! * 60)}
        tone={(num(v['world.restStopMinutes']) ?? 999) < 60 ? 'warn' : 'normal'}
      />
    {/if}
  </Section>
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .card-2 {
    background: var(--card-2);
    border-radius: 0.9rem;
  }
  .route {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.4rem 1rem;
    padding: 0.9rem 1.1rem;
  }
  .stop {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .dest {
    text-align: right;
  }
  .city {
    font-size: 1.35rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .company {
    color: var(--text-2);
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .arrow {
    width: 3rem;
    color: var(--accent);
  }
  .cargo {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-2);
    font-size: 0.85rem;
    border-top: 1px solid var(--line);
    padding-top: 0.55rem;
  }
  .badge {
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: rgba(10, 132, 255, 0.18);
    color: var(--accent);
    font-weight: 600;
    font-size: 0.75rem;
  }
  .badge.warn {
    background: rgba(255, 179, 64, 0.18);
    color: var(--amber);
  }
  .empty {
    display: grid;
    place-items: center;
    padding: 2rem 0 1rem;
    color: var(--text-2);
  }
  .empty p {
    margin: 0.2rem 0;
  }
  .empty .big {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--text);
  }
</style>
