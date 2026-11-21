import type { AppModule } from '../types.ts';
import NowPlayingCard from './NowPlayingCard.svelte';
import NowPlayingScreen from './NowPlayingScreen.svelte';

export default {
  id: 'nowplaying',
  name: 'Now Playing',
  colors: ['#ff5f6d', '#d61f45'],
  glyph: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  order: 20,
  dock: 2,
  screen: NowPlayingScreen,
  // Lowest priority: the default occupant of the split view's lower card.
  card: { component: NowPlayingCard, priority: 0 },
} satisfies AppModule;
