import type { AppModule } from '../types.ts';
import MapScreen from './MapScreen.svelte';

export default {
  id: 'map',
  name: 'Map',
  colors: ['#4fd16b', '#1d9a45'],
  glyph: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  order: 10,
  dock: 1,
  screen: MapScreen,
  fullBleed: true,
} satisfies AppModule;
