import { Socket, createConnection } from 'node:net';
import type { AppConfig, ChannelValue } from '@simhub-carplay/shared';
import type { SourceSink, TelemetrySource } from './source.ts';

/**
 * Client for the SimHub Property Server plugin
 * (https://github.com/pre-martin/SimHubPropertyServer).
 *
 * Line protocol over TCP:
 *   server> SimHub Property Server             (greeting)
 *   client> subscribe dcp.gd.SpeedKmh
 *   server> Property dcp.gd.SpeedKmh double 123.4
 *   server> Property dcp.GameRunning boolean True
 *   server> Property dcp.gd.Gear string (null)
 *
 * The plugin pushes changes at most 10 Hz; the UI interpolates in between.
 * Subscriptions follow the active game profile (see setProperties).
 */
export class PropertyServerSource implements TelemetrySource {
  readonly name = 'propertyServer';
  private socket: Socket | undefined;
  private retry: NodeJS.Timeout | undefined;
  private stopped = false;
  private buffer = '';
  /** property name -> channel aliases (several aliases may share a property) */
  private byProperty = new Map<string, string[]>();
  private sink!: SourceSink;

  constructor(private cfg: AppConfig['propertyServer']) {}

  setProperties(channels: Record<string, string>): void {
    const before = new Set(this.byProperty.keys());
    this.byProperty.clear();
    for (const [alias, prop] of Object.entries(channels)) {
      const list = this.byProperty.get(prop) ?? [];
      list.push(alias);
      this.byProperty.set(prop, list);
    }

    const socket = this.socket;
    if (!socket || socket.destroyed || socket.connecting) return; // 'connect' subscribes everything
    for (const prop of before) if (!this.byProperty.has(prop)) socket.write(`unsubscribe ${prop}\r\n`);
    for (const prop of this.byProperty.keys()) if (!before.has(prop)) socket.write(`subscribe ${prop}\r\n`);
  }

  start(sink: SourceSink): void {
    this.sink = sink;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.retry);
    if (this.socket && !this.socket.destroyed) {
      this.socket.end('disconnect\r\n');
    }
  }

  /**
   * Fires a SimHub input as "PropertyServerPlugin.<input>". Map it in SimHub under
   * Controls and events -> Keyboard emulation (press type "During" mirrors down/up).
   */
  control(_id: string, input: string, down: boolean): boolean {
    const socket = this.socket;
    if (!socket || socket.destroyed || socket.connecting) return false;
    socket.write(`${down ? 'trigger-input-pressed' : 'trigger-input-released'} ${input}\r\n`);
    return true;
  }

  private connect(): void {
    const { host, port } = this.cfg;
    this.sink.status('connecting', `${host}:${port}`);
    this.buffer = '';

    const socket = createConnection({ host, port });
    this.socket = socket;
    socket.setEncoding('utf8');
    socket.setNoDelay(true);

    socket.on('connect', () => {
      this.sink.status('connected', `${host}:${port}`);
      for (const prop of this.byProperty.keys()) socket.write(`subscribe ${prop}\r\n`);
    });
    socket.on('data', (chunk: string) => this.onData(chunk));
    socket.on('error', (err) => {
      this.sink.status('disconnected', err.message);
    });
    socket.on('close', () => {
      this.sink.clear();
      if (this.stopped) return;
      this.sink.status('disconnected', `retrying in ${this.cfg.reconnectMs} ms`);
      this.retry = setTimeout(() => this.connect(), this.cfg.reconnectMs);
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';
    for (const line of lines) this.onLine(line);
  }

  private onLine(line: string): void {
    if (!line.startsWith('Property ')) return; // greeting, help output, etc.
    // "Property <name> <type> <value...>" - string values may contain spaces.
    const m = /^Property (\S+) (\S+) ?(.*)$/.exec(line);
    if (!m) return;
    const [, prop, type, raw] = m;
    const aliases = this.byProperty.get(prop);
    if (!aliases) return;
    const value = parseValue(type, raw);
    for (const alias of aliases) this.sink.set(alias, value);
  }
}

export function parseValue(type: string, raw: string): ChannelValue {
  if (raw === '(null)') return null;
  switch (type) {
    case 'boolean':
      return raw.toLowerCase() === 'true';
    case 'integer':
    case 'long':
    case 'double':
    case 'float':
    case 'decimal': {
      // SimHub may format with the Windows locale ("123,4").
      const n = Number(raw.replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }
    case 'timespan':
      return parseTimeSpan(raw);
    default:
      return decodeString(raw);
  }
}

/**
 * Property Server sends strings it can't put on the line as-is (non-ASCII, e.g.
 * the em dash in "Foo Fighters — Wasting Light") as "{base64}<UTF-8 bytes>".
 */
function decodeString(raw: string): string {
  const prefix = '{base64}';
  if (!raw.startsWith(prefix)) return raw;
  return Buffer.from(raw.slice(prefix.length), 'base64').toString('utf8');
}

/** .NET TimeSpan "[-][d.]hh:mm:ss[.fffffff]" -> seconds. */
function parseTimeSpan(raw: string): number | null {
  const m = /^(-)?(?:(\d+)\.)?(\d+):(\d+):(\d+)(?:[.,](\d+))?$/.exec(raw.trim());
  if (!m) return null;
  const [, neg, d, h, min, s, frac] = m;
  const secs = Number(d ?? 0) * 86400 + Number(h) * 3600 + Number(min) * 60 + Number(s) + (frac ? Number(`0.${frac}`) : 0);
  return neg ? -secs : secs;
}
