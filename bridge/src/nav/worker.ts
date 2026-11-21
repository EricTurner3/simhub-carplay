/**
 * Navigation worker (worker_threads): owns the ATS/ETS2 routing data and the
 * truckermudgeon/maps routing + guidance code, so loading ~400 MB of JSON and
 * route searches never stall the telemetry loop. Protocol: see ./types.ts.
 */
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import polyline from '@mapbox/polyline';
import { fromDir } from '@truckermudgeon/io';
import { AtsSelectableDlcs, Ets2SelectableDlcs, toAtsDlcGuards, toEts2DlcGuards } from '@truckermudgeon/map/constants';
import { findRouteFromKey, type Context } from '@truckermudgeon/map/routing';
import { gameToLonLat, type NavRoute, type NavStep, type TurnKind } from '@simhub-carplay/shared';
import { readGraphAndMapData } from '../../../vendor/maps/packages/apis/navigation/infra/lookups/graph-and-map.ts';
import { generateRoutes, type RoutingService } from '../../../vendor/maps/packages/apis/navigation/domain/actor/generate-routes.ts';
import { detectRouteEvents } from '../../../vendor/maps/packages/apis/navigation/domain/actor/detect-route-events.ts';
import type { DomainEventSink } from '../../../vendor/maps/packages/apis/navigation/domain/events.ts';
import type { TelemetryEventEmitter } from '../../../vendor/maps/packages/apis/navigation/domain/session-actor.ts';
import type { Route, RouteIndex, TruckSimTelemetry } from '../../../vendor/maps/packages/apis/navigation/types.ts';
import type { NavSample, ToMain, ToWorker } from './types.ts';

// Upstream logs every telemetry tick; keep warnings and errors only.
const verbose = process.env.CARPLAY_NAV_DEBUG === '1';
if (!verbose) console.log = () => {};

const port = parentPort!;
const { mapsDir, map } = workerData as { mapsDir: string; map: 'usa' | 'europe' };
const post = (msg: ToMain) => port.postMessage(msg);
const log = (text: string) => post({ t: 'log', text });

