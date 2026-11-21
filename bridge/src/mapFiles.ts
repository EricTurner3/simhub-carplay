import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MapIndex } from '@simhub-carplay/shared';

const MIME: Record<string, string> = {
  '.pmtiles': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

/**
 * Serves generated map data (data/maps, see scripts/maps/build.sh) under /maps/.
 *   GET /maps/index.json   which games have tiles
 *   GET /maps/<file>       flat files only; Range requests (PMTiles reads byte ranges)
 * Returns false when the path isn't a /maps/ path.
 */
export async function serveMapFile(dir: string, pathname: string, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const m = /^\/maps\/([\w@.-]+)$/.exec(pathname);
  if (!m) return false;
  const name = m[1];

  if (name === 'index.json') {
    const index: MapIndex = { games: (['ats', 'ets2'] as const).filter((g) => existsSync(join(dir, `${g}.pmtiles`))) };
    res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
    res.end(JSON.stringify(index));
    return true;
  }

  const file = join(dir, name);
  const ext = name.slice(name.lastIndexOf('.'));
  let size: number;
  try {
    const s = await stat(file);
    if (!s.isFile() || !(ext in MIME)) throw new Error();
    size = s.size;
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Map data not found. Run "npm run maps:build".');
    return true;
  }

  const headers = { 'content-type': MIME[ext], 'accept-ranges': 'bytes', 'cache-control': 'no-cache' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (!range) {
    res.writeHead(200, { ...headers, 'content-length': size });
    createReadStream(file).pipe(res);
    return true;
  }
  // bytes=a-b, bytes=a- or bytes=-n (suffix)
  let start = range[1] ? Number(range[1]) : size - Number(range[2]);
  let end = range[1] && range[2] ? Number(range[2]) : size - 1;
  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  if (start > end) {
    res.writeHead(416, { 'content-range': `bytes */${size}` }).end();
    return true;
  }
  res.writeHead(206, { ...headers, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}` });
  createReadStream(file, { start, end }).pipe(res);
  return true;
}
