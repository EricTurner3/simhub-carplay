import type { AppModule } from '../types.ts';
import SettingsScreen from './SettingsScreen.svelte';

export default {
  id: 'settings',
  name: 'Settings',
  colors: ['#9aa0a8', '#5b616b'],
  glyph: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  order: 100,
  screen: SettingsScreen,
} satisfies AppModule;
