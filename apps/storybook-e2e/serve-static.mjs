import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
};

const [, , rootArg, portArg] = process.argv;

if (!rootArg || !portArg) {
  console.error('Usage: node serve-static.mjs <root-dir> <port>');
  process.exit(1);
}

const root = normalize(fileURLToPath(new URL(rootArg, `file://${process.cwd()}/`)));
const port = Number(portArg);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const requestedPath = normalize(join(root, decodeURIComponent(url.pathname)));

  if (!requestedPath.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }

  const candidates = [requestedPath, join(requestedPath, 'index.html'), join(root, 'index.html')];

  for (const candidate of candidates) {
    try {
      const stats = await stat(candidate);

      if (!stats.isFile()) {
        continue;
      }

      const content = await readFile(candidate);

      res.writeHead(200, { 'Content-Type': MIME_TYPES[extname(candidate)] ?? 'application/octet-stream' });
      res.end(content);

      return;
    } catch {
      continue;
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`Serving ${root} on http://localhost:${port}`);
});
