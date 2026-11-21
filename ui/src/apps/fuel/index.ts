import type { AppModule } from '../types.ts';
import FuelScreen from './FuelScreen.svelte';

export default {
  id: 'fuel',
  name: 'Fuel',
  colors: ['#ffd84a', '#e0a610'],
  glyph: '<path d="M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v15.5M3.5 20.5h12M5 10h9"/><path d="M14 8.5h2a1.5 1.5 0 0 1 1.5 1.5v6a1.25 1.25 0 0 0 2.5 0V8l-2.5-3"/>',
  order: 40,
  requires: ['fuel'],
  screen: FuelScreen,
} satisfies AppModule;
