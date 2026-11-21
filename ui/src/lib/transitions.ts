import { cubicIn, quintOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** View entering: fade + scale from `from` toward 1. */
export function viewIn(_node: Element, { from = 1.05, delay = 60, duration = 460 } = {}): TransitionConfig {
  return {
    delay: reduced() ? 0 : delay,
    duration: reduced() ? 0 : duration,
    easing: quintOut,
    css: (t) => `opacity:${t};transform:scale(${from + (1 - from) * t})`,
  };
}

/** View leaving: becomes inert immediately (no focus/clicks), then fades + scales to `to`. */
export function viewOut(node: Element, { to = 0.96, duration = 200 } = {}): TransitionConfig {
  (node as HTMLElement).inert = true;
  return {
    duration: reduced() ? 0 : duration,
    easing: cubicIn,
    css: (t) => `opacity:${t};transform:scale(${to + (1 - to) * t})`,
  };
}

/** Card entering the split view: staggered rise. */
export function cardIn(_node: Element, { delay = 0 } = {}): TransitionConfig {
  return {
    delay: reduced() ? 0 : 80 + delay,
    duration: reduced() ? 0 : 520,
    easing: quintOut,
    css: (t, u) => `opacity:${t};transform:translateY(${u * 1.5}rem) scale(${0.97 + 0.03 * t})`,
  };
}
