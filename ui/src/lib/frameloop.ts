/**
 * Single requestAnimationFrame loop shared by everything that animates from
 * telemetry. Callbacks write to the DOM/canvas directly; nothing here touches
 * Svelte state, so fast channels never cause component re-renders.
 * Lite mode runs it at ~30fps (every other frame on a 60Hz screen).
 */
import { perf } from './perf.svelte.ts';

type FrameFn = (now: number) => void;

const subscribers = new Set<FrameFn>();
let handle = 0;
let lastRun = 0;

function tick(now: number) {
  if (!perf.lite || now - lastRun >= 30) {
    lastRun = now;
    for (const fn of subscribers) fn(now);
  }
  handle = subscribers.size ? requestAnimationFrame(tick) : 0;
}

/** Run fn every frame until the returned function is called. Use from onMount. */
export function onFrame(fn: FrameFn): () => void {
  subscribers.add(fn);
  if (!handle) handle = requestAnimationFrame(tick);
  return () => subscribers.delete(fn);
}
