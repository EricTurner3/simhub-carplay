import type { ChannelValue, StatusMsg } from '@simhub-carplay/shared';

export interface SourceSink {
  set(channel: string, value: ChannelValue): void;
  /** Mark all channels unknown. */
  clear(): void;
  status(upstream: StatusMsg['upstream'], detail?: string): void;
}

export interface TelemetrySource {
  readonly name: string;
  start(sink: SourceSink): void;
  stop(): void;
  /**
   * The active game profile's channel -> property map. Called before start()
   * and again whenever the game changes; sources that read SimHub properties
   * (re)subscribe accordingly.
   */
  setProperties(channels: Record<string, string>): void;
  /**
   * Press (down=true) or release a vehicle control. `input` is the SimHub input
   * name to trigger. Returns false if it couldn't be delivered (e.g. not connected).
   */
  control(id: string, input: string, down: boolean): boolean;
}
