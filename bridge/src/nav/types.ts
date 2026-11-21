import type { NavRoute } from '@simhub-carplay/shared';

/** What the navigation worker needs from telemetry, a few times a second. */
export interface NavSample {
  /** World position, metres. */
  x: number;
  y: number;
  z: number;
  /** 0..1, counter-clockwise from north. */
  heading: number;
  speedKmh: number;
  paused: boolean;
  /** `${companyId}.${cityId}` of the job destination, or null without a job. */
  destKey: string | null;
}

export type ToWorker = { t: 'sample'; sample: NavSample };

export type ToMain =
  | { t: 'ready' }
  | { t: 'log'; text: string }
  | { t: 'route'; route: NavRoute | null }
  | { t: 'progress'; stepIndex: number; maneuverDistM: number };
