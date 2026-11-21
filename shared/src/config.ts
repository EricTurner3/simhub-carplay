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

export interface UiConfig {
  /** 'auto' follows the active game profile (e.g. mph for ATS), falling back to km/h. */
  units: 'auto' | 'kmh' | 'mph';
  /** Channels to interpolate between updates in the render loop. */
  interpolate: Record<string, InterpolationKind>;
  autoSwitch: {
    enabled: boolean;
    parkedBelowKmh: number;
    parkedAfterMs: number;
  };
  input: {
    keyboard: KeyboardBindings;
    gamepad: GamepadConfig;
  };
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
  ui: UiConfig;
}

/** What the bridge exposes to the browser at GET /config.json. */
export interface ClientConfig {
  protocolVersion: number;
  ui: UiConfig;
}
