import type { AppModule } from '../types.ts';
import TyresScreen from './TyresScreen.svelte';

export default {
  id: 'tyres',
  name: 'Tyres',
  colors: ['#5c6270', '#2b2f38'],
  glyph: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5"/>',
  order: 45,
  requires: ['tyreTempFL'],
  screen: TyresScreen,
} satisfies AppModule;
