import { INPUT_ACTIONS, type InputAction, type UiConfig } from '@simhub-carplay/shared';

export type InputSource = 'key' | 'pad' | 'remote';
export type Action = InputAction | 'debug';

const REPEATABLE = new Set<string>(['up', 'down', 'left', 'right']);

/**
 * Chromium exposes a DirectInput POV hat as one axis: -1 = up, then clockwise in
 * steps of 2/7 to +1 = up-left; anything outside [-1, 1] means centred.
 * Diagonals are ignored so a sloppy press never moves focus twice.
 */
const HAT_DIRS: (InputAction | null)[] = ['up', null, 'right', null, 'down', null, 'left', null];
function hatDirection(v: number): InputAction | null {
  if (v < -1.05 || v > 1.05) return null;
  return HAT_DIRS[Math.round((v + 1) / (2 / 7))] ?? null;
}

export interface PadDebug {
  index: number;
  id: string;
  mapping: string;
  used: boolean;
  pressed: number[];
  axes: number[];
}

/** Keyboard + Gamepad API -> actions. Call poll() from the frame loop. */
export class InputManager {
  private held = new Map<InputAction, { since: number; lastFire: number }>();
  private keymap = new Map<string, Action>();

  constructor(
    private cfg: UiConfig['input'],
    private dispatch: (a: Action, src: InputSource) => void,
  ) {
    for (const [action, keys] of Object.entries(cfg.keyboard) as [Action, string[] | undefined][]) {
      for (const k of keys ?? []) this.keymap.set(normKey(k), action);
    }
    window.addEventListener('keydown', (e) => {
      const action = this.keymap.get(normKey(e.key));
      if (!action) return;
      e.preventDefault();
      // OS key repeat is fine for directions, not for ok/back/toggle.
      if (e.repeat && !REPEATABLE.has(action)) return;
      this.dispatch(action, 'key');
    });
  }

  private matches(pad: Gamepad): boolean {
    const want = this.cfg.gamepad.idContains.trim().toLowerCase();
    return !want || pad.id.toLowerCase().includes(want);
  }

  poll(now: number): void {
    const g = this.cfg.gamepad;
    const pressed = new Set<InputAction>();
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad || !this.matches(pad)) continue;
      for (const action of INPUT_ACTIONS) {
        for (const idx of g.buttons[action] ?? []) {
          if (pad.buttons[idx]?.pressed) pressed.add(action);
        }
      }
      if (g.hatAxis !== null && pad.axes[g.hatAxis] !== undefined) {
        const dir = hatDirection(pad.axes[g.hatAxis]);
        if (dir) pressed.add(dir);
      }
    }

    for (const action of pressed) {
      const h = this.held.get(action);
      if (!h) {
        this.held.set(action, { since: now, lastFire: now });
        this.dispatch(action, 'pad');
      } else if (REPEATABLE.has(action) && now - h.since >= g.repeatDelayMs && now - h.lastFire >= g.repeatRateMs) {
        h.lastFire = now;
        this.dispatch(action, 'pad');
      }
    }
    for (const action of this.held.keys()) if (!pressed.has(action)) this.held.delete(action);
  }

  debugInfo(): PadDebug[] {
    const out: PadDebug[] = [];
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad) continue;
      out.push({
        index: pad.index,
        id: pad.id,
        mapping: pad.mapping || 'non-standard',
        used: this.matches(pad),
        pressed: pad.buttons.flatMap((b, i) => (b.pressed ? [i] : [])),
        axes: pad.axes.map((a) => Math.round(a * 100) / 100),
      });
    }
    return out;
  }
}

function normKey(k: string): string {
  return k.length === 1 ? k.toLowerCase() : k;
}
