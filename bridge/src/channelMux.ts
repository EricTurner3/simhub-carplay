import type { ChannelMapping, ChannelValue } from '@simhub-carplay/shared';

/**
 * Sits between a telemetry source and the store so a channel can be fed from
 * different SimHub properties depending on another channel (see ChannelCase).
 *
 * Plain channels subscribe under their own name. Each case of a switched channel
 * subscribes under a hidden alias "<channel>[<i>]"; the mux caches those raw
 * values and emits the channel whenever the selected case or its value changes.
 * Names it doesn't know (e.g. the mock emitting channels directly) pass through.
 */
export class ChannelMux {
  /** alias -> SimHub property, for the source to subscribe to */
  private props: Record<string, string> = {};
  /** switched channel -> its cases, with the alias each case reads (null: no value) */
  private switched = new Map<string, { when?: string; alias: string | null }[]>();
  /** plain channel -> switched channels that depend on it */
  private dependents = new Map<string, string[]>();
  /** alias -> switched channel it belongs to */
  private owner = new Map<string, string>();
  /** latest raw value per alias (case aliases and `when` channels) */
  private raw = new Map<string, ChannelValue>();

  constructor(private emit: (channel: string, value: ChannelValue) => void) {}

  /** Load a profile's channel map; returns the alias -> property map to subscribe to. */
  setChannels(channels: Record<string, ChannelMapping>): Record<string, string> {
    const prevProps = this.props;
    this.props = {};
    this.switched.clear();
    this.dependents.clear();
    this.owner.clear();

    for (const [ch, mapping] of Object.entries(channels)) {
      if (typeof mapping === 'string') {
        this.props[ch] = mapping;
        continue;
      }
      const cases = mapping.map((c, i) => {
        const alias = c.prop === null ? null : `${ch}[${i}]`;
        if (alias) {
          this.props[alias] = c.prop!;
          this.owner.set(alias, ch);
        }
        if (c.when) this.dependents.set(c.when, [...(this.dependents.get(c.when) ?? []), ch]);
        return { when: c.when, alias };
      });
      this.switched.set(ch, cases);
    }

    // The source won't resend a property it's still subscribed to, so keep cached
    // values whose alias still reads the same property.
    for (const alias of [...this.raw.keys()]) {
      if (this.props[alias] !== prevProps[alias]) this.raw.delete(alias);
    }
    return this.props;
  }

  /** Current value of a switched channel, from cached raw values. */
  resolve(channel: string): ChannelValue {
    const cases = this.switched.get(channel);
    if (!cases) return null;
    const hit = cases.find((c) => !c.when || isOn(this.raw.get(c.when) ?? null));
    return hit?.alias ? (this.raw.get(hit.alias) ?? null) : null;
  }

  /** A value arrived from the source under `alias`. */
  set(alias: string, value: ChannelValue): void {
    const owner = this.owner.get(alias);
    if (owner) {
      this.raw.set(alias, value);
      this.emit(owner, this.resolve(owner));
      return;
    }
    this.emit(alias, value);
    const deps = this.dependents.get(alias);
    if (!deps) return;
    this.raw.set(alias, value);
    for (const ch of deps) this.emit(ch, this.resolve(ch));
  }

  clear(): void {
    this.raw.clear();
  }
}

function isOn(v: ChannelValue): boolean {
  return v === true || (typeof v === 'number' && v !== 0) || v === 'True' || v === 'true';
}
