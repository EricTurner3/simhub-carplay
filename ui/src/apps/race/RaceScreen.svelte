<script lang="ts">
  import { useApp } from '../../lib/context.ts';
  import { fmtLapTime, fmtNum, fmtText, isOn, num } from '../../lib/format.ts';
  import Section from '../../lib/kit/Section.svelte';
  import Tile from '../../lib/kit/Tile.svelte';

  const { telemetry: t } = useApp();
  const v = t.slow;

  const delta = $derived(num(v.deltaSec));
  const flag = $derived(fmtText(v.flag));
  const flagTone = $derived(
    /green/i.test(flag) ? 'good' : /yellow|blue|white/i.test(flag) ? 'warn' : /red|black/i.test(flag) ? 'bad' : 'normal',
  );
</script>

<div class="screen">
  <Section title="Session">
    {#if t.has('lap')}
      <Tile label="Lap" value={t.has('totalLaps') && num(v.totalLaps) ? `${fmtNum(v.lap)} / ${fmtNum(v.totalLaps)}` : fmtNum(v.lap)} big />
    {/if}
    {#if t.has('position')}
      <Tile label="Position" value={t.has('opponents') && num(v.opponents) ? `P${fmtNum(v.position)} / ${fmtNum(v.opponents)}` : `P${fmtNum(v.position)}`} big />
    {/if}
    {#if t.has('deltaSec')}
      <Tile
        label="Delta (session best)"
        value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`}
        tone={delta === null ? 'normal' : delta < 0 ? 'good' : delta > 0 ? 'bad' : 'normal'}
        big
      />
    {/if}
  </Section>

  <Section title="Times">
    {#if t.has('lastLap')}<Tile label="Last lap" value={fmtLapTime(v.lastLap)} />{/if}
    {#if t.has('bestLap')}<Tile label="Best lap" value={fmtLapTime(v.bestLap)} />{/if}
  </Section>

  <Section title="Race control">
    {#if t.has('flag')}<Tile label="Flag" value={flag === '—' ? 'None' : flag} tone={flagTone} />{/if}
    {#if t.has('inPit')}<Tile label="Pit" value={isOn(v.inPit) ? 'In pit' : 'On track'} tone={isOn(v.inPit) ? 'warn' : 'normal'} />{/if}
    <Tile label="Penalties" value="—" />
  </Section>
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
</style>
