<script lang="ts">
  import { onMount } from 'svelte';
  import type { MediaAction } from '@simhub-carplay/shared';
  import { useApp } from '../../lib/context.ts';
  import { onFrame } from '../../lib/frameloop.ts';
  import { bridgeUrl } from '../../lib/config.ts';

  /**
   * Now Playing. With media.source "simhub" there's only title + artist from SimHub's
   * MediaInfo; with "windows" the bridge reads the Windows media session, adding album
   * art, progress, play state and working transport buttons.
   */
  let { large = false }: { large?: boolean } = $props();
  const { telemetry: t } = useApp();

  const str = (ch: string) => (typeof t.slow[ch] === 'string' && t.slow[ch] ? String(t.slow[ch]) : '');
  const title = $derived(str('media.title'));
  const artist = $derived(str('media.artist'));
  const album = $derived(str('media.album'));
  const art = $derived(str('media.art'));
  const playing = $derived(t.slow['media.playing'] === true);
  const duration = $derived(typeof t.slow['media.durationSec'] === 'number' ? t.slow['media.durationSec'] : 0);
  // Buttons only do something when the bridge reads the Windows media session.
  const controllable = $derived(t.has('media.playing') && t.conn.ws === 'open');
  const canPrev = $derived(controllable && t.slow['media.canPrevious'] !== false);
  const canNext = $derived(controllable && t.slow['media.canNext'] !== false);
  const subtitle = $derived(large && album ? `${artist} — ${album}` : artist);

  let artFailed = $state(false);
  $effect(() => {
    void art;
    artFailed = false;
  });

  // Position arrives about once a second; run the bar smoothly in between while playing.
  let base = { pos: 0, at: 0 };
  $effect(() => {
    const pos = t.slow['media.positionSec'];
    base = { pos: typeof pos === 'number' ? pos : 0, at: performance.now() };
  });

  let fill: HTMLElement | undefined = $state();
  let elapsedEl: HTMLElement | undefined = $state();
  const clock = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  };

  onMount(() => {
    let lastText = '';
    return onFrame((now) => {
      if (!fill || duration <= 0) return;
      const pos = Math.min(duration, base.pos + (playing ? (now - base.at) / 1000 : 0));
      fill.style.transform = `scaleX(${pos / duration})`;
      const text = clock(pos);
      if (elapsedEl && text !== lastText) elapsedEl.textContent = lastText = text;
    });
  });

  const send = (action: MediaAction) => t.sendMedia(action);
</script>

<div class="card np" class:large>
  <div class="art" aria-hidden="true">
    {#if art && !artFailed}
      <img src={bridgeUrl(art)} alt="" onerror={() => (artFailed = true)} />
    {:else}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 17.5V6l10-2v11.5" /><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="15.5" r="2.5" />
      </svg>
    {/if}
  </div>
  <div class="meta">
    <div class="track">{title || 'Not Playing'}</div>
    <div class="artist">{title ? subtitle : controllable ? 'Nothing is playing' : 'No media reported by SimHub'}</div>
  </div>
  {#if duration > 0}
    <div class="progress">
      <div class="bar"><div class="fill" bind:this={fill}></div></div>
      <div class="times tabular"><span bind:this={elapsedEl}>0:00</span><span>{clock(duration)}</span></div>
    </div>
  {/if}
  <div class="controls">
    <button data-nav aria-label="Previous" disabled={!canPrev} onclick={() => send('previous')}>
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 12 20 6v12zM3 12l8-6v12z" /></svg>
    </button>
    <button data-nav class="play" aria-label={playing ? 'Pause' : 'Play'} disabled={!controllable} onclick={() => send('playPause')}>
      {#if playing}
        <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z" /></svg>
      {/if}
    </button>
    <button data-nav aria-label="Next" disabled={!canNext} onclick={() => send('next')}>
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
    grid-template-rows: 1fr auto auto;
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
    overflow: hidden;
  }
  .art svg {
    width: 55%;
  }
  .art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .progress {
    grid-column: 1 / -1;
    width: 100%;
  }
  .bar {
    height: 0.3rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--text);
    border-radius: inherit;
    transform-origin: left center;
    transform: scaleX(0);
  }
  .times {
    display: flex;
    justify-content: space-between;
    margin-top: 0.25rem;
    font-size: 0.7rem;
    color: var(--text-2);
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
  .controls button:disabled {
    opacity: 0.35;
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
    grid-template-rows: auto auto auto auto;
    justify-items: center;
    align-content: center;
    gap: 1rem;
    text-align: center;
  }
  .large .art {
    width: 12rem;
    box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.45);
  }
  .large .meta {
    max-width: 100%;
  }
  .large .progress {
    width: min(100%, 26rem);
  }
  .large .times {
    font-size: 0.8rem;
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
