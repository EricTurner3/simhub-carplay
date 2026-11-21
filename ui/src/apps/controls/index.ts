import type { AppModule } from '../types.ts';
import ControlsScreen from './ControlsScreen.svelte';

export default {
  id: 'controls',
  name: 'Controls',
  colors: ['#7d7aff', '#3634a3'],
  glyph: '<rect x="3" y="4.5" width="18" height="6.5" rx="3.25"/><circle cx="16.75" cy="7.75" r="1.75"/><rect x="3" y="13" width="18" height="6.5" rx="3.25"/><circle cx="7.25" cy="16.25" r="1.75"/>',
  order: 35,
  // Shown for games whose profile defines controls (see games/*.json "controls").
  available: (t) => (t.profile?.controls.length ?? 0) > 0,
  dock: 4,
  screen: ControlsScreen,
} satisfies AppModule;
