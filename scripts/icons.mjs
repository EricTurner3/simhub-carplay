// Renders the PWA / home-screen icons into ui/public (no image libraries needed).
//   node scripts/icons.mjs
// Full-bleed background so the same art works as a "maskable" Android icon; the gauge
// stays inside the central 80% safe zone.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const out = new URL('../ui/public/', import.meta.url);

const TOP = [0x1d, 0x24, 0x40];
const BOTTOM = [0x05, 0x06, 0x0a];
const TRACK = [0x3a, 0x3f, 0x55];
const ACCENT = [0x0a, 0x84, 0xff];
const WHITE = [0xf5, 0xf5, 0xf7];

// Gauge geometry in unit space (0..1), 270-degree sweep opening at the bottom.
const C = 0.5, R = 0.29, W = 0.06;
const START = (135 * Math.PI) / 180, SWEEP = (270 * Math.PI) / 180, FILL = 0.68;
const NEEDLE = START + SWEEP * FILL;

function sample(x, y) {
  const t = y;
  let c = TOP.map((v, i) => v + (BOTTOM[i] - v) * t);
  const dx = x - C, dy = y - C, d = Math.hypot(dx, dy);
  // Angle measured clockwise from +x (screen coordinates), normalised to the sweep start.
  let a = Math.atan2(dy, dx);
  let rel = (a - START) % (2 * Math.PI);
  if (rel < 0) rel += 2 * Math.PI;
  if (Math.abs(d - R) < W / 2 && rel <= SWEEP) c = rel <= SWEEP * FILL ? ACCENT : TRACK;
  // Needle: a line segment from the hub toward the fill angle.
  const nx = Math.cos(NEEDLE), ny = Math.sin(NEEDLE);
  const along = dx * nx + dy * ny, across = Math.abs(dx * ny - dy * nx);
  if (along > -0.02 && along < R - W && across < 0.018) c = WHITE;
  if (d < 0.045) c = WHITE;
  return c;
}

function png(size) {
  const SS = 4; // supersampling for anti-aliased edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          for (let i = 0; i < 3; i++) acc[i] += c[i];
        }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (SS * SS));
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(new URL(name, out), png(size));
  console.log(`wrote ui/public/${name}`);
}
