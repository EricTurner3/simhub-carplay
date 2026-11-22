<script lang="ts">
  import { onMount } from 'svelte';
  import { useApp } from '../../lib/context.ts';
  import { onFrame } from '../../lib/frameloop.ts';
  import { DASH, fmtSpeed, isOn, num, speedUnit } from '../../lib/format.ts';
  import RadialGauge from './RadialGauge.svelte';
  import type { Tone } from './catalog.ts';

  /**
   * Interpolated speed with the posted limit as a tick on the ring; the ring
   * turns amber just over the limit and red well over it. Shows the cruise set
   * speed as the label while cruise is on.
   */
  let { color }: { color: string } = $props();
  const { telemetry: t, units } = useApp();

  let kmh = $state<number | null>(null);
  onMount(() =>
    onFrame((now) => {
      const s = t.sample('speedKmh', now);
      const r = s === null ? null : Math.round(Math.abs(s) * 2) / 2;
      if (r !== kmh) kmh = r;
    }),
  );

  // 0 means no posted limit.
  const limit = $derived(num(t.slow['nav.speedLimitKph']) || null);
  // Truck games top out around 130 km/h (80 mph); everything else gets a race-car scale.
  const scale = $derived(Math.max(t.has('nav.speedLimitKph') ? 130 : 320, (limit ?? 0) * 1.25));
  const tone = $derived.by<Tone>(() => {
    if (kmh === null || limit === null) return 'normal';
    const over = kmh - limit;
    return over > 8 ? 'bad' : over > 1.5 ? 'warn' : 'normal';
  });
  const cruise = $derived(isOn(t.slow['truck.cruise']) ? num(t.slow['truck.cruiseKph']) : null);
</script>

<RadialGauge
  {color}
  smooth={false}
  frac={kmh === null ? null : kmh / scale}
  value={kmh === null ? DASH : fmtSpeed(kmh, units())}
  unit={speedUnit(units())}
  label={cruise ? `Cruise ${fmtSpeed(cruise, units())}` : 'Speed'}
  marker={limit === null ? null : limit / scale}
  {tone}
/>
