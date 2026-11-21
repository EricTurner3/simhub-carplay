import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { NavRoute } from '@simhub-carplay/shared';
import type { TelemetryStore } from '../store.ts';
import type { NavSample, ToMain, ToWorker } from './types.ts';

const SAMPLE_MS = 200;
const MAPS: Record<string, 'usa' | 'europe'> = { ats: 'usa', ets2: 'europe' };

/**
 * Turn-by-turn navigation for ATS/ETS2. Runs truckermudgeon/maps routing in a
 * worker (./worker.ts) for the active truck game, when its routing data has been
 * generated (npm run maps:build). Feeds it position + job destination from the
 * store, and publishes the route (onRoute) and progress (nav.* channels).
 */
export class Navigation {
  private worker: Worker | null = null;
  private map: 'usa' | 'europe' | null = null;
  private ready = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private mapsDir: string,
    private store: Pick<TelemetryStore, 'get' | 'set'>,
    private onRoute: (route: NavRoute | null) => void,
  ) {}

  /** Can this profile navigate (truck game with routing data)? */
  supports(profileId: string): boolean {
    const map = MAPS[profileId];
    return !!map && existsSync(join(this.mapsDir, map, `${map}-graph.json`));
  }

  /** The active game profile changed. */
  setProfile(profileId: string): void {
    const map = this.supports(profileId) ? MAPS[profileId] : null;
    if (map === this.map) return;
    this.stop();
    this.map = map;
    if (!map) return;

    console.log(`[nav] loading ${map} routing data...`);
    // Inherits tsx's loader through execArgv.
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { workerData: { mapsDir: this.mapsDir, map } });
    this.worker = worker;
    worker.on('message', (msg: ToMain) => this.onMessage(msg));
    worker.on('error', (err) => console.error('[nav] worker failed:', err));
    worker.on('exit', (code) => {
      if (this.worker !== worker) return;
      console.warn(`[nav] worker exited (${code})`);
      this.worker = null;
      this.ready = false;
      this.clear();
    });
    this.timer = setInterval(() => this.sample(), SAMPLE_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const w = this.worker;
    this.worker = null;
    this.ready = false;
    this.map = null;
    void w?.terminate();
    this.clear();
  }

  private clear() {
    this.store.set('nav.stepIndex', null);
    this.store.set('nav.maneuverDistM', null);
    this.onRoute(null);
  }

  private onMessage(msg: ToMain) {
    switch (msg.t) {
      case 'ready':
        this.ready = true;
        break;
      case 'log':
        console.log(`[nav] ${msg.text}`);
        break;
      case 'route':
        if (!msg.route) this.clear();
        else this.onRoute(msg.route);
        break;
      case 'progress':
        this.store.set('nav.stepIndex', msg.stepIndex);
        this.store.set('nav.maneuverDistM', Math.round(msg.maneuverDistM));
        break;
    }
  }

  private sample() {
    if (!this.worker || !this.ready) return;
    const n = (ch: string) => {
      const v = this.store.get(ch);
      return typeof v === 'number' ? v : null;
    };
    const x = n('pos.x');
    const z = n('pos.z');
    if (x === null || z === null) return;
    const company = this.store.get('job.destinationCompanyId');
    const city = this.store.get('job.destinationCityId');
    const sample: NavSample = {
      x,
      y: n('pos.y') ?? 0,
      z,
      heading: n('pos.heading') ?? 0,
      speedKmh: n('speedKmh') ?? 0,
      paused: this.store.get('gamePaused') === true,
      destKey: company && city ? `${company}.${city}` : null,
    };
    this.worker.postMessage({ t: 'sample', sample } satisfies ToWorker);
  }
}
