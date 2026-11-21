<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { ClientConfig } from '@simhub-carplay/shared';
  import { Telemetry } from './lib/telemetry.svelte.ts';
  import { ViewState } from './lib/viewState.svelte.ts';
  import { InputManager, type Action, type InputSource } from './lib/input.ts';
  import { current, ensureFocus, moveFocus } from './lib/focus.ts';
  import { onFrame } from './lib/frameloop.ts';
  import { debugFromUrl, wsUrl } from './lib/config.ts';
  import { setAppContext, type AppContext, type UiFlags } from './lib/context.ts';
  import { viewIn, viewOut } from './lib/transitions.ts';
  import Dock from './components/Dock.svelte';
  import DebugOverlay from './components/DebugOverlay.svelte';
  import SplitView from './views/SplitView.svelte';
  import GridView from './views/GridView.svelte';
  import AppScreen from './views/AppScreen.svelte';

  let props: { cfg: ClientConfig } = $props();
  // Config is fixed for the lifetime of the page.
  const cfg = untrack(() => props.cfg);

  const telemetry = new Telemetry(wsUrl(), cfg.ui.interpolate);
  const view = new ViewState(cfg.ui.autoSwitch);
  const ui: UiFlags = $state({ knob: false, debug: debugFromUrl, lastAction: '' });
  const units = () => (cfg.ui.units === 'auto' ? (telemetry.profile?.units ?? 'kmh') : cfg.ui.units);
  const ctx: AppContext = { cfg, telemetry, view, ui, units, nav: { edge: null } };
  setAppContext(ctx);

  let shell: HTMLElement;

  function handle(action: Action, src: InputSource) {
    ui.lastAction = `${action} (${src})`;
    if (action === 'debug') {
      ui.debug = !ui.debug;
      return;
    }
    const wasKnob = ui.knob;
    ui.knob = true;

    switch (action) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        // First press after touch just reveals the focus ring where it is.
        if (!wasKnob) ensureFocus(shell);
        else if (!moveFocus(shell, action) && !ctx.nav.edge?.(action)) scrollActiveView(action);
        break;
      case 'ok': {
        const el = current();
        if (el && shell.contains(el) && !el.closest('[inert]')) el.click();
        else ensureFocus(shell);
        break;
      }
      case 'back':
        view.back();
        break;
      case 'toggleView':
        view.toggle();
        break;
      case 'home':
        view.home();
        break;
    }
  }

  /** Up/down with nothing focusable in that direction scrolls a long app screen instead. */
  function scrollActiveView(dir: string) {
    if (dir !== 'up' && dir !== 'down') return;
    const body = shell.querySelector<HTMLElement>('.layer:not([inert]) .body');
    if (!body || body.scrollHeight <= body.clientHeight) return;
    body.scrollBy({ top: (dir === 'down' ? 1 : -1) * body.clientHeight * 0.6, behavior: 'smooth' });
  }

  const input = new InputManager(cfg.ui.input, handle);

  // After any view change, put knob focus somewhere sensible in the new view.
  $effect(() => {
    void view.view;
    tick().then(() => {
      if (ui.knob) ensureFocus(shell);
    });
  });

  onMount(() => {
    telemetry.connect();
    const offInput = telemetry.onInput((a) => handle(a, 'remote'));
    const offFrame = onFrame((now) => {
      input.poll(now);
      view.update(now, telemetry);
    });
    const onPointer = () => (ui.knob = false);
    window.addEventListener('pointerdown', onPointer, { capture: true });
    return () => {
      offInput();
      offFrame();
      window.removeEventListener('pointerdown', onPointer, { capture: true });
    };
  });

  const banner = $derived(
    telemetry.conn.ws !== 'open'
      ? 'Bridge disconnected — reconnecting…'
      : telemetry.conn.upstream !== 'connected'
        ? `Waiting for SimHub telemetry${telemetry.conn.detail ? ` (${telemetry.conn.detail})` : ''}`
        : '',
  );
</script>

<div class="shell" class:knob={ui.knob} bind:this={shell}>
  <Dock />

  <main class="stage" data-nav-main>
    {#if view.view.kind === 'split'}
      <div class="layer" in:viewIn={{ from: 0.94 }} out:viewOut={{ to: 1.04 }}>
        <SplitView />
      </div>
    {:else if view.view.kind === 'grid'}
      <div class="layer" in:viewIn={{ from: 1.08 }} out:viewOut>
        <GridView />
      </div>
    {:else}
      {#key view.view.id}
        <div class="layer" in:viewIn={{ from: 0.9 }} out:viewOut>
          <AppScreen id={view.view.id} />
        </div>
      {/key}
    {/if}

    {#if banner}
      <div class="banner">{banner}</div>
    {/if}
  </main>

  {#if ui.debug}
    <DebugOverlay {input} />
  {/if}
</div>

<style>
  .shell {
    height: 100%;
    display: flex;
    background: var(--bg);
  }
  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
    container: stage / size;
  }
  .layer {
    position: absolute;
    inset: 0;
    padding: var(--gap) var(--gap) var(--gap) 0;
    transform-origin: 50% 50%;
    will-change: transform, opacity;
  }
  .banner {
    position: absolute;
    top: 0.9rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    background: rgba(40, 40, 46, 0.92);
    border: 1px solid var(--line);
    color: var(--amber);
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
    pointer-events: none;
    z-index: 5;
  }
</style>
