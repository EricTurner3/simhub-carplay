import polyline from '@mapbox/polyline';
import { fromWgs84ToAtsCoords, fromWgs84ToEts2Coords } from '@truckermudgeon/map/projections';
import type { AppConfig, NavRoute } from '@simhub-carplay/shared';
import type { SourceSink, TelemetrySource } from './source.ts';

/**
 * Synthetic telemetry: a vehicle lapping a fictional 4.2 km circuit, then pulling
 * over and idling, on a loop, so both the driving and parked branches of the UI's
 * view state machine get exercised.
 *
 * It reports `game` = config mock.game and emits every channel any profile might
 * use (racing and truck). The bridge keeps only the active profile's channels,
 * exactly as with real data, so `--game ATS` gives job/truck data and no laps.
 *
 * As a truck game it also has a world position: it starts at a Sacramento depot
 * with a job to Reno, and drives along whatever route the bridge's navigation
 * computes (followRoute), so the map and turn-by-turn work without the game.
 */

const TRACK_M = 4200;
/** Corners as (distance from start/finish in metres, apex speed in km/h). */
const CORNERS: [number, number][] = [
  [420, 85],
  [900, 140],
  [1350, 70],
  [2100, 175],
  [2600, 95],
  [3150, 120],
  [3700, 60],
];
const V_MAX = 255 / 3.6; // m/s
const BRAKE = 13; // m/s², braking decel
const REDLINE = 7500;
const IDLE = 850;
/** Speed (km/h) at redline in each gear for a 6-speed box. */
const GEAR_TOP_KMH = [72, 112, 152, 192, 228, 262];
const TANK_L = 110;
/** Truck job deadline: Thu 22:30 in game minutes. */
const JOB_DEADLINE = 3 * 1440 + 22 * 60 + 30;
const TRUCK_MAX = 100 / 3.6; // m/s
/** Truck start (ATS, Sacramento) and job destination, as company + city tokens. */
const TRUCK_START = { x: -109998.5, z: -13185.3 };
const TRUCK_DEST = { company: 'ed_mkt', city: 'reno' };

type Phase = 'driving' | 'stopping' | 'parked';

export class MockSource implements TelemetrySource {
  readonly name = 'mock';
  private timer: NodeJS.Timeout | undefined;

  private dist = 0; // m around the lap
  private v = 0; // m/s
  private gear = 0; // 0 = N, 1..6
  private lap = 1;
  private delta = 0;
  private phase: Phase = 'parked';
  private phaseT = 0;
  private t = 0; // s since start
  private fuel = 62; // litres
  private routeLeftM = 412_000; // truck job: metres to destination
  private gameMinutes = 3 * 1440 + 8 * 60 + 15; // Thu 08:15
  // Vehicle controls operated from the UI (see control()).
  private lightStep = 2; // 0 off, 1 parking, 2 low beam
  private toggles: Record<string, boolean> = { electric: true, engine: true, liftAxle: true };
  // Truck world position, following the navigation route when there is one.
  private readonly truck: boolean;
  private readonly ats: boolean; // the start point and job are in ATS
  private pos = { ...TRUCK_START, heading: 0 };
  private path: { x: number; z: number; s: number }[] = [];
  private pathS = 0;

  constructor(private cfg: AppConfig['mock']) {
    this.phaseT = 2; // start rolling soon after launch
    this.truck = /^(ATS|ETS2|EuroTruckSimulator2)$/.test(cfg.game);
    this.ats = cfg.game === 'ATS';
  }

  /** Drive along this route from its start (a reroute starts where the truck is). */
  followRoute(route: NavRoute | null): void {
    this.path = [];
    this.pathS = 0;
    if (!route) return;
    const toGame = route.map === 'usa' ? fromWgs84ToAtsCoords : fromWgs84ToEts2Coords;
    let s = 0;
    for (const step of route.steps) {
      for (const lonLat of polyline.decode(step.geometry)) {
        const [x, z] = toGame(lonLat as [number, number]);
        const prev = this.path.at(-1);
        if (prev) s += Math.hypot(x - prev.x, z - prev.z);
        if (!prev || s > prev.s) this.path.push({ x, z, s });
      }
    }
  }

  private moveAlongPath(d: number): void {
    const path = this.path;
    if (path.length < 2) return;
    this.pathS += d;
    if (this.pathS >= path[path.length - 1].s) {
      // Arrived: back to the start; navigation reroutes from there.
      this.path = [];
      this.pos = { ...TRUCK_START, heading: 0 };
      return;
    }
    let i = 1;
    while (path[i].s < this.pathS) i++;
    const a = path[i - 1];
    const b = path[i];
    const k = (this.pathS - a.s) / (b.s - a.s);
    // SCS heading: 0..1 counter-clockwise from north (-z).
    const bearing = Math.atan2(b.x - a.x, -(b.z - a.z));
    this.pos = { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, heading: (((-bearing / (2 * Math.PI)) % 1) + 1) % 1 };
  }

