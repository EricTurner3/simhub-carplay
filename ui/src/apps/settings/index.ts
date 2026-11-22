import type { AppModule } from '../types.ts';
import SettingsScreen from './SettingsScreen.svelte';

export default {
  id: 'settings',
  name: 'Settings',
  colors: ['#c8c8cb', '#828387'],
  // Filled black gear (18 teeth, ring + three spokes) on a light tile, like CarPlay.
  glyph:
    '<g fill="#111" stroke="none"><path fill-rule="evenodd" d="M10.98 3.06L11.26 0.82L12.74 0.82L13.02 3.06L14.1 3.25L15.12 1.24L16.52 1.75L16.02 3.95L16.97 4.5L18.61 2.96L19.75 3.92L18.53 5.8L19.23 6.65L21.31 5.77L22.05 7.06L20.25 8.41L20.63 9.44L22.88 9.33L23.13 10.79L20.98 11.45L20.98 12.55L23.13 13.21L22.88 14.67L20.63 14.56L20.25 15.59L22.05 16.94L21.31 18.23L19.23 17.35L18.53 18.2L19.75 20.08L18.61 21.04L16.97 19.5L16.02 20.05L16.52 22.25L15.12 22.76L14.1 20.75L13.02 20.94L12.74 23.18L11.26 23.18L10.98 20.94L9.9 20.75L8.88 22.76L7.48 22.25L7.98 20.05L7.03 19.5L5.39 21.04L4.25 20.08L5.47 18.2L4.77 17.35L2.69 18.23L1.95 16.94L3.75 15.59L3.37 14.56L1.12 14.67L0.87 13.21L3.02 12.55L3.02 11.45L0.87 10.79L1.12 9.33L3.37 9.44L3.75 8.41L1.95 7.06L2.69 5.77L4.77 6.65L5.47 5.8L4.25 3.92L5.39 2.96L7.03 4.5L7.98 3.95L7.48 1.75L8.88 1.24L9.9 3.25ZM5.4 12a6.6 6.6 0 1 0 13.2 0a6.6 6.6 0 1 0-13.2 0Z"/></g>' +
    '<path stroke="#111" stroke-width="2.3" stroke-linecap="butt" d="M12 12H6M12 12l3.1-5.4M12 12l3.1 5.4"/>',
  order: 100,
  screen: SettingsScreen,
} satisfies AppModule;
