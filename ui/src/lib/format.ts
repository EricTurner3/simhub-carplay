import type { ChannelValue, Units } from '@simhub-carplay/shared';

/** SimHub flags arrive as booleans or 0/1 depending on how they're read. */
export function isOn(v: ChannelValue): boolean {
  return v === true || (typeof v === 'number' && v !== 0) || v === 'True' || v === 'true';
}

export const num = (v: ChannelValue): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const DASH = '—';

export function fmtNum(v: ChannelValue, digits = 0): string {
  const n = num(v);
  return n === null ? DASH : n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtText(v: ChannelValue): string {
  return v === null || v === undefined || v === '' ? DASH : String(v);
}

export function fmtSpeed(kmh: number, units: Units): string {
  return String(Math.round(units === 'mph' ? kmh * 0.621371 : kmh));
}

export const speedUnit = (units: Units) => (units === 'mph' ? 'mph' : 'km/h');

/** Metres -> "12.4 mi" / "850 ft" / "3.2 km" / "400 m". */
export function fmtDistance(meters: ChannelValue, units: Units): string {
  const m = num(meters);
  if (m === null) return DASH;
  if (units === 'mph') {
    const mi = m / 1609.344;
    return mi < 0.1 ? `${Math.round(m * 3.28084 / 10) * 10} ft` : `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${m < 10_000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)} km`;
}

/** Seconds -> "1 h 05 min" / "12 min" / "45 s". */
export function fmtDuration(seconds: ChannelValue): string {
  const s = num(seconds);
  if (s === null) return DASH;
  const neg = s < 0;
  const abs = Math.abs(s);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const out = h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : m > 0 ? `${m} min` : `${Math.round(abs)} s`;
  return neg ? `−${out}` : out;
}

/** Lap time in seconds -> "1:38.432". */
export function fmtLapTime(seconds: ChannelValue): string {
  const s = num(seconds);
  if (s === null || s <= 0) return DASH;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, '0')}`;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** SCS game time (minutes since Monday 00:00 of week 1) -> "Thu 14:05". */
export function fmtGameClock(minutes: ChannelValue): string {
  const m = num(minutes);
  if (m === null) return DASH;
  const day = DAYS[Math.floor(m / 1440) % 7];
  const hh = Math.floor((m % 1440) / 60);
  const mm = Math.floor(m % 60);
  return `${day} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function fmtMoney(v: ChannelValue, currency = ''): string {
  const n = num(v);
  if (n === null) return DASH;
  const body = Math.round(n).toLocaleString();
  return currency === '€' ? `${body} €` : `${currency}${body}`;
}

/** 0..1 -> "12%" */
export function fmtFraction(v: ChannelValue): string {
  const n = num(v);
  return n === null ? DASH : `${Math.round(n * 100)}%`;
}

export function fmtMass(kg: ChannelValue, units: Units): string {
  const n = num(kg);
  if (n === null) return DASH;
  return units === 'mph' ? `${Math.round(n * 2.20462).toLocaleString()} lb` : `${(n / 1000).toFixed(1)} t`;
}

/** Short unit labels for SimHub's unit strings ("Celsius" -> "°C", "Psi" -> "psi"). */
export function unitLabel(v: ChannelValue): string {
  switch (String(v ?? '').toLowerCase()) {
    case 'celsius':
      return '°C';
    case 'fahrenheit':
      return '°F';
    case 'psi':
      return 'psi';
    case 'bar':
      return 'bar';
    case 'kpa':
      return 'kPa';
    case 'liters':
    case 'litres':
      return 'L';
    case 'gallons':
      return 'gal';
    default:
      return v ? String(v) : '';
  }
}
