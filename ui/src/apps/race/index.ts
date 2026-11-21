import type { AppModule } from '../types.ts';
import RaceScreen from './RaceScreen.svelte';

export default {
  id: 'race',
  name: 'Race Info',
  colors: ['#ffa23a', '#e5601a'],
  glyph: '<path d="M6 21V3.5"/><path d="M6 4h12l-2.5 4.25L18 12.5H6"/>',
  order: 30,
  requires: ['lap'],
  dock: 3,
  screen: RaceScreen,
} satisfies AppModule;
