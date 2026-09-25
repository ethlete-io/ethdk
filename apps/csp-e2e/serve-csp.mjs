import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const NONCE_PLACEHOLDER = 'CSP_NONCE_PLACEHOLDER';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const cspFor = (nonce) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

const [, , rootArg, portArg] = process.argv;

if (!rootArg || !portArg) {
  console.error('Usage: node serve-csp.mjs <root-dir> <port>');
  process.exit(1);
}

const root = normalize(fileURLToPath(new URL(rootArg, `file://${process.cwd()}/`)));
const indexPath = join(root, 'index.html');

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const requestedPath = normalize(join(root, decodeURIComponent(url.pathname)));

  if (!requestedPath.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }

  const nonce = randomBytes(16).toString('base64');
  const file = (await isFile(requestedPath)) ? requestedPath : indexPath;

  try {
    const content = await readFile(file);
    const extension = extname(file);
    const body = extension === '.html' ? content.toString('utf8').replaceAll(NONCE_PLACEHOLDER, nonce) : content;

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
      'Content-Security-Policy': cspFor(nonce),
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

const isFile = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

server.listen(Number(portArg), () => {
  console.log(`Serving ${root} with a strict CSP on http://localhost:${portArg}`);
});
