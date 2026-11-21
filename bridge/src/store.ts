import type { ChannelMap, ChannelValue } from '@simhub-carplay/shared';

/**
 * Latest value per channel plus the set of channels changed since the last flush.
 * Only channels of the active game profile exist; writes to others are ignored.
 */
export class TelemetryStore {
  private values: ChannelMap = {};
  private dirty = new Set<string>();

  constructor(channels: string[]) {
    for (const ch of channels) this.values[ch] = null;
  }

  /**
   * Switch to a new channel set (game profile changed). Channels for which `keep`
   * returns true retain their value; everything else starts unknown.
   */
  setChannels(channels: string[], keep: (channel: string) => boolean): void {
    const next: ChannelMap = {};
    for (const ch of channels) next[ch] = keep(ch) ? (this.values[ch] ?? null) : null;
    this.values = next;
    this.dirty.clear();
  }

  set(channel: string, value: ChannelValue): void {
    if (!(channel in this.values)) return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) value = null;
      else value = Math.round(value * 1000) / 1000; // keep frames compact
    }
    if (this.values[channel] === value) return;
    this.values[channel] = value;
    this.dirty.add(channel);
  }

  get(channel: string): ChannelValue {
    return this.values[channel] ?? null;
  }

  /** Mark every channel unknown (e.g. upstream lost). */
  clear(): void {
    for (const ch of Object.keys(this.values)) this.set(ch, null);
  }

  snapshot(): ChannelMap {
    return { ...this.values };
  }

  /** Changed channels since the previous call, or null if nothing changed. */
  takeDelta(): ChannelMap | null {
    if (this.dirty.size === 0) return null;
    const d: ChannelMap = {};
    for (const ch of this.dirty) d[ch] = this.values[ch];
    this.dirty.clear();
    return d;
  }
}
