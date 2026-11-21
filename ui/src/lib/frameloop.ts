/**
 * Single requestAnimationFrame loop shared by everything that animates from
 * telemetry. Callbacks write to the DOM/canvas directly; nothing here touches
 * Svelte state, so fast channels never cause component re-renders.
 */
type FrameFn = (now: number) => void;

const subscribers = new Set<FrameFn>();
let handle = 0;

function tick(now: number) {
  for (const fn of subscribers) fn(now);
  handle = subscribers.size ? requestAnimationFrame(tick) : 0;
}

/** Run fn every frame until the returned function is called. Use from onMount. */
export function onFrame(fn: FrameFn): () => void {
  subscribers.add(fn);
  if (!handle) handle = requestAnimationFrame(tick);
  return () => subscribers.delete(fn);
}
