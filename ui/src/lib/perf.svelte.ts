/**
 * Lite mode for weak screens (old tablets, Pi): no backdrop blur, no view
 * transitions or looping animations, telemetry drawing capped at 30fps and
 * canvases at 1x resolution. Per device (localStorage), unlike the shared
 * appearance settings, so a slow tablet doesn't change the PC's look.
 *
 * ?lite=1 / ?lite=0 in the URL sets it (and remembers it); otherwise it is on
 * by default for devices without WebGL 2 or with 2 GB of memory or less.
 */
const KEY = 'carplay.lite';

function initial(): boolean {
  const param = new URLSearchParams(location.search).get('lite');
  if (param !== null) {
    const on = param !== '0' && param !== 'false';
    save(on);
    return on;
  }
  try {
    const stored = localStorage.getItem(KEY);
    if (stored !== null) return stored === '1';
  } catch {
    /* storage blocked */
  }
  return weakDevice();
}

function weakDevice(): boolean {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memory !== undefined && memory <= 2) return true;
  try {
    return !document.createElement('canvas').getContext('webgl2');
  } catch {
    return true;
  }
}

function save(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage blocked */
  }
}

export const perf = $state({ lite: initial() });

export function setLite(on: boolean) {
  perf.lite = on;
  save(on);
}

/** Canvas backing-store scale: device resolution, capped at `max`, and 1x in lite mode. */
export const canvasDpr = (max = Infinity) => (perf.lite ? 1 : Math.min(max, window.devicePixelRatio || 1));
