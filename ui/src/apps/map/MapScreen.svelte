<script lang="ts">
  import { useApp } from '../../lib/context.ts';
  import { worldMap } from '../../lib/map/world.svelte.ts';
  import MapCard from '../../components/MapCard.svelte';
  import WorldMapScreen from './WorldMapScreen.svelte';

  /** Truck games with map data get the full-screen world map; everything else the map card, filling the screen. */
  const { telemetry } = useApp();
  const wm = worldMap(telemetry);
</script>

{#if wm.ready && wm.game}
  <WorldMapScreen game={wm.game} />
{:else}
  <div class="fill"><MapCard /></div>
{/if}

<style>
  .fill {
    position: absolute;
    inset: 0;
  }
</style>
