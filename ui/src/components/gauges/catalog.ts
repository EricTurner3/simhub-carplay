import type { Component } from 'svelte';
import type { Units } from '@simhub-carplay/shared';
import type { Telemetry } from '../../lib/telemetry.svelte.ts';
import { DASH, fmtDistance, isOn, num } from '../../lib/format.ts';
import SpeedGauge from './SpeedGauge.svelte';

export type Tone = 'normal' | 'warn' | 'bad';

export interface Reading {
  /** Arc fill, 0..1 (null: no data, empty arc). */
  frac: number | null;
  value: string;
  unit?: string;
  label: string;
  tone?: Tone;
  /** Tick on the arc, 0..1 (e.g. the speed limit). */
  marker?: number | null;
}

/**
 * A radial gauge for the dashboard's gauge row. The row shows the (up to) three
 * gauges with the highest current priority, left to right by `order`, so
 * situational gauges (air pressure, rest stop, cargo damage) push the routine
 * ones out while they matter and drop back out afterwards.
 */
export interface GaugeSpec {
  id: string;
  name: string;
  order: number;
  /** Arc color while the tone is normal. */
  color: string;
  /** App opened when the gauge is tapped. */
  app?: string;
  /** How much this gauge matters right now; 0 hides it. Reactive (reads telemetry.slow). */
  priority: (t: Telemetry) => number;
  /** Reading for the generic gauge; omit when `component` draws it. */
  read?: (t: Telemetry, units: Units) => Reading;
  /** Custom gauge (e.g. per-frame speed). Gets `color`. */
  component?: Component<{ color: string }>;
}

export const MAX_GAUGES = 3;

const DAMAGE = ['truck.damageCabin', 'truck.damageChassis', 'truck.damageEngine', 'truck.damageTransmission', 'truck.damageWheels'];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const pct = (frac: number) => String(Math.round(frac * 100));

function fuelFrac(t: Telemetry): number | null {
  const v = t.slow;
  const fuel = num(v.fuel);
  const max = num(v.maxFuel);
  // Prefer Fuel / MaxFuel: SimHub's FuelPercent can be wildly off (e.g. 200%).
  if (fuel !== null && max) return fuel / max;
  const p = num(v.fuelPct);
  return p === null ? null : clamp01(p / 100);
}

function worstDamage(t: Telemetry): number | null {
  const ds = DAMAGE.map((ch) => num(t.slow[ch])).filter((d): d is number => d !== null);
  return ds.length ? Math.max(...ds) : null;
}

/** Game minutes until the driver must rest; only worth showing in the last two hours. */
const REST_WINDOW_MIN = 120;
const restMinutes = (t: Telemetry) => num(t.slow['world.restStopMinutes']);
const restDue = (m: number | null): m is number => m !== null && m > 0 && m <= REST_WINDOW_MIN;

export const GAUGES: GaugeSpec[] = [
  {
    id: 'fuel',
    name: 'Fuel',
    order: 0,
    color: '#30d158',
    app: 'fuel',
    priority: (t) => (t.has('fuel') || t.has('fuelPct') ? 100 : 0),
    read: (t, units) => {
      const frac = fuelFrac(t);
      const range = num(t.slow['truck.fuelRangeKm']);
      const low = isOn(t.slow['truck.fuelWarning']) || (frac !== null && frac < 0.12);
      return {
        frac,
        value: frac === null ? DASH : pct(frac),
        // The ring already says "level"; the range is the more useful second line.
        unit: range === null ? '%' : fmtDistance(range * 1000, units),
        label: 'Fuel',
        tone: low ? 'bad' : frac !== null && frac < 0.25 ? 'warn' : 'normal',
      };
    },
  },
  {
    id: 'speed',
    name: 'Speed',
    order: 1,
    color: '#0a84ff',
    app: 'vehicle',
    priority: (t) => (t.has('speedKmh') ? 90 : 0),
    component: SpeedGauge,
  },
  {
    id: 'rpm',
    name: 'RPM',
    order: 2,
    color: '#bf5af2',
    app: 'vehicle',
    // Filler for games without truck damage (racing): below everything else.
    priority: (t) => (t.has('rpm') ? 20 : 0),
    read: (t) => {
      const rpm = num(t.slow.rpm);
      const max = num(t.slow.maxRpm) || 8000;
      const frac = rpm === null ? null : rpm / max;
      return {
        frac,
        value: rpm === null ? DASH : (rpm / 1000).toFixed(1),
        unit: '×1000',
        label: 'RPM',
        tone: frac !== null && frac > 0.9 ? 'bad' : 'normal',
      };
    },
  },
  {
    id: 'air',
    name: 'Air pressure',
    order: 3,
    color: '#64d2ff',
    app: 'vehicle',
    // Only while the low-air warning is on: brakes are about to lock.
    priority: (t) => (isOn(t.slow['truck.airPressureWarning']) ? 95 : 0),
    read: (t) => {
      const psi = num(t.slow['truck.airPressure']);
      return { frac: psi === null ? null : clamp01(psi / 150), value: psi === null ? DASH : String(Math.round(psi)), unit: 'psi', label: 'Air brakes', tone: 'bad' };
    },
  },
  {
    id: 'rest',
    name: 'Rest stop',
    order: 4,
    color: '#ffb340',
    app: 'job',
    priority: (t) => (restDue(restMinutes(t)) ? 80 : 0),
    read: (t) => {
      const m = restMinutes(t);
      if (!restDue(m)) return { frac: null, value: DASH, label: 'Rest' };
      const hm = m >= 60 ? `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}` : String(Math.round(m));
      return { frac: m / REST_WINDOW_MIN, value: hm, unit: m >= 60 ? 'h' : 'min', label: 'Rest', tone: m <= 30 ? 'bad' : 'warn' };
    },
  },
  {
    id: 'cargo',
    name: 'Cargo',
    order: 5,
    color: '#ffb340',
    app: 'job',
    priority: (t) => {
      const d = num(t.slow['job.cargoDamage']);
      return isOn(t.slow['job.onJob']) && d !== null && d >= 0.05 ? 60 : 0;
    },
    read: (t) => {
      const d = num(t.slow['job.cargoDamage']) ?? 0;
      return { frac: 1 - d, value: pct(1 - d), unit: '%', label: 'Cargo', tone: d >= 0.15 ? 'bad' : 'warn' };
    },
  },
  {
    id: 'condition',
    name: 'Condition',
    order: 6,
    color: '#30d158',
    app: 'vehicle',
    priority: (t) => {
      const worst = worstDamage(t);
      return worst === null ? 0 : worst >= 0.1 ? 85 : 40;
    },
    read: (t) => {
      const worst = worstDamage(t);
      if (worst === null) return { frac: null, value: DASH, label: 'Condition' };
      return {
        frac: 1 - worst,
        value: pct(1 - worst),
        unit: '%',
        label: 'Condition',
        tone: worst >= 0.3 ? 'bad' : worst >= 0.1 ? 'warn' : 'normal',
      };
    },
  },
];

/** Gauges to show right now, left to right. `hide`: ids another card already covers. */
export function activeGauges(t: Telemetry, hide: readonly string[] = []): GaugeSpec[] {
  return GAUGES.filter((g) => !hide.includes(g.id))
    .map((g) => ({ g, p: g.priority(t) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p)
    .slice(0, MAX_GAUGES)
    .map((x) => x.g)
    .sort((a, b) => a.order - b.order);
}
