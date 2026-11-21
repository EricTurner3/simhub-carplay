import type { UiConfig } from '@simhub-carplay/shared';
import type { Telemetry } from './telemetry.svelte.ts';
import { isOn } from './format.ts';

export type View = { kind: 'split' } | { kind: 'grid' } | { kind: 'app'; id: string };
export type DriveState = 'driving' | 'parked';

/**
 * Central view state machine.
 *
 * Auto mode derives a DriveState from telemetry:
 *   parked  <- not connected, game not running, game paused,
 *              or speed below threshold for `parkedAfterMs`
 *   driving <- speed at/above threshold while running and unpaused
 *
 * On a DriveState *transition* it moves between the two home screens
 * (driving -> split view, parked -> app grid). An open app is left alone.
 * Manual navigation (toggle, opening apps) holds until the next transition,
 * so the user can look at the grid while driving without it snapping back.
 */
export class ViewState {
  view = $state<View>({ kind: 'grid' });
  drive = $state<DriveState>('parked');
  /** True when the current view was chosen manually since the last transition. */
  manual = $state(false);
  reason = $state('starting');

  private belowSince: number | null = null;

  constructor(private cfg: UiConfig['autoSwitch']) {}

  /** Call every frame (cheap: only writes state on change). */
  update(now: number, t: Telemetry): void {
    const speed = t.sample('speedKmh', now);
    // SimHub reports these as booleans via dcp.* but as 0/1 through generic access.
    const running = t.get('gameRunning');
    const paused = isOn(t.get('gamePaused'));

    let next: DriveState;
    let reason: string;
    if (t.conn.upstream !== 'connected') [next, reason] = ['parked', 'no telemetry'];
    else if (running !== null && !isOn(running)) [next, reason] = ['parked', 'game not running'];
    else if (paused) [next, reason] = ['parked', 'game paused'];
    else if (speed === null) [next, reason] = ['parked', 'no speed'];
    else if (speed >= this.cfg.parkedBelowKmh) {
      this.belowSince = null;
      [next, reason] = ['driving', 'moving'];
    } else {
      this.belowSince ??= now;
      const stoppedLongEnough = now - this.belowSince >= this.cfg.parkedAfterMs;
      [next, reason] = stoppedLongEnough ? ['parked', 'stopped'] : [this.drive, 'slowing'];
    }

    if (reason !== this.reason) this.reason = reason;
    if (next === this.drive) return;

    this.drive = next;
    this.manual = false;
    if (!this.cfg.enabled) return;
    if (next === 'driving' && this.view.kind === 'grid') this.view = { kind: 'split' };
    if (next === 'parked' && this.view.kind === 'split') this.view = { kind: 'grid' };
  }

  toggle(): void {
    this.go(this.view.kind === 'split' ? { kind: 'grid' } : { kind: 'split' });
  }

  home(): void {
    this.go({ kind: 'grid' });
  }

  open(id: string): void {
    this.go(id === 'dashboard' ? { kind: 'split' } : { kind: 'app', id });
  }

  back(): void {
    if (this.view.kind === 'app') this.go({ kind: 'grid' });
    else if (this.view.kind === 'grid') this.go({ kind: 'split' });
  }

  private go(v: View): void {
    this.view = v;
    this.manual = true;
  }
}
