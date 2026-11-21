import { Turn, type ChannelMap, type NavStep, type TurnKind } from '@simhub-carplay/shared';
import { num } from './format.ts';

/**
 * Truck-game navigation presentation shared by the split-view ManeuverCard and
 * the full-screen map: maneuver wording and ETA figures.
 */

export const isRoundabout = (t: TurnKind) => t >= Turn.RoundBR && t <= Turn.RoundExit;

export interface ManeuverText {
  /** Exit number from an "Exit 27A" banner. */
  exit: string | null;
  /** Main line: road name, or the instruction when there's no name. */
  primary: string;
  /** Instruction under a road name (null when the name says it all). */
  secondary: string | null;
}

export function maneuverText(step: NavStep, destination: string): ManeuverText {
  const exit = step.text?.match(/^Exit (.+)$/)?.[1] ?? null;
  const road = step.text && !exit ? step.text : null;
  const instruction = describe(step, exit !== null, destination);
  return {
    exit,
    primary: road ?? instruction,
    secondary: road && step.turn !== Turn.Through ? instruction : null,
  };
}

function describe(s: NavStep, isExit: boolean, destination: string): string {
  const t = s.turn;
  if (isRoundabout(t)) return s.roundaboutExit ? `Take exit ${s.roundaboutExit} at the roundabout` : 'At the roundabout, exit';
  switch (t) {
    case Turn.Left:
      return 'Turn left';
    case Turn.Right:
      return 'Turn right';
    case Turn.SlightLeft:
      return isExit ? 'Take the exit on the left' : 'Keep left';
    case Turn.SlightRight:
      return isExit ? 'Take the exit' : 'Keep right';
    case Turn.SharpLeft:
      return 'Sharp left';
    case Turn.SharpRight:
      return 'Sharp right';
    case Turn.UTurnLeft:
    case Turn.UTurnRight:
      return 'Make a U-turn';
    case Turn.Merge:
      return 'Merge';
    case Turn.Ferry:
      return 'Take the ferry';
    case Turn.Arrive:
      return destination || 'Arrive at destination';
    default:
      return 'Continue';
  }
}

/** "Company, City" of the job destination, or "". */
export const destinationName = (v: ChannelMap) =>
  [v['job.destinationCompany'], v['job.destinationCity']].filter((s) => typeof s === 'string' && s).join(', ');

export interface Eta {
  /** Arrival on the game clock, "14:05" (null without game time). */
  arrival: string | null;
  /** Time left, split for display: { value: "2:32", unit: "hr" } / { value: "12", unit: "min" }. */
  left: { value: string; unit: string };
}

/** From the game's own GPS (nav.timeSec, assumed game seconds); null when no GPS route. */
export function eta(v: ChannelMap): Eta | null {
  const sec = num(v['nav.timeSec']);
  if (sec === null || (num(v['nav.distanceM']) ?? 0) <= 0) return null;
  const now = num(v['world.gameMinutes']);
  let arrival: string | null = null;
  if (now !== null) {
    const m = Math.floor(now + sec / 60) % 1440;
    arrival = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  const min = Math.round(sec / 60);
  const left = min < 60 ? { value: String(min), unit: 'min' } : { value: `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`, unit: 'hr' };
  return { arrival, left };
}
