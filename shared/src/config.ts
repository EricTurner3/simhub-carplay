/** Shape of the repo-root config.json. */

import type { InputAction } from './protocol.ts';

export type SourceKind = 'mock' | 'propertyServer';
export type InterpolationKind = 'linear' | 'wrap';

export interface KeyboardBindings extends Partial<Record<InputAction | 'debug', string[]>> {}

export interface GamepadConfig {
  /** Only read gamepads whose id contains this (case-insensitive). Empty = all. */
  idContains: string;
  buttons: Partial<Record<InputAction, number[]>>;
  /** Axis index of a DirectInput POV hat as Chromium exposes it (often 9), or null. */
  hatAxis: number | null;
  repeatDelayMs: number;
  repeatRateMs: number;
}

export interface BackgroundGradient {
  /** CSS linear-gradient angle in degrees (0 = toward the top, 90 = toward the right). */
  angle: number;
  /** #rrggbb */
  from: string;
  /** #rrggbb */
  to: string;
}

export interface AppearanceConfig {
  /** Background preset id (see ui/src/lib/appearance.ts), or 'custom' to use `custom`. */
  background: string;
  custom: BackgroundGradient;
  /** Frosted-glass cards (translucent + blur). Turn off if the screen's GPU struggles. */
  glass: boolean;
  /** Size of the app-grid icons, 1 = default (ICON_SCALE_MIN..ICON_SCALE_MAX). */
  iconScale: number;
  /** Split-view layout: 'classic' (two cards beside the map) or 'gauges' (three rows, gauges at the bottom). */
  dashboard: DashboardLayout;
}

export type DashboardLayout = 'classic' | 'gauges';
export const DASHBOARD_LAYOUTS: DashboardLayout[] = ['classic', 'gauges'];

export const ICON_SCALE_MIN = 0.6;
export const ICON_SCALE_MAX = 2;

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  background: 'black',
  custom: { angle: 160, from: '#1d2440', to: '#05060a' },
  glass: true,
  iconScale: 1,
  dashboard: 'classic',
};

export interface UiConfig {
  /** 'auto' follows the active game profile (e.g. mph for ATS), falling back to km/h. */
  units: 'auto' | 'kmh' | 'mph';
  /** Channels to interpolate between updates in the render loop. */
  interpolate: Record<string, InterpolationKind>;
  autoSwitch: {
    enabled: boolean;
    parkedBelowKmh: number;
    /** How long below `parkedBelowKmh` counts as parked; null: stopping never does (e.g. at a light). */
    parkedAfterMs: number | null;
  };
  input: {
    keyboard: KeyboardBindings;
    gamepad: GamepadConfig;
  };
  appearance: AppearanceConfig;
}

/** The part of `ui` the Settings app can change at runtime (saved back to config.json). */
export interface SettingsPatch {
  units?: UiConfig['units'];
  appearance?: Partial<Omit<AppearanceConfig, 'custom'>> & { custom?: Partial<BackgroundGradient> };
}

export interface AppConfig {
  bridge: {
    host: string;
    port: number;
    source: SourceKind;
    broadcastHz: number;
  };
  propertyServer: {
    host: string;
    port: number;
    reconnectMs: number;
  };
  mock: {
    /** SimHub game code the mock pretends to be, e.g. "AssettoCorsa" or "ATS". */
    game: string;
    updateHz: number;
    driveSeconds: number;
    parkedSeconds: number;
  };
  controls: {
    /** SimHub input name = prefix + control id, e.g. "carplay.hazards". */
    inputPrefix: string;
    /** How long a tap holds the input down. */
    tapMs: number;
    /** Pause between taps when a cycle control needs several. */
    gapMs: number;
  };
  media: MediaConfig;
  ui: UiConfig;
}

export interface MediaConfig {
  /**
   * Where Now Playing comes from. 'simhub': SimHub's MediaInfo (title + artist only).
   * 'windows': the bridge reads the Windows media session itself (art, album,
   * progress, play state) and can play/pause/skip. Windows only.
   */
  source: 'simhub' | 'windows';
  /** How often the Windows helper checks the media session. */
  pollMs: number;
}

export const DEFAULT_MEDIA: MediaConfig = { source: 'simhub', pollMs: 1000 };

/** What the bridge exposes to the browser at GET /config.json. */
export interface ClientConfig {
  protocolVersion: number;
  ui: UiConfig;
}
