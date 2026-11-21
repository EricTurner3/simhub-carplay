/**
 * Knob-style spatial navigation. Any element with a `data-nav` attribute is a
 * focus target; direction actions move to the nearest visible target in that
 * direction.
 *
 * The current target also gets a `nav-focus` class, which is what the focus
 * ring is drawn from: in the rig the browser window usually does NOT have OS
 * focus (the game does), and Chromium won't match `:focus` then.
 */
export type Dir = 'up' | 'down' | 'left' | 'right';

let marked: HTMLElement | null = null;

/** Make `el` the knob target. */
export function focusEl(el: HTMLElement): void {
  el.focus({ preventScroll: true });
  if (marked !== el) {
    marked?.classList.remove('nav-focus');
    el.classList.add('nav-focus');
    marked = el;
  }
}

/** The current knob target, if it is still in the document. */
export function current(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null;
  if (active?.hasAttribute('data-nav')) return active;
  return marked?.isConnected ? marked : null;
}

function targets(root: HTMLElement): HTMLElement[] {
  const bounds = root.getBoundingClientRect();
  return [...root.querySelectorAll<HTMLElement>('[data-nav]')].filter((el) => {
    if (el.closest('[inert]')) return false; // e.g. a view that is animating out
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return cx >= bounds.left && cx <= bounds.right && cy >= bounds.top && cy <= bounds.bottom;
  });
}

/**
 * Focus the preferred target if focus isn't already on a visible one:
 * a `data-nav-default` element, else the first target inside a `data-nav-main`
 * region (the view, not the dock), else the first target.
 */
export function ensureFocus(root: HTMLElement): void {
  const items = targets(root);
  const cur = current();
  if (cur && items.includes(cur)) return focusEl(cur);
  const preferred =
    items.find((el) => el.hasAttribute('data-nav-default')) ??
    items.find((el) => el.closest('[data-nav-main]')) ??
    items[0];
  if (preferred) focusEl(preferred);
}

/** Move focus. Returns false if there was nothing in that direction (an "edge"). */
export function moveFocus(root: HTMLElement, dir: Dir): boolean {
  const items = targets(root);
  const from = current();
  if (!from || !items.includes(from)) {
    ensureFocus(root);
    return true;
  }

  const c = from.getBoundingClientRect();
  const cx = c.left + c.width / 2;
  const cy = c.top + c.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of items) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - cx;
    const dy = r.top + r.height / 2 - cy;
    const primary = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const cross = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    // Only consider targets within ~65° of the pressed direction.
    if (primary <= 1 || cross > primary * 2.2) continue;
    const score = primary + cross * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (best) focusEl(best);
  return best !== null;
}
