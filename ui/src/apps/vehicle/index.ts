import type { AppModule } from '../types.ts';
import VehicleScreen from './VehicleScreen.svelte';

export default {
  id: 'vehicle',
  name: 'Vehicle',
  colors: ['#8e9bb0', '#55617a'],
  glyph: '<path d="M5 11.5l1.6-4.3A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1.2l1.6 4.3"/><rect x="3.5" y="11.5" width="17" height="5.5" rx="2"/><path d="M6.5 17v2M17.5 17v2"/><circle cx="7.5" cy="14.25" r="0.75"/><circle cx="16.5" cy="14.25" r="0.75"/>',
  order: 50,
  screen: VehicleScreen,
} satisfies AppModule;
