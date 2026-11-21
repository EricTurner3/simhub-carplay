<script lang="ts">
  import { useApp } from '../../lib/context.ts';
  import { fmtDistance, fmtNum, isOn, num, unitLabel } from '../../lib/format.ts';
  import Bar from '../../lib/kit/Bar.svelte';
  import Section from '../../lib/kit/Section.svelte';
  import Tile from '../../lib/kit/Tile.svelte';

  const { telemetry: t, units } = useApp();
  const v = t.slow;

  const fuel = $derived(num(v.fuel));
  const max = $derived(num(v.maxFuel));
  const unit = $derived(unitLabel(v.fuelUnit) || 'L');
  const frac = $derived(fuel !== null && max ? fuel / max : num(v.fuelPct) !== null ? num(v.fuelPct)! / 100 : null);

  // SCS reports average consumption in litres per km.
  const avg = $derived(num(v['truck.fuelAvgConsumption']));
  const avgText = $derived(
    avg === null || avg <= 0 ? '—' : units() === 'mph' ? `${(235.215 / (avg * 100)).toFixed(1)} mpg` : `${(avg * 100).toFixed(1)} L/100 km`,
  );
  const adBlue = $derived(num(v['truck.adBlue']));
  const adBlueCap = $derived(num(v['truck.adBlueCapacity']));
</script>

<div class="screen">
  <div class="tank">
    <Bar
      label={isOn(v['truck.fuelWarning']) ? 'Fuel — low!' : 'Fuel'}
      value={frac}
      text={fuel === null ? '—' : `${fmtNum(fuel, 1)}${max ? ` / ${fmtNum(max)}` : ''} ${unit}`}
    />
  </div>

  <Section title="Range">
    {#if t.has('truck.fuelRangeKm')}
      <Tile label="Range" value={num(v['truck.fuelRangeKm']) === null ? '—' : fmtDistance(num(v['truck.fuelRangeKm'])! * 1000, units())} big />
    {/if}
    {#if t.has('fuelLapsLeft')}<Tile label="Laps left" value={fmtNum(v.fuelLapsLeft, 1)} big />{/if}
    {#if t.has('fuelPerLap')}<Tile label="Per lap" value={fmtNum(v.fuelPerLap, 2)} unit={unit} />{/if}
    {#if t.has('truck.fuelAvgConsumption')}<Tile label="Average" value={avgText} />{/if}
    {#if t.has('fuelPct')}<Tile label="Tank" value={fmtNum(v.fuelPct, 0)} unit="%" />{/if}
  </Section>

  {#if t.has('truck.adBlue')}
    <Section title="AdBlue" min="14rem">
      <Bar label="AdBlue" value={adBlue !== null && adBlueCap ? adBlue / adBlueCap : null} text={adBlue === null ? '—' : `${fmtNum(adBlue)} L`} />
    </Section>
  {/if}
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .tank :global(.bar-tile) {
    padding: 1rem 1.1rem 1.1rem;
  }
  .tank :global(.track) {
    height: 0.9rem;
  }
  .tank :global(.text) {
    font-size: 1.2rem;
  }
</style>
