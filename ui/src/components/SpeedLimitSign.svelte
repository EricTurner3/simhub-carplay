<script lang="ts">
  import { useApp } from '../lib/context.ts';

  /** Navigation speed limit sign (truck games): white rectangle in mph, red ring in km/h. Hidden when unknown. */
  let { size = 1 }: { size?: number } = $props();
  const { telemetry, units } = useApp();

  const mph = $derived(units() === 'mph');
  // 0 means "no limit known".
  const limitKph = $derived(telemetry.has('nav.speedLimitKph') ? Number(telemetry.slow['nav.speedLimitKph'] ?? 0) : 0);
  // US limits are posted in 5 mph steps; the SDK reports km/h.
  const limit = $derived(limitKph <= 0 ? 0 : mph ? Math.round((limitKph * 0.621371) / 5) * 5 : Math.round(limitKph));
</script>

{#if limit}
  <span class="limit" class:us={mph} style:font-size={`${size}rem`} aria-label={`Speed limit ${limit}`}>
    {#if mph}<small>{size > 1.2 ? 'SPEED LIMIT' : 'LIMIT'}</small>{/if}<b>{limit}</b>{#if mph && size > 1.2}<small>MPH</small>{/if}
  </span>
{/if}

<style>
  /* Sized in em so `size` scales the whole sign. */
  .limit {
    min-width: 2.45em;
    height: 2.45em;
    border-radius: 50%;
    border: 0.29em solid var(--red);
    background: #fff;
    color: #111;
    display: inline-grid;
    place-items: center;
    font-weight: 800;
    line-height: 1;
    flex-shrink: 0;
  }
  .limit b {
    font-size: 0.85em;
  }
  .limit.us {
    border-radius: 0.3em;
    border: 0.12em solid #111;
    box-shadow: 0 0 0 0.12em #fff;
    height: auto;
    min-width: 2.2em;
    padding: 0.18em 0.2em;
    align-content: center;
    gap: 0.06em;
  }
  .limit.us b {
    font-size: 1em;
  }
  .limit small {
    font-size: 0.42em;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
</style>
