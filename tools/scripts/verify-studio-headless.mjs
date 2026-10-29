#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cliEntry = resolve(root, 'dist/libs/cli/src/index.js');
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const listen = (server) => new Promise((done) => server.listen(0, '::1', () => done(server.address().port)));

const serveStatic = (dir) =>
  createServer((request, response) => {
    const file = resolve(dir, `.${decodeURIComponent(new URL(request.url, 'http://x').pathname)}`);
    const path = file.startsWith(dir) && existsSync(file) && extname(file) ? file : join(dir, 'index.html');

    response.setHeader('content-type', TYPES[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  });

const startDesignServer = (checkout) =>
  new Promise((resolvePort, reject) => {
    const child = spawn(process.execPath, [cliEntry, 'design', checkout], {
      cwd: checkout,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const onData = (chunk) => {
      output += chunk;
      const port = /Local:\s+https?:\/\/localhost:(\d+)/.exec(output.replace(/\u001b\[[0-9;]*m/g, ''))?.[1];

      if (port) resolvePort({ child, port: Number(port) });
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`design server exited with ${code}\n${output}`)));
  });

/**
 * The design server listens on `::1` only, so every address here is `[::1]`: `localhost` and `127.0.0.1` are refused from Node.
 * Builds Studio into a scratch folder, runs a design server and a static server of its own on free ports, and
 * calls `run({ page, studioUrl, designPort })` in headless Chromium with a stubbed desktop shell. Stops only what it started.
 */
export const withStudio = async (run, { checkout = root, build = true } = {}) => {
  const scratch = mkdtempSync(join(tmpdir(), 'studio-headless-'));
  const servers = [];
  let design;
  let browser;

  try {
    if (!existsSync(cliEntry)) execFileSync('npx', ['nx', 'build', 'cli'], { cwd: root, stdio: 'inherit' });

    if (build) {
      execFileSync(
        'npx',
        ['nx', 'build', 'ethlete-studio', `--outputPath=${scratch}`, '--excludeTaskDependencies', '--skip-nx-cache'],
        {
          cwd: root,
          stdio: 'inherit',
          env: { ...process.env, NX_NO_CLOUD: 'true' },
        },
      );
    }

    design = await startDesignServer(checkout);

    const app = serveStatic(join(scratch, 'browser'));
    servers.push(app);
    const studioPort = await listen(app);
    const designUrl = `http://[::1]:${design.port}`;

    const { chromium } = await import('playwright');
    browser = await chromium.launch({ args: ['--disable-features=LocalNetworkAccessChecks'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.exposeFunction('__studioHost', async (command) => {
      if (command === 'design_roots') return { search: '', roots: [checkout] };
      if (command === 'design_project') {
        const calls = await (await fetch(`${designUrl}/__design/calls`)).json();
        const config = JSON.parse(readFileSync(join(checkout, '.ethlete/design/config.json'), 'utf8'));
        const themes = Object.fromEntries(
          Object.keys(config.projects ?? {}).map((name) => [name, { surface: [], color: [] }]),
        );

        return {
          callsRoot: join(checkout, '.ethlete/design/calls'),
          port: design.port,
          defaultCall: config.defaultCall ?? null,
          themes,
          calls,
        };
      }
      if (command.startsWith('design_server_')) {
        return {
          port: design.port,
          listening: true,
          managed: false,
          foreign: false,
          stale: false,
          exited: false,
          log: [],
        };
      }

      throw new Error(`verify-studio-headless: host command ${command} is not stubbed`);
    });
    await page.addInitScript(() => {
      let callbacks = 0;
      window.__TAURI_INTERNALS__ = {
        invoke: (command, args) => window.__studioHost(command, args),
        transformCallback: () => ++callbacks,
        unregisterCallback: () => undefined,
        convertFileSrc: (path) => path,
        metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      };
    });

    return await run({ page, studioUrl: `http://[::1]:${studioPort}`, designPort: design.port });
  } finally {
    await browser?.close();
    servers.forEach((server) => server.close());
    design?.child.removeAllListeners('exit');
    design?.child.kill('SIGTERM');
    rmSync(scratch, { recursive: true, force: true });
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
  const out = resolve(value('--out', join(tmpdir(), 'studio-headless.png')));

  await withStudio(async ({ page, studioUrl, designPort }) => {
    console.log(`studio ${studioUrl}, design server http://[::1]:${designPort}`);
    await page.goto(`${studioUrl}${value('--path', '/')}`);
    await page.waitForTimeout(Number(value('--wait', 4000)));
    await page.screenshot({ path: out });
    console.log(`screenshot ${out}`);
  });
}
