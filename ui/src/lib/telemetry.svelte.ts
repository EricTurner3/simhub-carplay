import {
  PROTOCOL_VERSION,
  type ChannelMap,
  type ChannelValue,
  type ControlMsg,
  type InputAction,
  type InterpolationKind,
  type MediaAction,
  type MediaMsg,
  type NavRoute,
  type ProfileInfo,
  type ServerMessage,
  type SettingsMsg,
  type SettingsPatch,
  type UiConfig,
  type StatusMsg,
} from '@simhub-carplay/shared';

interface Interp {
  kind: InterpolationKind;
  from: number;
  to: number;
  t0: number;
  dur: number;
  lastAt: number;
  /** Smoothed time between updates; the next segment is stretched over this. */
  interval: number;
}

/**
 * Telemetry client. Two ways to read data:
 *  - `slow[channel]`: Svelte-reactive, for channels that are NOT interpolated
 *    (gear, flags, settings...). Use in markup.
 *  - `sample(channel, now)`: interpolated value for fast channels, read from the
 *    frame loop. Not reactive by design.
 */
export class Telemetry {
  conn = $state({
    ws: 'connecting' as 'connecting' | 'open' | 'closed',
    upstream: 'connecting' as StatusMsg['upstream'],
    detail: '' as string | undefined,
    backend: '',
  });
  slow = $state<ChannelMap>({});
  /** Active game profile: which game is running and which channels it provides. */
  profile = $state<ProfileInfo | null>(null);
  /** Truck-game navigation route (ATS/ETS2), or null. Progress is in the nav.stepIndex / nav.maneuverDistM channels. */
  route = $state.raw<NavRoute | null>(null);

  private channelSet = new Set<string>();

  private raw = new Map<string, ChannelValue>();
  private interp = new Map<string, Interp>();
  private inputListeners = new Set<(a: InputAction) => void>();
  private configListeners = new Set<(ui: UiConfig) => void>();
  private ws: WebSocket | undefined;
  private retryMs = 500;

  constructor(
    private url: string,
    private interpolate: Record<string, InterpolationKind>,
  ) {}

  connect(): void {
    this.conn.ws = 'connecting';
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.conn.ws = 'open';
      this.retryMs = 500;
    };
    ws.onmessage = (ev) => this.onMessage(JSON.parse(ev.data as string) as ServerMessage);
    ws.onclose = () => {
      this.conn.ws = 'closed';
      this.route = null;
      this.conn.upstream = 'disconnected';
      setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(5000, this.retryMs * 2);
    };
  }

  /** Latest raw value (no interpolation, not reactive). */
  /** Does the active game provide this channel? Reactive (tracks profile changes). */
  has(channel: string): boolean {
    void this.profile;
    return this.channelSet.has(channel);
  }

  get(channel: string): ChannelValue {
    return this.raw.get(channel) ?? null;
  }

  /** Interpolated numeric value at `now` (performance.now() clock), or null if unknown. */
  sample(channel: string, now: number): number | null {
    const it = this.interp.get(channel);
    if (!it) {
      const v = this.raw.get(channel);
      return typeof v === 'number' ? v : null;
    }
    const k = Math.min(1, Math.max(0, (now - it.t0) / it.dur));
    if (it.kind === 'wrap') {
      let diff = it.to - it.from;
      if (diff > 0.5) diff -= 1;
      else if (diff < -0.5) diff += 1;
      return (((it.from + diff * k) % 1) + 1) % 1;
    }
    return it.from + (it.to - it.from) * k;
  }

  /** Operate a vehicle control (see ControlMsg). Returns false if the bridge isn't connected. */
  sendControl(id: string, action: ControlMsg['action'], count?: number): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    const msg: ControlMsg = { t: 'control', id, action, ...(count ? { count } : {}) };
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /** Ask the bridge to change and save UI settings. Returns false if the bridge isn't connected. */
  sendSettings(patch: SettingsPatch): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    const msg: SettingsMsg = { t: 'settings', patch };
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /** Media transport button (only works with media.source "windows"). */
  sendMedia(action: MediaAction): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    const msg: MediaMsg = { t: 'media', action };
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  onConfig(fn: (ui: UiConfig) => void): () => void {
    this.configListeners.add(fn);
    return () => this.configListeners.delete(fn);
  }

  onInput(fn: (a: InputAction) => void): () => void {
    this.inputListeners.add(fn);
    return () => this.inputListeners.delete(fn);
  }

  private onMessage(msg: ServerMessage): void {
    switch (msg.t) {
      case 'hello':
        if (msg.v !== PROTOCOL_VERSION) console.warn(`Protocol v${msg.v}, UI expects v${PROTOCOL_VERSION}`);
        this.conn.backend = msg.backend;
        break;
      case 'status':
        this.conn.upstream = msg.upstream;
        this.conn.detail = msg.detail;
        break;
      case 'profile':
        this.channelSet = new Set(msg.profile.channels);
        this.profile = msg.profile;
        break;
      case 'snapshot':
        // The channel set may have changed (new game): drop values that no longer exist.
        for (const ch of Object.keys(this.slow)) if (!(ch in msg.d)) delete this.slow[ch];
        this.raw.clear();
        this.interp.clear();
        this.apply(msg.d, false);
        break;
      case 'delta':
        this.apply(msg.d, true);
        break;
      case 'input':
        for (const fn of this.inputListeners) fn(msg.action);
        break;
      case 'config':
        for (const fn of this.configListeners) fn(msg.ui);
        break;
      case 'route':
        this.route = msg.route;
        break;
    }
  }

  private apply(d: ChannelMap, smooth: boolean): void {
    const now = performance.now();
    for (const [ch, v] of Object.entries(d)) {
      this.raw.set(ch, v);
      const kind = this.interpolate[ch];
      if (!kind) {
        this.slow[ch] = v;
        continue;
      }
      if (typeof v !== 'number') {
        this.interp.delete(ch);
        continue;
      }
      const prev = this.interp.get(ch);
      if (!prev || !smooth) {
        this.interp.set(ch, { kind, from: v, to: v, t0: now, dur: 1, lastAt: now, interval: 100 });
        continue;
      }
      const gap = Math.min(250, Math.max(16, now - prev.lastAt));
      prev.interval += (gap - prev.interval) * 0.25;
      prev.from = this.sample(ch, now) ?? v;
      prev.to = v;
      prev.t0 = now;
      prev.dur = prev.interval;
      prev.lastAt = now;
    }
  }
}
