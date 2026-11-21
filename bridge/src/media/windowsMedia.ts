import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChannelValue, MediaAction, MediaConfig } from '@simhub-carplay/shared';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'windowsMedia.ps1');

/** Channels this source provides, replacing the game profile's SimHub `media.*` mappings. */
export const MEDIA_CHANNELS = [
  'media.title',
  'media.artist',
  'media.album',
  'media.app',
  'media.playing',
  'media.positionSec',
  'media.durationSec',
  /** Relative URL of the album art (served by the bridge), or null. */
  'media.art',
  'media.canNext',
  'media.canPrevious',
] as const;

export const ART_PATH = 'media/art';

interface StateLine {
  t: 'state';
  title: string | null;
  artist: string | null;
  album: string | null;
  app: string | null;
  playing: boolean;
  positionSec: number | null;
  durationSec: number | null;
  art: number | null;
  canNext: boolean;
  canPrevious: boolean;
}
type HelperLine = StateLine | { t: 'art'; id: number; mime: string; data: string } | { t: 'error'; msg: string };

/**
 * Now Playing from the Windows media session (what the volume flyout shows).
 * Runs windowsMedia.ps1 in a hidden Windows PowerShell, restarting it if it
 * exits, and passes transport buttons to it.
 */
export class WindowsMedia {
  private child: ChildProcessWithoutNullStreams | undefined;
  private retry: NodeJS.Timeout | undefined;
  private retryMs = 2000;
  private stopped = false;
  private values = new Map<string, ChannelValue>();
  private artImage: { id: number; mime: string; data: Buffer } | null = null;
  private lastError = '';

  constructor(
    private cfg: MediaConfig,
    private emit: (channel: string, value: ChannelValue) => void,
  ) {}

  start(): void {
    if (process.platform !== 'win32') {
      console.warn('[media] "windows" media source needs Windows; Now Playing stays empty');
      return;
    }
    this.stopped = false;
    this.spawn();
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.retry);
    this.child?.stdin.end(); // the helper exits when stdin closes
    this.child?.kill();
  }

  /** Re-send every media channel (e.g. after the store was cleared). */
  replay(): void {
    for (const [ch, v] of this.values) this.emit(ch, v);
  }

  /** Current album art for GET /media/art, or null. */
  art(): { mime: string; data: Buffer } | null {
    return this.artImage;
  }

  command(action: MediaAction): boolean {
    if (!this.child || this.child.stdin.destroyed) return false;
    this.child.stdin.write(`${action}\n`);
    return true;
  }

  private spawn(): void {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-PollMs', String(this.cfg.pollMs)],
      { windowsHide: true },
    );
    this.child = child;
    console.log('[media] reading the Windows media session');

    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) this.onLine(line);
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => console.warn(`[media] ${chunk.trim()}`));
    child.on('error', (err) => console.error(`[media] could not start powershell.exe: ${err.message}`));
    child.on('exit', (code) => {
      if (this.child === child) this.child = undefined;
      this.clearValues();
      if (this.stopped) return;
      console.warn(`[media] helper exited (${code ?? 'killed'}), restarting in ${this.retryMs / 1000}s`);
      this.retry = setTimeout(() => this.spawn(), this.retryMs);
      this.retryMs = Math.min(30_000, this.retryMs * 2);
    });
  }

  private onLine(line: string): void {
    let msg: HelperLine;
    try {
      msg = JSON.parse(line) as HelperLine;
    } catch {
      console.warn(`[media] unexpected output: ${line.slice(0, 200)}`);
      return;
    }
    switch (msg.t) {
      case 'state':
        this.retryMs = 2000; // it's working: reset the restart backoff
        this.set('media.title', msg.title);
        this.set('media.artist', msg.artist);
        this.set('media.album', msg.album);
        this.set('media.app', msg.app);
        this.set('media.playing', msg.playing);
        this.set('media.positionSec', msg.positionSec);
        this.set('media.durationSec', msg.durationSec);
        this.set('media.canNext', msg.canNext);
        this.set('media.canPrevious', msg.canPrevious);
        // Art id changes with the image, so the URL doubles as a cache buster.
        this.set('media.art', msg.art !== null && this.artImage?.id === msg.art ? `${ART_PATH}?v=${msg.art}` : null);
        break;
      case 'art':
        this.artImage = { id: msg.id, mime: msg.mime, data: Buffer.from(msg.data, 'base64') };
        break;
      case 'error':
        // The helper retries every poll; don't flood the log with the same error.
        if (msg.msg !== this.lastError) console.warn(`[media] ${msg.msg}`);
        this.lastError = msg.msg;
        break;
    }
  }

  private set(channel: string, value: ChannelValue): void {
    this.values.set(channel, value);
    this.emit(channel, value);
  }

  private clearValues(): void {
    for (const ch of MEDIA_CHANNELS) this.set(ch, null);
    this.artImage = null;
  }
}
