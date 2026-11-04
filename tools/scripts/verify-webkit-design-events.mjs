import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const cli = resolve(root, 'dist/libs/cli/src/index.js');
const holdSeconds = process.env.DESIGN_EVENTS_HOLD_SECONDS ?? '90';
const standIn = process.env.DESIGN_EVENTS_URL;

const freePort = () =>
  new Promise((done, fail) => {
    const probe = createServer();
    probe.on('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });

const waitFor = async (url) => {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(2000) });

      return;
    } catch {
      await new Promise((done) => setTimeout(done, 500));
    }
  }

  throw new Error(`nothing answered at ${url} within 60 s`);
};

let server;
let code = 1;

try {
  let url = standIn;

  if (!url) {
    const port = await freePort();

    url = `http://localhost:${port}/`;
    server = spawn('node', [cli, 'design'], {
      cwd: root,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, DE_PORT: String(port), ETHLETE_DESIGN_SLOW_CHECKS: 'off' },
    });
    server.on('exit', (status) => {
      if (code === 1 && status !== null) console.error(`the design server exited with ${status}`);
    });
  }

  await waitFor(url);
  const swift = spawn('swift', [resolve(root, 'tools/scripts/verify-webkit-design-events.swift'), url, holdSeconds], {
    stdio: 'inherit',
  });

  code = await new Promise((done) => swift.on('exit', (status) => done(status ?? 1)));
} catch (error) {
  console.error(`FAIL: ${error.message}`);
} finally {
  server?.kill();
}

process.exit(code);
