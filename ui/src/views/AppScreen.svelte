<script lang="ts">
  import { useApp } from '../lib/context.ts';
  import { appById, isAvailable } from '../apps/registry.ts';

  /** Shell around an app: header with back button, then the app's own screen. */
  let { id }: { id: string } = $props();
  const { view, telemetry } = useApp();
  const app = $derived(appById(id));
  const available = $derived(app ? isAvailable(app, telemetry) : false);
</script>

<div class="screen">
  <header>
    <button data-nav class="back" onclick={() => view.back()} aria-label="Back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
    <h1>{app?.name ?? id}</h1>
    {#if telemetry.profile?.game}<span class="game">{telemetry.profile.short}</span>{/if}
  </header>

  <div class="body">
    {#if !app}
      <p class="note">Unknown app “{id}”.</p>
    {:else if !available}
      <p class="note">{app.name} isn't available for {telemetry.profile?.name ?? 'this game'}.</p>
    {:else}
      <app.screen />
    {/if}
  </div>
</div>

<style>
  .screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-radius: var(--radius);
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 0.8rem;
    border-bottom: 1px solid var(--line);
  }
  .back {
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--accent);
  }
  .back svg {
    width: 1.4rem;
  }
  h1 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    flex: 1;
  }
  .game {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-2);
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: var(--card-2);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--gap);
    display: flex;
    flex-direction: column;
  }
  .body > :global(*) {
    flex-shrink: 0;
  }
  .note {
    margin: auto;
    color: var(--text-2);
  }
</style>
