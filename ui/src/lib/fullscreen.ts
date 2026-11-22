/**
 * Fullscreen on phones and tablets that open the UI in a normal browser tab (or a home-screen
 * shortcut Android didn't install as an app, e.g. over plain http). Browsers only allow
 * fullscreen from a user gesture, so it is requested on each touch until it sticks, and again
 * after the user leaves it (back gesture, app switch). Desktop and installed apps are left alone.
 */
export function autoFullscreen() {
  const installed = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  const touch = matchMedia('(pointer: coarse)').matches;
  const root = document.documentElement;
  if (installed || !touch || !root.requestFullscreen) return;

  addEventListener(
    'pointerup',
    () => {
      if (document.fullscreenElement) return;
      root
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => (screen.orientation as ScreenOrientation & { lock?(o: string): Promise<void> }).lock?.('landscape'))
        .catch(() => {});
    },
    { passive: true },
  );
}
