import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_CACHE, currentAppCopy } from './studio-code.mjs';

export const APP_PORT = 4221;

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export const fileOf = (root, url) => {
  const sha = currentAppCopy(root);

  if (!sha) return null;

  const base = join(root, APP_CACHE, sha);
  const path = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const file = normalize(join(base, path));

  if (!file.startsWith(base + sep)) return null;
  if (existsSync(file) && statSync(file).isFile()) return file;
  if (extname(path) === '') return join(base, 'index.html');

  return null;
};

export const createAppServer = (root) =>
  createServer((request, response) => {
    const file = fileOf(root, request.url ?? '/');

    if (!file || !existsSync(file)) {
      response.writeHead(404, { 'Cache-Control': 'no-store' }).end();

      return;
    }

    response
      .writeHead(200, {
        'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      .end(readFileSync(file));
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const port = Number(process.argv[2] ?? APP_PORT);

  createAppServer(root).listen(port, '127.0.0.1', () =>
    console.error(`Serving the committed Studio app on http://localhost:${port}`),
  );
  createAppServer(root)
    .on('error', (error) => console.error(`Not serving on [::1]:${port}: ${error.message}`))
    .listen(port, '::1');
}