  start(sink: SourceSink): void {
    sink.status('connected', `mock ${this.cfg.game}`);
    const dt = 1 / this.cfg.updateHz;
    this.timer = setInterval(() => {
      this.step(dt);
      this.emit(sink);
    }, 1000 / this.cfg.updateHz);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  setProperties(): void {
    /* the mock emits channels directly */
  }

  /** Pretend the game reacted: flip the matching state a moment after the key goes down. */
  control(id: string, _input: string, down: boolean): boolean {
    if (!down) return true;
    setTimeout(() => {
      if (id === 'lights') this.lightStep = (this.lightStep + 1) % 3;
      else this.toggles[id] = !this.toggles[id];
    }, 150);
    return true;
  }

  private step(dt: number): void {
    this.t += dt;
    this.phaseT -= dt;
    if (this.phaseT <= 0) {
      if (this.phase === 'driving') this.phase = 'stopping';
      else if (this.phase === 'parked') {
        this.phase = 'driving';
        this.phaseT = this.cfg.driveSeconds;
      }
    }

    const allowed = this.phase === 'driving' ? Math.min(this.allowedSpeed(this.dist), this.truck ? TRUCK_MAX : V_MAX) : 0;
    if (this.v < allowed) {
      const accel = 9.5 * (1 - this.v / V_MAX) + 0.5;
      this.v = Math.min(allowed, this.v + accel * dt);
    } else {
      this.v = Math.max(allowed, this.v - BRAKE * dt);
    }

    if (this.phase === 'stopping' && this.v === 0) {
      this.phase = 'parked';
      this.phaseT = this.cfg.parkedSeconds;
    }

    this.dist += this.v * dt;
    if (this.dist >= TRACK_M) {
      this.dist -= TRACK_M;
      this.lap++;
      this.delta = 0;
    }
    // Wander the delta a little: gain in fast corners, lose in slow ones.
    this.delta += (Math.random() - 0.5) * 0.02 + (this.v > 40 ? -0.0004 : 0.0006);
    this.delta = Math.max(-2, Math.min(2, this.delta));

    this.routeLeftM = Math.max(0, this.routeLeftM - this.v * dt);
    if (this.ats) this.moveAlongPath(this.v * dt);
    this.fuel = Math.max(0, this.fuel - (0.0002 * this.v + 0.002) * dt);
    this.gameMinutes += (dt * 19) / 60; // SCS default time scale

    this.gear = this.pickGear();
  }

  /** Highest speed from which we can still brake for every corner ahead. */
  private allowedSpeed(at: number): number {
    let vAllowed = V_MAX;
    for (const [pos, apexKmh] of CORNERS) {
      let d = pos - at;
      if (d < -30) d += TRACK_M; // corner behind us -> next lap (keep apex speed briefly after)
      const vc = apexKmh / 3.6;
      vAllowed = Math.min(vAllowed, Math.sqrt(vc * vc + 2 * BRAKE * Math.max(0, d)));
    }
    return vAllowed;
  }

  private pickGear(): number {
    const kmh = this.v * 3.6;
    if (this.phase === 'parked' || kmh < 1) return this.phase === 'driving' ? 1 : 0;
    const cur = Math.max(1, this.gear);
    // Upshift near the limiter, downshift when the lower gear has plenty of room.
    if (cur < 6 && this.rpmFor(cur, kmh) > 7150) return cur + 1;
    if (cur > 1 && this.rpmFor(cur - 1, kmh) < 6300) return cur - 1;
    return cur;
  }

  private rpmFor(gear: number, kmh: number): number {
    return (REDLINE * kmh) / GEAR_TOP_KMH[gear - 1];
  }

  private emit(sink: SourceSink): void {
    const set = (ch: string, v: string | number | boolean) => sink.set(ch, v);
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const wave = (period: number, phase = 0) => Math.sin((this.t / period + phase) * Math.PI * 2);

    // Game first: it decides which channels the bridge keeps.
    set('game', this.cfg.game);
    set('gameRunning', true);
    set('gamePaused', false);

    const kmh = this.v * 3.6;
    const load = kmh / 250;
    const jitter = (Math.random() - 0.5) * 30;
    const rpm = this.gear === 0 ? IDLE + jitter : Math.max(IDLE, Math.min(REDLINE, this.rpmFor(this.gear, kmh))) + jitter;

    set('speedKmh', r1(kmh));
    set('rpm', Math.round(rpm));
    set('maxRpm', REDLINE);
    set('gear', this.gear === 0 ? 'N' : String(this.gear));

    // Racing
    set('trackPct', this.dist / TRACK_M);
    set('lap', this.lap);
    set('totalLaps', 20);
    set('position', 4);
    set('opponents', 18);
    set('deltaSec', Math.round(this.delta * 100) / 100);
    set('lastLap', 98.432);
    set('bestLap', 97.981);
    set('flag', this.phase === 'driving' ? 'Green' : 'Yellow');
    set('inPit', this.phase === 'parked' ? 1 : 0);
    set('brakeBias', 56.5);
    set('tcLevel', 3);
    set('absLevel', 2);
    set('engineMap', 1);

    // Fuel
    set('fuel', r1(this.fuel));
    set('maxFuel', TANK_L);
    set('fuelPct', r1((this.fuel / TANK_L) * 100));
    set('fuelUnit', 'Liters');
    set('fuelLapsLeft', r1(this.fuel / 2.6));
    set('fuelPerLap', 2.6);

    // Tyres: fronts run hotter, everything breathes with load
    const corners: [string, number][] = [['FL', 88], ['FR', 91], ['RL', 82], ['RR', 84]];
    for (const [pos, base] of corners) {
      set(`tyreTemp${pos}`, r1(base + load * 12 + wave(9, base / 100) * 3));
      set(`tyrePres${pos}`, Math.round((26.4 + load * 1.2 + wave(13, base / 50) * 0.2) * 100) / 100);
      set(`tyreWear${pos}`, r1(92 - this.lap * 1.3 - (base - 80) * 0.2));
    }
    set('tyrePressureUnit', 'Psi');

    // Engine / environment
    set('temperatureUnit', 'Celsius');
    set('oilTemp', r1(96 + load * 14 + wave(30) * 2));
    set('waterTemp', r1(84 + load * 8));
    set('oilPressure', Math.round((2.2 + (rpm / REDLINE) * 3) * 100) / 100);
    set('oilPressureUnit', 'Bar');
    set('airTemp', 21);
    set('roadTemp', 29);

    // Media (SimHub MediaInfo)
    set('media.title', 'Night Drive (Mock)');
    set('media.artist', 'The Placeholder Band');

    // Truck job / navigation / world (SCS games)
    set('job.onJob', true);
    set('job.special', false);
    set('job.cargo', 'Lumber');
    set('job.cargoMassKg', 18_400);
    set('job.cargoDamage', 0.012);
    set('job.cargoLoaded', true);
    set('job.sourceCity', 'Sacramento');
    set('job.sourceCompany', 'Pinecrest Timber');
    set('job.destinationCity', 'Reno');
    set('job.destinationCompany', 'High Desert Builders');
    set('job.income', 14_250);
    set('job.plannedDistanceKm', 412);
    set('job.deadlineMinutes', JOB_DEADLINE);
    set('job.remainingMinutes', Math.round(JOB_DEADLINE - this.gameMinutes));
    if (this.ats) {
      set('job.destinationCompanyId', TRUCK_DEST.company);
      set('job.destinationCityId', TRUCK_DEST.city);
      set('pos.x', Math.round(this.pos.x * 100) / 100);
      set('pos.y', 10);
      set('pos.z', Math.round(this.pos.z * 100) / 100);
      set('pos.heading', Math.round(this.pos.heading * 10000) / 10000);
    }
    set('nav.distanceM', Math.round(this.routeLeftM));
    set('nav.timeSec', Math.round(this.routeLeftM / 24));
    set('nav.speedLimitKph', kmh > 100 ? 105 : 89);
    set('world.gameMinutes', Math.floor(this.gameMinutes));
    set('world.restStopMinutes', 412);
    set('world.timeScale', 19);

    set('truck.brand', 'Mockworth');
    set('truck.model', 'Long Hauler (Mock)');
    set('truck.fuelRangeKm', Math.round(this.fuel * 2.9));
    set('truck.fuelAvgConsumption', 0.34);
    set('truck.fuelWarning', this.fuel < 15);
    set('truck.adBlue', 58);
    set('truck.adBlueCapacity', 80);
    set('truck.airPressure', r1(118 + wave(17) * 6));
    set('truck.airPressureWarning', false);
    set('truck.brakeTemp', r1(45 + load * 60));
    set('truck.parkingBrake', this.phase === 'parked' || !!this.toggles.parkingBrake);
    set('truck.retarder', this.phase === 'stopping' && this.v > 0 ? 2 : 0);
    set('truck.retarderSteps', 3);
    set('truck.diffLock', !!this.toggles.diffLock);
    set('truck.liftAxle', !!this.toggles.liftAxle);
    set('truck.cruise', !!this.toggles.cruise);
    set('truck.lightsParking', this.lightStep >= 1);
    set('truck.lightsLow', this.lightStep === 2);
    for (const [id, ch] of [
      ['highBeam', 'truck.lightsHigh'],
      ['hazards', 'truck.hazards'],
      ['beacon', 'truck.beacon'],
      ['blinkerLeft', 'truck.blinkerLeft'],
      ['blinkerRight', 'truck.blinkerRight'],
      ['engine', 'truck.engineOn'],
      ['electric', 'truck.electricOn'],
      ['wipers', 'truck.wipers'],
    ]) {
      set(ch, !!this.toggles[id]);
    }
    set('truck.cruiseKph', 96);
    set('truck.batteryVoltage', 13.8);
    set('truck.damageCabin', 0.02);
    set('truck.damageChassis', 0.04);
    set('truck.damageEngine', 0.01);
    set('truck.damageTransmission', 0.03);
    set('truck.damageWheels', 0.06);
    set('truck.trailerAttached', true);
  }
}
