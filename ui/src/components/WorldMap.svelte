<script lang="ts">
  import { onMount } from 'svelte';
  import * as maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  // MapLibre 6 finds its worker next to itself, which bundling breaks: point it at the emitted file.
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  import * as pmtiles from 'pmtiles';
  import { gameToLonLat, headingToBearing } from '@simhub-carplay/shared';
  import { num } from '../lib/format.ts';
  import { exitSignImage, mapStyle, type Game } from '../lib/map/style.ts';
  import { decodeRoute, followZoom, remainingRoute, type LonLat } from '../lib/map/route.ts';
  import { useApp } from '../lib/context.ts';
  import { onFrame } from '../lib/frameloop.ts';

  /**
   * ATS/ETS2 world map: MapLibre over the PMTiles from `npm run maps:build`,
   * heading-up and following the truck, with the active route drawn on it.
   * Needs WebGL 2; MapCard uses FallbackMap (2D canvas) where that's missing.
   */
  /** zoomOffset: added to the speed-based follow zoom (zoom buttons). */
  let { game, zoomOffset = 0 }: { game: Game; zoomOffset?: number } = $props();
  const { telemetry } = useApp();

  let container: HTMLElement;
  let map: maplibregl.Map | undefined;
  let styleReady = $state(false);
  /** Why the map can't render (shown instead of a blank map). */
  let failure = $state<string | null>(null);

  // Decoded route geometry per step, refreshed when the route changes.
  let lines: LonLat[][] = [];
  $effect(() => {
    lines = decodeRoute(telemetry.route);
    lastTrim = 0;
  });
  let lastTrim = 0;

  function drawRoute(at: LonLat) {
    const src = map?.getSource('route') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const coords = remainingRoute(lines, num(telemetry.get('nav.stepIndex')), at);
    src.setData({
      type: 'FeatureCollection',
      features: coords.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [],
    });
  }

  let protocolAdded = false;
  function addProtocol() {
    if (protocolAdded) return;
    maplibregl.setWorkerUrl(workerUrl);
    maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
    protocolAdded = true;
  }

  onMount(() => {
    addProtocol();
    const base = `${location.origin}/maps`;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container,
        style: mapStyle(game, base),
        interactive: false,
        attributionControl: false,
        center: [-96, 39],
        zoom: 5,
        fadeDuration: 0,
      });
    } catch (err) {
      failure = `Map failed to start: ${(err as Error).message}`;
      return;
    }
    map = m;
    // Errors before the style is up mean nothing will draw; later ones are single tiles.
    m.on('error', (e) => {
      console.error('[map]', e.error);
      if (!styleReady) failure = `Map failed to load: ${e.error?.message ?? 'unknown error'}`;
    });
    container.querySelector('canvas')?.addEventListener('webglcontextlost', () => (failure = 'Map lost its WebGL context (GPU reset or out of memory).'));
    m.setMissingStyleImageResolver((id) => {
      if (id !== 'exit-sign' || m.hasImage(id)) return;
      const { image, options } = exitSignImage();
      m.addImage(id, image, options);
    });
    m.on('load', () => (styleReady = true));

    // Truck puck: rotates with the map, so heading-up keeps it pointing up.
    const el = document.createElement('div');
    el.className = 'puck';
    el.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#fff"/><circle cx="20" cy="20" r="14" fill="#0a84ff"/><path d="M20 9 28 29 20 25 12 29Z" fill="#fff"/></svg>';
    const puck = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
      .setLngLat([-96, 39])
      .addTo(m);

    // Keep the puck in the lower part of the view, like CarPlay.
    const ro = new ResizeObserver(() => {
      m.resize();
      m.setPadding({ top: container.clientHeight * 0.4, bottom: 0, left: 0, right: 0 });
    });
    ro.observe(container);

    let zoom = 12;
    let last = 0;
    const off = onFrame((now) => {
      const x = telemetry.sample('pos.x', now);
      const z = telemetry.sample('pos.z', now);
      const heading = telemetry.sample('pos.heading', now);
      if (x === null || z === null) return;
      const lonLat = gameToLonLat(game === 'ats' ? 'usa' : 'europe', x, z);
      const bearing = heading === null ? m.getBearing() : headingToBearing(heading);

      const target = followZoom(telemetry.sample('speedKmh', now) ?? 0) + zoomOffset;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      zoom += (target - zoom) * Math.min(1, dt * 2);

      puck.setLngLat(lonLat).setRotation(bearing);
      m.jumpTo({ center: lonLat, bearing, zoom });
      if (styleReady && now - lastTrim > 250) {
        lastTrim = now;
        drawRoute(lonLat);
      }
    });

    return () => {
      off();
      ro.disconnect();
      m.remove();
      map = undefined;
    };
  });
</script>

<div class="world" bind:this={container}></div>
{#if failure}<div class="failure">{failure}</div>{/if}

<style>
  .world {
    position: absolute;
    inset: 0;
  }
  .failure {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 2rem;
    text-align: center;
    color: var(--text-2);
    font-size: 0.9rem;
  }
  .world :global(.puck) {
    width: 2.4rem;
    height: 2.4rem;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
  }
  .world :global(.puck svg) {
    width: 100%;
    height: 100%;
  }
</style>
