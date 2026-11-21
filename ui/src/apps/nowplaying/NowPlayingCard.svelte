<script lang="ts">
  import { useApp } from '../../lib/context.ts';

  /**
   * Track info comes from SimHub's MediaInfo plugin (media.title / media.artist).
   * Transport buttons are placeholders until a backend can trigger media actions.
   */
  let { large = false }: { large?: boolean } = $props();
  const { telemetry } = useApp();
  let playing = $state(false);

  const title = $derived(typeof telemetry.slow['media.title'] === 'string' && telemetry.slow['media.title'] ? String(telemetry.slow['media.title']) : '');
  const artist = $derived(typeof telemetry.slow['media.artist'] === 'string' ? String(telemetry.slow['media.artist']) : '');
</script>

<div class="card np" class:large>
  <div class="art" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 17.5V6l10-2v11.5" /><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="15.5" r="2.5" />
    </svg>
  </div>
  <div class="meta">
    <div class="track">{title || 'Not Playing'}</div>
    <div class="artist">{title ? artist : 'No media reported by SimHub'}</div>
  </div>
  <div class="controls">
    <button data-nav aria-label="Previous">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 12 20 6v12zM3 12l8-6v12z" /></svg>
    </button>
    <button data-nav class="play" aria-label={playing ? 'Pause' : 'Play'} onclick={() => (playing = !playing)}>
      {#if playing}
        <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z" /></svg>
      {/if}
    </button>
    <button data-nav aria-label="Next">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 12 4 6v12zM21 12l-8-6v12z" /></svg>
    </button>
  </div>
</div>

<style>
  .np {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: 1fr auto;
    gap: 0.4rem 0.8rem;
    padding: 0.8rem 0.95rem;
    align-items: center;
  }
  .art {
    width: 3.6rem;
    aspect-ratio: 1;
    border-radius: 0.6rem;
    background: linear-gradient(135deg, #3b3b44, #232328);
    color: var(--text-3);
    display: grid;
    place-items: center;
  }
  .art svg {
    width: 55%;
  }
  .meta {
    min-width: 0;
  }
  .track {
    font-weight: 700;
    font-size: 1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .artist {
    color: var(--text-2);
    font-size: 0.82rem;
    margin-top: 0.15rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .controls {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-around;
    align-items: center;
  }
  .controls button {
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--text);
    transition: transform 0.12s var(--ease-out), background 0.2s;
  }
  .controls button:active {
    transform: scale(0.9);
    background: var(--card-2);
  }
  .controls svg {
    width: 1.35rem;
  }
  .controls .play svg {
    width: 1.75rem;
  }

  .np.large {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    justify-items: center;
    align-content: center;
    gap: 1rem;
    text-align: center;
  }
  .large .art {
    width: 12rem;
  }
  .large .track {
    font-size: 1.4rem;
  }
  .large .controls {
    gap: 2.5rem;
  }
  .large .controls button {
    width: 3.6rem;
    height: 3.6rem;
  }
  .large .controls svg {
    width: 1.9rem;
  }
  .large .controls .play svg {
    width: 2.4rem;
  }
</style>
