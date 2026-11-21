<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { useApp } from '../lib/context.ts';
  import { DASHBOARD, availableApps } from '../apps/registry.ts';
  import { current, focusEl, type Dir } from '../lib/focus.ts';
  import AppIcon from '../components/AppIcon.svelte';

  const { view, nav, telemetry } = useApp();

  // Dashboard first, then every app the active game supports.
  const tiles = $derived([DASHBOARD, ...availableApps(telemetry)]);

  let width = $state(0);
  let height = $state(0);
  let page = $state(0);
  let dragPx = $state(0);
  let dragging = $state(false);
  let strip: HTMLElement;

  const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  // Icons per page follow the available space (4x2 at 1024x600, more on wide screens).
  const cols = $derived(Math.max(3, Math.floor(width / (13 * rem()))));
  const rows = $derived(Math.max(1, Math.floor(height / (12.5 * rem()))));
  const perPage = $derived(cols * rows);
  const pages = $derived.by(() => {
    const out = [];
    for (let i = 0; i < tiles.length; i += perPage) out.push(tiles.slice(i, i + perPage));
    return out;
  });

  $effect(() => {
    if (page > pages.length - 1) page = Math.max(0, pages.length - 1);
  });

  async function goPage(p: number, focus?: 'first' | 'last', row = 0) {
    page = Math.max(0, Math.min(pages.length - 1, p));
    if (!focus) return;
    await tick();
    const items = strip.children[page]?.querySelectorAll<HTMLElement>('[data-nav]');
    if (!items?.length) return;
    const lastRow = Math.floor((items.length - 1) / cols);
    const rowStart = Math.min(row, lastRow) * cols;
    const idx = focus === 'first' ? rowStart : Math.min(rowStart + cols - 1, items.length - 1);
    focusEl(items[idx]);
  }

  function currentRow(): number {
    const items = [...(strip.children[page]?.querySelectorAll('[data-nav]') ?? [])];
    const i = items.indexOf(current() as Element);
    return i < 0 ? 0 : Math.floor(i / cols);
  }

  onMount(() => {
    const edge = (dir: Dir) => {
      if (!strip.contains(current())) return false; // focus is in the dock
      if (dir === 'right' && page < pages.length - 1) return void goPage(page + 1, 'first', currentRow()), true;
      if (dir === 'left' && page > 0) return void goPage(page - 1, 'last', currentRow()), true;
      return false;
    };
    nav.edge = edge;
    return () => {
      if (nav.edge === edge) nav.edge = null;
    };
  });

  // Touch / mouse swipe between pages.
  let startX = 0;
  let moved = false;
  function down(e: PointerEvent) {
    startX = e.clientX;
    moved = false;
    dragging = true;
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    dragPx = e.clientX - startX;
    if (Math.abs(dragPx) > 8 && !moved) {
      moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    if (dragPx < -width * 0.18) goPage(page + 1);
    else if (dragPx > width * 0.18) goPage(page - 1);
    dragPx = 0;
  }
  function suppressClickAfterDrag(e: MouseEvent) {
    if (moved) {
      e.stopPropagation();
      e.preventDefault();
      moved = false;
    }
  }
</script>

<div class="grid-view">
  <div
    class="viewport"
    bind:clientWidth={width}
    bind:clientHeight={height}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onclickcapture={suppressClickAfterDrag}
    role="presentation"
  >
    <div
      class="strip"
      class:dragging
      bind:this={strip}
      style:transform={`translateX(calc(${-page * 100}% + ${dragPx}px))`}
    >
      {#each pages as apps, p (p)}
        <!-- Off-screen pages are inert so knob focus can't land on them mid-slide. -->
        <div class="page" inert={p !== page} style:--cols={cols} style:--rows={rows}>
          {#each apps as app, i (app.id)}
            <button class="app" data-nav data-nav-default={p === page && i === 0 ? '' : undefined} onclick={() => view.open(app.id)}>
              <span class="icon"><AppIcon {app} /></span>
              <span class="name">{app.name}</span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  {#if pages.length > 1}
    <div class="dots">
      {#each pages as _, p (p)}
        <button class="dot" class:on={p === page} onclick={() => goPage(p)} aria-label={`Page ${p + 1}`}></button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .grid-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: radial-gradient(140% 100% at 50% 0%, #1a1c24 0%, #0a0a0d 70%);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .viewport {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    touch-action: pan-y;
  }
  .strip {
    height: 100%;
    display: flex;
    transition: transform 0.45s var(--ease-out);
  }
  .strip.dragging {
    transition: none;
  }
  .page {
    flex: 0 0 100%;
    height: 100%;
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
    padding: 1.2rem 1.5rem 0.4rem;
    place-items: center;
  }
  .app {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem;
    border-radius: 1.2rem;
    transition: transform 0.15s var(--ease-out);
  }
  .app:active {
    transform: scale(0.92);
  }
  .icon {
    width: 5.4rem;
    display: block;
  }
  .name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.3rem 0 0.8rem;
  }
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--text-3);
    transition: background 0.2s;
  }
  .dot.on {
    background: var(--text);
  }
</style>
