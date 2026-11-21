import type { AppConfig, ControlDef, ControlMsg } from '@simhub-carplay/shared';
import type { TelemetrySource } from './sources/source.ts';

const MAX_TAPS = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Turns control requests from clients into SimHub input presses.
 *
 * Only ids in the active game profile are accepted, and the SimHub input name is
 * derived here (never taken from the client), so a client on the network can
 * trigger exactly the inputs you've chosen to map and nothing else.
 * Requests for the same control are queued so taps never interleave.
 */
export class ControlRunner {
  private queues = new Map<string, Promise<void>>();
  private held = new Set<string>();

  constructor(
    private cfg: AppConfig['controls'],
    private source: TelemetrySource,
    private controls: () => Record<string, ControlDef>,
  ) {}

  /** Returns an error string, or null if accepted. */
  handle(msg: Pick<ControlMsg, 'id' | 'action' | 'count'>): string | null {
    const def = this.controls()[msg.id];
    if (!def) return `unknown control "${msg.id}" for this game`;
    const input = def.input ?? `${this.cfg.inputPrefix}${msg.id}`;

    if (msg.action === 'press' || msg.action === 'release') {
      if (def.kind !== 'momentary') return `"${msg.id}" is not a momentary control`;
      const down = msg.action === 'press';
      if (down === this.held.has(msg.id)) return null; // already in that state
      if (down) this.held.add(msg.id);
      else this.held.delete(msg.id);
      return this.source.control(msg.id, input, down) ? null : 'SimHub not connected';
    }

    if (msg.action !== 'tap') return `unknown action "${String(msg.action)}"`;
    const count = Math.max(1, Math.min(MAX_TAPS, Math.floor(msg.count ?? 1)));
    const prev = this.queues.get(msg.id) ?? Promise.resolve();
    const next = prev.then(async () => {
      for (let i = 0; i < count; i++) {
        if (i > 0) await sleep(this.cfg.gapMs);
        if (!this.source.control(msg.id, input, true)) return;
        await sleep(this.cfg.tapMs);
        this.source.control(msg.id, input, false);
      }
    });
    this.queues.set(msg.id, next);
    void next.finally(() => {
      if (this.queues.get(msg.id) === next) this.queues.delete(msg.id);
    });
    return null;
  }

  /** Let go of anything held (client disconnected, game changed). */
  releaseAll(): void {
    for (const id of this.held) {
      const def = this.controls()[id];
      this.source.control(id, def?.input ?? `${this.cfg.inputPrefix}${id}`, false);
    }
    this.held.clear();
  }
}
