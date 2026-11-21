<script lang="ts">
  import { useApp } from '../lib/context.ts';
  import { cardIn } from '../lib/transitions.ts';
  import MapCard from '../components/MapCard.svelte';
  import DriveCard from '../components/DriveCard.svelte';
  import ManeuverCard from '../components/ManeuverCard.svelte';
  import { activeCardApp } from '../apps/registry.ts';

  const { view, telemetry } = useApp();
  // Lower-right card is contributed by apps (Now Playing by default, Job while delivering).
  const cardApp = $derived(activeCardApp(telemetry));
  // Navigating (truck games): the next maneuver replaces the Drive card.
  const navigating = $derived(telemetry.route !== null && typeof telemetry.slow['nav.stepIndex'] === 'number');
</script>

<div class="split">
  <div class="slot map" in:cardIn|global>
    <MapCard onclick={() => view.open('map')} />
  </div>
  <div class="slot drive" in:cardIn|global={{ delay: 70 }}>
    {#if navigating}
      <ManeuverCard onclick={() => view.open('map')} />
    {:else}
      <DriveCard onclick={() => view.open(telemetry.has('lap') ? 'race' : 'vehicle')} />
    {/if}
  </div>
  <div class="slot np" in:cardIn|global={{ delay: 140 }}>
    {#if cardApp?.card}
      {#key cardApp.id}<cardApp.card.component />{/key}
    {/if}
  </div>
</div>

<style>
  .split {
    height: 100%;
    display: grid;
    gap: var(--gap);
    grid-template-columns: 1.45fr 1fr;
    grid-template-rows: 1fr 1fr;
    grid-template-areas:
      'map drive'
      'map np';
  }
  .slot {
    min-width: 0;
    min-height: 0;
  }
  .map {
    grid-area: map;
  }
  .drive {
    grid-area: drive;
  }
  .np {
    grid-area: np;
  }

  /* Widescreen (e.g. 1920x720): three columns side by side. */
  @container stage (min-aspect-ratio: 2.1 / 1) {
    .split {
      grid-template-columns: 1.7fr 1fr 1fr;
      grid-template-rows: 1fr;
      grid-template-areas: 'map drive np';
    }
  }

  /* Narrow / portrait: stack. */
  @container stage (max-aspect-ratio: 1.15 / 1) {
    .split {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1.4fr 1fr;
      grid-template-areas:
        'map map'
        'drive np';
    }
  }
</style>