const t0 = Date.now();
const data = readGraphAndMapData(fromDir(join(mapsDir, map)), map);
const routeContext: Context = {
  nodeLUT: data.tsMapData.nodes,
  graph: data.graphData.graph,
  enabledDlcGuards: map === 'usa' ? toAtsDlcGuards(AtsSelectableDlcs) : toEts2DlcGuards(Ets2SelectableDlcs),
  map,
};
const routing: RoutingService = { findRouteFromKey: async (key) => findRouteFromKey(key, routeContext) };
const events: DomainEventSink = {
  publish: (e) => {
    if (e.type === 'error' || e.type === 'assertionFailed') console.warn('[nav]', e);
    else if (verbose) console.warn('[nav]', e);
  },
};
const companiesByKey = new Map([...data.tsMapData.companies.values()].map((c) => [`${c.token}.${c.cityToken}`, c]));
log(`${map} routing data loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ---- route progress, via upstream's detector ---------------------------------

const telemetryEvents: TelemetryEventEmitter = new EventEmitter();
const detector = detectRouteEvents({
  telemetryEventEmitter: telemetryEvents,
  getGraphAndMapData: () => data,
  routing,
  domainEventSink: events,
});

let steps: NavStep[] = [];
let stepLines: [number, number][][] = [];
let segmentOffsets: number[] = [];
let current = 0; // index of the step being driven

detector.routeEventEmitter.on('update', (route) => {
  setRoute(route);
});
detector.routeEventEmitter.on('progress', (index: RouteIndex | undefined) => {
  current = index ? segmentOffsets[index.segmentIndex] + index.stepIndex : 0;
});
// We navigate one job at a time: nothing to confirm between segments.
detector.routeEventEmitter.on('segmentComplete', () => detector.unpauseRouteEvents());

function setRoute(route: Route | undefined) {
  current = 0;
  if (!route) {
    steps = [];
    stepLines = [];
    post({ t: 'route', route: null });
    return;
  }
  segmentOffsets = [];
  steps = [];
  for (const seg of route.segments) {
    segmentOffsets.push(steps.length);
    for (const s of seg.steps) steps.push(toNavStep(s));
  }
  stepLines = steps.map((s) => polyline.decode(s.geometry) as [number, number][]);
  const out: NavRoute = { id: route.id, map, steps, distanceM: route.distanceMeters, durationS: route.duration };
  post({ t: 'route', route: out });
}

function toNavStep(s: Route['segments'][number]['steps'][number]): NavStep {
  const m = s.maneuver;
  return {
    turn: m.direction as TurnKind,
    lonLat: m.lonLat,
    ...(m.banner?.text ? { text: m.banner.text } : {}),
    ...(m.banner?.icon ? { icon: m.banner.icon } : {}),
    ...('roundaboutExitNumber' in m && m.roundaboutExitNumber ? { roundaboutExit: m.roundaboutExitNumber } : {}),
    ...(m.laneHint
      ? {
          lanes: m.laneHint.lanes.map((l) => ({
            turns: l.branches as TurnKind[],
            ...(l.activeBranch !== undefined ? { active: l.activeBranch as TurnKind } : {}),
          })),
        }
      : {}),
    ...(m.thenHint ? { then: m.thenHint.direction as TurnKind } : {}),
    distanceM: s.distanceMeters,
    durationS: s.duration,
    geometry: s.geometry,
  };
}

/** Fraction (0..1) of the way along a lon/lat polyline at its point nearest to p. */
function fractionAlong(line: [number, number][], p: [number, number]): number {
  if (line.length < 2) return 0;
  const k = Math.cos((p[1] * Math.PI) / 180); // local equirectangular
  let total = 0;
  let best = Infinity;
  let bestAt = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = [line[i - 1][0] * k, line[i - 1][1]];
    const [bx, by] = [line[i][0] * k, line[i][1]];
    const [px, py] = [p[0] * k, p[1]];
    const len = Math.hypot(bx - ax, by - ay);
    const u = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (len * len))) : 0;
    const d = Math.hypot(ax + (bx - ax) * u - px, ay + (by - ay) * u - py);
    if (d < best) {
      best = d;
      bestAt = total + len * u;
    }
    total += len;
  }
  return total > 0 ? bestAt / total : 0;
}

function progress(s: NavSample) {
  if (!steps.length) return;
  const next = Math.min(current + 1, steps.length - 1);
  const frac = fractionAlong(stepLines[current], gameToLonLat(map, s.x, s.z));
  post({ t: 'progress', stepIndex: next, maneuverDistM: Math.max(0, steps[current].distanceM * (1 - frac)) });
}

// ---- job destination -> route ---------------------------------------------------

let destKey: string | null = null;
let routing_ = false;

async function onDestination(s: NavSample, key: string | null) {
  destKey = key;
  detector.setActiveRoute(undefined);
  if (!key) return;
  const company = companiesByKey.get(key);
  if (!company) {
    log(`destination ${key} not on the map (special transport or mod); no route`);
    return;
  }
  routing_ = true;
  try {
    const t = Date.now();
    const [route] = await generateRoutes(company.nodeUid, ['fastest'], {
      graphAndMapData: data,
      routing,
      truck: toTelemetry(s).truck,
      domainEventSink: events,
    });
    if (destKey !== key) return; // job changed meanwhile
    if (!route) {
      log(`no route found to ${key}`);
      return;
    }
    detector.setActiveRoute(route);
    log(`route to ${key}: ${(route.distanceMeters / 1000).toFixed(1)} km, ${route.segments.reduce((n, g) => n + g.steps.length, 0)} steps in ${Date.now() - t} ms`);
  } catch (err) {
    console.warn('[nav] routing failed:', err);
  } finally {
    routing_ = false;
  }
}

function toTelemetry(s: NavSample): TruckSimTelemetry {
  const v = s.speedKmh / 3.6;
  const zero = { X: 0, Y: 0, Z: 0 };
  const loc = { city: { id: '', name: '' }, company: { id: '', name: '' } };
  return {
    navigation: { speedLimit: { value: 0, kph: 0, mph: 0 } },
    truck: {
      speed: { value: v, kph: s.speedKmh, mph: s.speedKmh * 0.621371 },
      position: { X: s.x, Y: s.y, Z: s.z },
      orientation: { heading: s.heading },
      acceleration: { linearVelocity: zero, linearAcceleration: zero, angularVelocity: zero, angularAcceleration: zero },
    },
    trailer: { attached: false, position: zero, orientation: { heading: 0 } },
    job: { destination: loc, source: loc },
    game: {
      game: { name: map === 'usa' ? 'ats' : 'ets2' },
      paused: s.paused,
      timestamp: { value: Date.now() * 1000 },
      time: { value: 0 },
      scale: 1,
    },
  };
}

port.on('message', (msg: ToWorker) => {
  if (msg.t !== 'sample') return;
  const s = msg.sample;
  if (s.destKey !== destKey) {
    void onDestination(s, s.destKey);
    return;
  }
  if (routing_) return;
  telemetryEvents.emit('telemetry', toTelemetry(s));
  progress(s);
});
post({ t: 'ready' });
