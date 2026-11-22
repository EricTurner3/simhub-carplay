<script lang="ts">
  import { flip } from 'svelte/animate';
  import { scale } from 'svelte/transition';
  import { useApp } from '../lib/context.ts';
  import { appById, isAvailable } from '../apps/registry.ts';
  import { activeGauges, type GaugeSpec } from './gauges/catalog.ts';
  import RadialGauge from './gauges/RadialGauge.svelte';

  /**
   * Bottom row of the "gauges" dashboard: fuel plus whatever matters most right
   * now (see gauges/catalog.ts). Each gauge opens its app.
   * `hide`: gauges another card is already showing (e.g. speed on the Drive card).
   */
  let { hide = [] }: { hide?: string[] } = $props();
  const { telemetry: t, units, view } = useApp();

  const shown = $derived(activeGauges(t, hide));

  function target(g: GaugeSpec): string | null {
    const app = g.app ? appById(g.app) : undefined;
    return app && isAvailable(app, t) ? app.id : null;
  }
</script>

<div class="card gauges">
  {#each shown as g (g.id)}
    {@const app = target(g)}
    <button
      class="gauge"
      data-nav
      disabled={!app}
      onclick={() => app && view.open(app)}
      aria-label={g.name}
      animate:flip={{ duration: 300 }}
      in:scale={{ start: 0.8, duration: 300 }}
    >
      {#if g.component}
        <g.component color={g.color} />
      {:else if g.read}
        <RadialGauge {...g.read(t, units())} color={g.color} />
      {/if}
    </button>
  {/each}
</div>

<style>
  .gauges {
    width: 100%;
    height: 100%;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 0.3rem;
    padding: 0.6rem 0.5rem;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0)), var(--card);
  }
  .gauge {
    min-width: 0;
    min-height: 0;
    border-radius: 0.8rem;
  }
  .gauge:disabled {
    opacity: 1;
    cursor: default;
  }
</style>
