#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cliEntry = resolve(root, process.env['STUDIO_CLI_ENTRY'] ?? 'dist/libs/cli/src/index.js');
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

export const phaseLine = (phase, startedAt, now = Date.now()) =>
  `[studio-headless ${new Date(now).toISOString()} +${((now - startedAt) / 1000).toFixed(1)}s] ${phase}`;

export const listen = (server) => new Promise((done) => server.listen(0, '::1', () => done(server.address().port)));

export const serveStatic = (dir, answer) =>
  createServer(async (request, response) => {
    if (await answer?.(request, response)) return;
    const file = resolve(dir, `.${decodeURIComponent(new URL(request.url, 'http://x').pathname)}`);
    const path = file.startsWith(dir) && existsSync(file) && extname(file) ? file : join(dir, 'index.html');

    response.setHeader('content-type', TYPES[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  });

export const startDesignServer = (checkout, stamp) =>
  new Promise((resolvePort, reject) => {
    stamp(`design server starting in ${checkout}`);
    const child = spawn(process.execPath, [cliEntry, 'design', checkout], {
      cwd: checkout,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let ready = false;
    const onData = (chunk) => {
      output += chunk;
      const port = /Local:\s+https?:\/\/localhost:(\d+)/.exec(stripVTControlCharacters(output))?.[1];

      if (port && !ready) {
        ready = true;
        stamp(`design server ready on port ${port}`);
        resolvePort({ child, port: Number(port) });
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`design server exited with ${code}\n${output}`)));
  });

export const missingBuildInputs = (checkout, entry = cliEntry) =>
  [
    [entry, 'npx nx build cli'],
    [join(checkout, 'dist/libs/components/package.json'), 'npx nx build components'],
  ]
    .filter(([path]) => !existsSync(path))
    .map(([path, command]) => `${path} is missing - run ${command}`);

export const WEBKIT_BLIND_EXIT = 3;

export const webkitVerdict = (statuses) => {
  const named = (match) => Object.keys(statuses).filter((check) => match(statuses[check]));
  const failed = named((status) => status !== 0 && status !== WEBKIT_BLIND_EXIT);
  const blind = named((status) => status === WEBKIT_BLIND_EXIT);
  const lines = [
    ...(failed.length ? [`FAIL: ${failed.join(', ')}`] : []),
    ...(blind.length ? [`BLIND: ${blind.join(', ')} - the wheel control got no event, so the run proves nothing`] : []),
  ];

  return { exit: failed.length ? 1 : blind.length ? WEBKIT_BLIND_EXIT : 0, lines };
};

export const ensureCli = () => {
  if (!existsSync(cliEntry)) execFileSync('npx', ['nx', 'build', 'cli'], { cwd: root, stdio: 'inherit' });
};

export const buildStudio = (outputPath, stamp) => {
  stamp('studio build starting');
  execFileSync(
    'npx',
    ['nx', 'build', 'ethlete-studio', `--outputPath=${outputPath}`, '--excludeTaskDependencies', '--skip-nx-cache'],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, NX_NO_CLOUD: 'true' },
    },
  );
  stamp('studio build done');
};

export const studioHostAnswer = async (command, checkout, designPort) => {
  if (command === 'design_roots') return { search: '', roots: [checkout] };
  if (command === 'design_project') {
    const calls = await (await fetch(`http://[::1]:${designPort}/__design/calls`)).json();
    const config = JSON.parse(readFileSync(join(checkout, '.ethlete/design/config.json'), 'utf8'));
    const themes = Object.fromEntries(
      Object.keys(config.projects ?? {}).map((name) => [name, { surface: [], color: [] }]),
    );

    return {
      callsRoot: join(checkout, '.ethlete/design/calls'),
      port: designPort,
      defaultCall: config.defaultCall ?? null,
      themes,
      calls,
    };
  }
  if (command.startsWith('design_server_')) {
    return {
      port: designPort,
      listening: true,
      managed: false,
      foreign: false,
      stale: false,
      exited: false,
      log: [],
    };
  }

  throw new Error(`verify-studio-headless: host command ${command} is not stubbed`);
};

/**
 * The design server listens on `::1` only, so every address here is `[::1]`: `localhost` and `127.0.0.1` are refused from Node.
 * Builds Studio into a scratch folder, runs a design server and a static server of its own on free ports, and
 * calls `run({ page, studioUrl, designPort, restartDesign })` in headless Chromium with a stubbed desktop shell. Stops only
 * what it started. `built` serves an existing Studio build folder instead of building one. `restartDesign(downMs)` stops
 * the design server, leaves its port refused for `downMs`, and starts a new one; pin the port with DE_PORT to keep it.
 * `chrome: { value, delayMs }` answers `window_chrome_watch` with `value` after `delayMs`, like the desktop shell does;
 * without it the stubbed shell has no window chrome and Studio draws no title bar.
 */
export const withStudio = async (run, { checkout = root, build = true, built, chrome } = {}) => {
  const startedAt = Date.now();
  const stamp = (phase) => console.log(phaseLine(phase, startedAt));
  const scratch = mkdtempSync(join(tmpdir(), 'studio-headless-'));
  const servers = [];
  let design;
  let browser;

  try {
    ensureCli();

    if (build && !built) buildStudio(scratch, stamp);

    design = await startDesignServer(checkout, stamp);

    const app = serveStatic(join(built ?? scratch, 'browser'));
    servers.push(app);
    const studioPort = await listen(app);

    stamp('chromium launching');
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ args: ['--disable-features=LocalNetworkAccessChecks'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    stamp('chromium launched');

    await page.exposeFunction('__studioHost', (command) => studioHostAnswer(command, checkout, design.port));
    await page.addInitScript((chrome) => {
      const callbacks = new Map();
      let lastCallback = 0;
      window.__TAURI_INTERNALS__ = {
        invoke: (command, args) => {
          if (command === 'window_chrome_watch' && chrome) {
            setTimeout(
              () => callbacks.get(args.changes.id)?.({ index: 0, message: chrome.value }),
              chrome.delayMs ?? 0,
            );

            return Promise.resolve(null);
          }

          return window.__studioHost(command, args);
        },
        transformCallback: (callback) => {
          lastCallback += 1;
          callbacks.set(lastCallback, callback);

          return lastCallback;
        },
        unregisterCallback: (id) => callbacks.delete(id),
        convertFileSrc: (path) => path,
        metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      };
    }, chrome ?? null);

    const restartDesign = async (downMs) => {
      const stopped = design.child;

      design = null;
      stopped.removeAllListeners('exit');
      if (stopped.exitCode === null) {
        await new Promise((done) => {
          stopped.once('exit', done);
          stopped.kill('SIGTERM');
        });
      }
      await new Promise((done) => setTimeout(done, downMs));
      design = await startDesignServer(checkout, stamp);
    };

    stamp('first case starting');
    return await run({ page, studioUrl: `http://[::1]:${studioPort}`, designPort: design.port, restartDesign });
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
