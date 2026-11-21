import type { AppModule } from '../types.ts';
import { isOn } from '../../lib/format.ts';
import JobCard from './JobCard.svelte';
import JobScreen from './JobScreen.svelte';

export default {
  id: 'job',
  name: 'Job',
  colors: ['#d09a5c', '#8f5b28'],
  glyph: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9M7.75 5.25l8.5 4.5"/>',
  order: 25,
  requires: ['job.destinationCity'],
  dock: 3,
  screen: JobScreen,
  // Takes over the split view's lower card while a delivery is in progress.
  card: { component: JobCard, priority: 10, when: (t) => isOn(t.slow['job.onJob']) },
} satisfies AppModule;
