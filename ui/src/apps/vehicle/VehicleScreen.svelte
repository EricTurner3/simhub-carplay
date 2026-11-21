<script lang="ts">
  import { useApp } from '../../lib/context.ts';
  import { fmtNum, fmtSpeed, fmtText, isOn, num, speedUnit, unitLabel } from '../../lib/format.ts';
  import Bar from '../../lib/kit/Bar.svelte';
  import Section from '../../lib/kit/Section.svelte';
  import Tile from '../../lib/kit/Tile.svelte';

  /**
   * Adapts to the game: every tile shows only if the active profile provides its
   * channel, and a section disappears when it has nothing to show.
   */
  const { telemetry: t, units } = useApp();
  const v = t.slow;
  const any = (...chs: string[]) => chs.some((c) => t.has(c));
  const onOff = (ch: string) => (isOn(v[ch]) ? 'On' : 'Off');

  const temp = $derived(unitLabel(v.temperatureUnit) || '°C');
  const damage = [
    ['truck.damageCabin', 'Cabin'],
    ['truck.damageChassis', 'Chassis'],
    ['truck.damageEngine', 'Engine'],
    ['truck.damageTransmission', 'Transmission'],
    ['truck.damageWheels', 'Wheels'],
  ] as const;
</script>

<div class="screen">
  {#if any('truck.brand', 'truck.model')}
    <div class="ident">{fmtText(v['truck.brand'])} <span>{fmtText(v['truck.model'])}</span></div>
  {/if}

  {#if any('brakeBias', 'tcLevel', 'absLevel', 'engineMap')}
    <Section title="Assists & setup">
      {#if t.has('brakeBias')}<Tile label="Brake bias" value={fmtNum(v.brakeBias, 1)} unit="%" />{/if}
      {#if t.has('tcLevel')}<Tile label="Traction control" value={fmtNum(v.tcLevel)} />{/if}
      {#if t.has('absLevel')}<Tile label="ABS" value={fmtNum(v.absLevel)} />{/if}
      {#if t.has('engineMap')}<Tile label="Engine map" value={fmtNum(v.engineMap)} />{/if}
    </Section>
  {/if}

  {#if any('oilTemp', 'waterTemp', 'oilPressure', 'truck.batteryVoltage')}
    <Section title="Engine">
      {#if t.has('oilTemp')}<Tile label="Oil temp" value={fmtNum(v.oilTemp)} unit={temp} />{/if}
      {#if t.has('waterTemp')}<Tile label="Water temp" value={fmtNum(v.waterTemp)} unit={temp} />{/if}
      {#if t.has('oilPressure')}<Tile label="Oil pressure" value={fmtNum(v.oilPressure, 1)} unit={unitLabel(v.oilPressureUnit)} />{/if}
      {#if t.has('truck.batteryVoltage')}<Tile label="Battery" value={fmtNum(v['truck.batteryVoltage'], 1)} unit="V" />{/if}
    </Section>
  {/if}

  {#if any('truck.airPressure', 'truck.brakeTemp', 'truck.retarder', 'truck.parkingBrake')}
    <Section title="Brakes">
      {#if t.has('truck.airPressure')}
        <Tile label="Air pressure" value={fmtNum(v['truck.airPressure'])} unit="psi" tone={isOn(v['truck.airPressureWarning']) ? 'bad' : 'normal'} />
      {/if}
      {#if t.has('truck.brakeTemp')}<Tile label="Brake temp" value={fmtNum(v['truck.brakeTemp'])} unit={temp} />{/if}
      {#if t.has('truck.retarder')}
        <Tile label="Retarder" value={num(v['truck.retarder']) ? `${fmtNum(v['truck.retarder'])} / ${fmtNum(v['truck.retarderSteps'])}` : 'Off'} />
      {/if}
      {#if t.has('truck.parkingBrake')}
        <Tile label="Parking brake" value={onOff('truck.parkingBrake')} tone={isOn(v['truck.parkingBrake']) ? 'warn' : 'normal'} />
      {/if}
    </Section>
  {/if}

  {#if any('truck.cruise', 'truck.diffLock', 'truck.liftAxle', 'truck.trailerAttached')}
    <Section title="Drivetrain">
      {#if t.has('truck.cruise')}
        <Tile
          label="Cruise control"
          value={isOn(v['truck.cruise']) && num(v['truck.cruiseKph']) ? fmtSpeed(num(v['truck.cruiseKph'])!, units()) : 'Off'}
          unit={isOn(v['truck.cruise']) ? speedUnit(units()) : ''}
          tone={isOn(v['truck.cruise']) ? 'good' : 'normal'}
        />
      {/if}
      {#if t.has('truck.diffLock')}<Tile label="Diff lock" value={onOff('truck.diffLock')} tone={isOn(v['truck.diffLock']) ? 'warn' : 'normal'} />{/if}
      {#if t.has('truck.liftAxle')}<Tile label="Lift axle" value={isOn(v['truck.liftAxle']) ? 'Raised' : 'Down'} />{/if}
      {#if t.has('truck.trailerAttached')}<Tile label="Trailer" value={isOn(v['truck.trailerAttached']) ? 'Attached' : 'None'} />{/if}
    </Section>
  {/if}

  {#if any(...damage.map(([ch]) => ch))}
    <Section title="Condition" min="12rem">
      {#each damage as [ch, label] (ch)}
        {#if t.has(ch)}
          {@const d = num(v[ch])}
          <Bar {label} value={d === null ? null : 1 - d} text={d === null ? '—' : `${Math.round(d * 100)}% wear`} />
        {/if}
      {/each}
    </Section>
  {/if}

  {#if any('airTemp', 'roadTemp')}
    <Section title="Conditions">
      {#if t.has('airTemp')}<Tile label="Air" value={fmtNum(v.airTemp)} unit={temp} />{/if}
      {#if t.has('roadTemp')}<Tile label="Track" value={fmtNum(v.roadTemp)} unit={temp} />{/if}
    </Section>
  {/if}
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .ident {
    font-size: 1.2rem;
    font-weight: 700;
    padding: 0 0.2rem;
  }
  .ident span {
    color: var(--text-2);
    font-weight: 500;
  }
</style>
