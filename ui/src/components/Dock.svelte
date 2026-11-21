<script lang="ts">
  import { onMount } from 'svelte';
  import { useApp } from '../lib/context.ts';
  import { dockApps } from '../apps/registry.ts';
  import { isOn } from '../lib/format.ts';
  import AppIcon from './AppIcon.svelte';

  const { view, telemetry } = useApp();

  let time = $state(clock());
  function clock() {
    return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
  }
  onMount(() => {
    const id = setInterval(() => (time = clock()), 1000);
    return () => clearInterval(id);
  });

  const apps = $derived(dockApps(telemetry));

  // Connection indicator: red = no data path, amber = SimHub up but game not running, green = live.
  const linked = $derived(telemetry.conn.ws === 'open' && telemetry.conn.upstream === 'connected');
  const running = $derived(linked && isOn(telemetry.slow.gameRunning ?? null));
  const status = $derived(!linked ? 'off' : running ? 'live' : 'idle');
  const label = $derived(telemetry.profile?.game ? telemetry.profile.short : linked ? 'SIM' : 'OFF');
  const statusText = $derived(
    !linked
      ? telemetry.conn.ws !== 'open'
        ? 'Bridge disconnected'
        : 'SimHub not connected'
      : `${telemetry.profile?.name ?? 'No game'}${running ? ' — running' : ' — not running'}`,
  );
  const activeId = $derived(view.view.kind === 'app' ? view.view.id : view.view.kind === 'split' ? 'dashboard' : '');
</script>

<nav class="dock">
  <div class="top">
    <div class="clock tabular">{time}</div>
    <div class="game" data-status={status} title={statusText} aria-label={statusText}>
      <span class="dot"></span><span class="code">{label}</span>
    </div>
  </div>

  <div class="apps">
    {#each apps as app (app.id)}
      <button data-nav class="app" class:active={activeId === app.id} onclick={() => view.open(app.id)} aria-label={app.name}>
        <AppIcon {app} />
      </button>
    {/each}
  </div>

  <button data-nav class="home" onclick={() => view.toggle()} aria-label={view.view.kind === 'split' ? 'App grid' : 'Dashboard'}>
    {#if view.view.kind === 'split'}
      <!-- 3x3 dots: go to grid -->
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {#each [5, 12, 19] as y (y)}
          {#each [5, 12, 19] as x (x)}<circle cx={x} cy={y} r="2.1" />{/each}
        {/each}
      </svg>
    {:else}
      <!-- split layout: go to dashboard -->
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="3" y="4" width="10" height="16" rx="2" />
        <rect x="15" y="4" width="6" height="7" rx="1.5" />
        <rect x="15" y="13" width="6" height="7" rx="1.5" />
      </svg>
    {/if}
  </button>
</nav>

<style>
  .dock {
    width: var(--dock-w);
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.9rem 0 0.8rem;
    gap: 0.8rem;
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: var(--glass);
    -webkit-backdrop-filter: var(--glass);
  }
  .top {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }
  .clock {
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .game {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    max-width: calc(var(--dock-w) - 0.6rem);
  }
  .dot {
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--red);
    box-shadow: 0 0 0.4rem currentColor;
    color: var(--red);
    transition: background 0.3s, color 0.3s;
  }
  [data-status='idle'] .dot {
    background: var(--amber);
    color: var(--amber);
  }
  [data-status='live'] .dot {
    background: var(--green);
    color: var(--green);
  }
  .code {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  [data-status='live'] .code {
    color: var(--text);
  }
  .apps {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.75rem;
  }
  .app {
    width: 3.4rem;
    border-radius: 23%;
    position: relative;
    transition: transform 0.15s var(--ease-out);
  }
  .app:active,
  .home:active {
    transform: scale(0.92);
  }
  .app.active::before {
    content: '';
    position: absolute;
    left: -0.85rem;
    top: 30%;
    bottom: 30%;
    width: 0.22rem;
    border-radius: 0 0.2rem 0.2rem 0;
    background: var(--text);
  }
  .home {
    width: 3.4rem;
    height: 3.4rem;
    border-radius: 50%;
    background: var(--card-2);
    color: var(--text);
    display: grid;
    place-items: center;
    transition: transform 0.15s var(--ease-out);
  }
  .home svg {
    width: 1.5rem;
    height: 1.5rem;
  }
</style>
