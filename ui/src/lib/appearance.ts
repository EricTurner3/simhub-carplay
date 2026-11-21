import type { AppearanceConfig, BackgroundGradient } from '@simhub-carplay/shared';

export interface BackgroundPreset {
  id: string;
  name: string;
  css: string;
}

/**
 * Background presets for the screen behind the dock and cards. Kept dark so
 * text on frosted cards stays readable; the color variation is what makes the
 * glass blur visible.
 */
export const BACKGROUNDS: BackgroundPreset[] = [
  { id: 'black', name: 'Black', css: 'radial-gradient(120% 90% at 50% 0%, #15161b 0%, #000 70%)' },
  { id: 'graphite', name: 'Graphite', css: 'linear-gradient(160deg, #3a3d45 0%, #1b1c21 45%, #08080a 100%)' },
  {
    id: 'midnight',
    name: 'Midnight',
    css: 'radial-gradient(90% 80% at 15% 10%, #1f3a8a 0%, transparent 60%), radial-gradient(80% 70% at 90% 100%, #3b1d6e 0%, transparent 60%), #05060d',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    css: 'radial-gradient(80% 70% at 10% 0%, #0f766e 0%, transparent 60%), radial-gradient(70% 70% at 90% 20%, #6d28d9 0%, transparent 60%), radial-gradient(90% 80% at 50% 110%, #1e3a8a 0%, transparent 60%), #04060a',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    css: 'radial-gradient(90% 80% at 0% 100%, #c2410c 0%, transparent 60%), radial-gradient(80% 80% at 100% 0%, #7e22ce 0%, transparent 60%), #120812',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    css: 'radial-gradient(100% 80% at 80% 0%, #0369a1 0%, transparent 60%), radial-gradient(80% 70% at 0% 100%, #0e7490 0%, transparent 55%), #02080f',
  },
  {
    id: 'forest',
    name: 'Forest',
    css: 'radial-gradient(90% 80% at 20% 0%, #166534 0%, transparent 60%), radial-gradient(80% 70% at 100% 100%, #365314 0%, transparent 60%), #030a05',
  },
  {
    id: 'crimson',
    name: 'Crimson',
    css: 'radial-gradient(90% 80% at 85% 10%, #9f1239 0%, transparent 60%), radial-gradient(70% 70% at 0% 100%, #4c0519 0%, transparent 60%), #0a0204',
  },
];

export const customCss = (c: BackgroundGradient) => `linear-gradient(${c.angle}deg, ${c.from}, ${c.to})`;

export function backgroundCss(a: AppearanceConfig): string {
  if (a.background === 'custom') return customCss(a.custom);
  return (BACKGROUNDS.find((b) => b.id === a.background) ?? BACKGROUNDS[0]).css;
}

/** Push appearance into the page: the background as --bg-image, glass on/off as a root class. */
export function applyAppearance(a: AppearanceConfig): void {
  const root = document.documentElement;
  root.style.setProperty('--bg-image', backgroundCss(a));
  root.classList.toggle('no-glass', !a.glass);
}
