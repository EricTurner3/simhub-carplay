<script lang="ts">
  import { onMount } from 'svelte';
  import { useApp } from '../lib/context.ts';
  import { onFrame } from '../lib/frameloop.ts';
  import type { InputManager, PadDebug } from '../lib/input.ts';

  /** Toggle with F2 or ?debug. Shows raw gamepad button/axis indices for building the mapping. */
  let { input }: { input: InputManager } = $props();
  const { telemetry, view, ui } = useApp();

  let pads = $state<PadDebug[]>([]);
  let fps = $state(0);
  let speed = $state<number | null>(null);

  onMount(() => {
    let frames = 0;
    let last = performance.now();
    return onFrame((now) => {
      frames++;
      if (now - last < 250) return;
      fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
      pads = input.debugInfo();
      speed = telemetry.sample('speedKmh', now);
    });
  });
</script>

<aside class="debug">
  <div><b>ws</b> {telemetry.conn.ws} · <b>backend</b> {telemetry.conn.backend || '—'} · <b>upstream</b> {telemetry.conn.upstream}</div>
  <div><b>view</b> {view.view.kind}{view.view.kind === 'app' ? `:${view.view.id}` : ''} · <b>drive</b> {view.drive} ({view.reason}){view.manual ? ' · manual' : ''}</div>
  <div><b>speed</b> {speed === null ? '—' : speed.toFixed(1)} · <b>fps</b> {fps} · <b>last</b> {ui.lastAction || '—'}</div>
  {#if pads.length === 0}
    <div class="dim">No gamepads visible. Press a wheel button once with this window focused.</div>
  {/if}
  {#each pads as pad (pad.index)}
    <div class="pad" class:dim={!pad.used}>
      <div><b>#{pad.index}</b> {pad.id} <i>({pad.mapping}{pad.used ? '' : ', ignored by idContains'})</i></div>
      <div><b>buttons</b> {pad.pressed.length ? pad.pressed.join(', ') : '—'}</div>
      <div><b>axes</b> {pad.axes.map((a, i) => `${i}:${a}`).join('  ')}</div>
    </div>
  {/each}
</aside>

<style>
  .debug {
    position: fixed;
    right: 0.5rem;
    bottom: 0.5rem;
    max-width: min(36rem, 70vw);
    padding: 0.55rem 0.7rem;
    border-radius: 0.6rem;
    background: rgba(10, 10, 12, 0.88);
    border: 1px solid var(--line);
    font: 0.7rem/1.45 ui-monospace, Consolas, monospace;
    color: #cfd3da;
    z-index: 100;
    pointer-events: none;
    word-break: break-all;
  }
  b {
    color: #fff;
  }
  .pad {
    margin-top: 0.35rem;
    padding-top: 0.35rem;
    border-top: 1px solid var(--line);
  }
  .dim {
    opacity: 0.5;
  }
</style>
