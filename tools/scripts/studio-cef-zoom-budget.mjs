#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { CANVAS } from '../../apps/ethlete-studio/e2e/probe-helpers.mjs';
import { FRAME, measureZoom, ZOOM_BUDGET } from '../../apps/ethlete-studio/e2e/zoom-budget.mjs';
import { serveStatic } from './verify-studio-headless.mjs';

const USAGE =
  'usage: node tools/scripts/studio-cef-zoom-budget.mjs --checkout <zoom fixture checkout> [--build <studio build dir, Linux only>] [--runs 3] [--screen 1920x1080] [--chromium-flags "<flags>"] [--binary <host binary>]';
const root = resolve(fileURLToPath(import.meta.url), '../../..');
const macOS = process.platform === 'darwin';
const debugDir = join(root, 'apps/ethlete-studio/src-tauri/target/debug');
const DEV_URL_PORT = Number(
  JSON.parse(readFileSync(join(root, 'apps/ethlete-studio/src-tauri/tauri.conf.json'), 'utf8'))
    .build.devUrl.split(':')
    .pop(),
);
const CDP_PORT = 9333;
const args = process.argv.slice(2);
const value = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const NAMESPACED = 'STUDIO_CEF_ZOOM_NAMESPACED';
const VIEW_KEY = 'ethlete-studio.call-view';
const READY_MS = 120000;
const CELLS_MS = Number(value('--cells-ms', 240000));
const binary = value(
  '--binary',
  macOS
    ? join(debugDir, 'bundle/macos/Ethlete Studio.app/Contents/MacOS/ethlete-studio')
    : join(debugDir, 'ethlete-studio'),
);

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// The debug host loads the devUrl port on localhost; a network namespace of its own keeps that port and the CDP
// port away from a dev server the user runs. Chromium refuses uid 0, so the inner namespace maps back to the own uid.
const reExecNamespaced = () => {
  const { status } = spawnSync(
    'unshare',
    [
      '-rn',
      'sh',
      '-c',
      `ip link set lo up && exec unshare -U --map-user=${process.getuid()} --map-group=${process.getgid()} "$0" "$@"`,
      process.execPath,
      fileURLToPath(import.meta.url),
      ...args,
    ],
    { stdio: 'inherit', env: { ...process.env, [NAMESPACED]: '1' } },
  );

  process.exit(status ?? 1);
};

const killGroup = (pid) => {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // The group is already gone.
  }
};

const launchHost = (checkout, screen, flags) => {
  const home = mkdtempSync(join(tmpdir(), 'studio-cef-zoom-'));
  const stderrFile = join(home, 'stderr.log');
  const stderrFd = openSync(stderrFile, 'w');
  const [command, ...commandArgs] = macOS
    ? [binary, ...flags]
    : ['xvfb-run', '-a', '-s', `-screen 0 ${screen}x24`, binary, ...flags];
  const child = spawn(command, commandArgs, {
    cwd: root,
    detached: true,
    stdio: ['ignore', stderrFd, stderrFd],
    env: {
      ...process.env,
      XDG_CACHE_HOME: join(home, 'cache'),
      XDG_CONFIG_HOME: join(home, 'config'),
      XDG_DATA_HOME: join(home, 'data'),
      XDG_STATE_HOME: join(home, 'state'),
      ETHLETE_STUDIO_CDP_PORT: String(CDP_PORT),
      ETHLETE_STUDIO_OPEN_ROOT: checkout,
      ETHLETE_STUDIO_CONSOLE_LOG: join(home, 'console.log'),
    },
  });

  closeSync(stderrFd);

  return { child, home, stderrTail: () => readFileSync(stderrFile, 'utf8').slice(-3000) };
};

const connect = async () => {
  const deadline = Date.now() + READY_MS;

  for (;;) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await wait(500);
    }
  }
};

const studioPage = async (browser) => {
  const deadline = Date.now() + READY_MS;

  for (;;) {
    const page = browser
      .contexts()
      .flatMap((context) => context.pages())
      .find((candidate) => candidate.url().includes(macOS ? '//tauri.localhost' : `:${DEV_URL_PORT}`));

    if (page) return page;
    if (Date.now() > deadline) throw new Error('no Studio page in the CEF host');
    await wait(500);
  }
};

const FOLDED = '[data-sk-folded] button[aria-expanded="false"]';

const cellsShown = async (page) => {
  const deadline = Date.now() + CELLS_MS;
  let last = '';
  let stableSince = Date.now();

  for (;;) {
    await page.evaluate((FOLDED) => document.querySelector(FOLDED)?.click(), FOLDED);

    const state = await page.evaluate(
      ({ FRAME, CANVAS }) => ({
        cells: document.querySelectorAll(`ethlete-sketch-view ${FRAME}`).length,
        pending: document.querySelectorAll('[data-sk-changed="pending"], [data-sk-row][data-sk-unsized]').length,
        layout: [...(document.querySelector(CANVAS)?.querySelectorAll(FRAME) ?? [])]
          .map((frame) => Object.values(frame.getBoundingClientRect().toJSON()).map(Math.round).join())
          .join(' '),
      }),
      { FRAME, CANVAS },
    );
    const key = `${state.cells}|${state.pending}|${state.layout}`;

    if (key !== last) {
      last = key;
      stableSince = Date.now();
    }
    if (state.cells >= ZOOM_BUDGET.cells && !state.pending && Date.now() - stableSince > 3000) return state.cells;
    if (Date.now() > deadline) throw new Error(`${state.cells} cells, ${state.pending} pending after ${CELLS_MS} ms`);
    await wait(250);
  }
};

const main = async () => {
  const build = value('--build');
  const checkout = value('--checkout');

  if ((!build && !macOS) || !checkout) throw new Error(USAGE);

  const runs = Number(value('--runs', 3));
  const screen = value('--screen', '1920x1080');
  const flags = value('--chromium-flags', '').split(' ').filter(Boolean);
  const server = macOS ? undefined : serveStatic(resolve(build, 'browser'));

  if (server) await new Promise((done) => server.listen(DEV_URL_PORT, '::', done));

  const host = launchHost(resolve(checkout), screen, flags);
  let browser;
  let page;

  try {
    browser = await connect();
    page = await studioPage(browser);
    const view = {
      checkout: resolve(checkout),
      systemProduct: 'studio',
      systemEntry: 'sketch:pages/system@zoom-budget',
    };

    await page.evaluate(([key, view]) => localStorage.setItem(key, JSON.stringify(view)), [VIEW_KEY, view]);
    await page.reload();
    const start = page.getByRole('button', { name: /starten/i }).first();
    const shown = await Promise.race([
      start.waitFor({ timeout: READY_MS }).then(() => 'start'),
      page
        .locator(FOLDED)
        .first()
        .waitFor({ timeout: READY_MS })
        .then(() => 'folded'),
      page
        .locator(`ethlete-sketch-view ${FRAME}`)
        .first()
        .waitFor({ timeout: READY_MS })
        .then(() => 'frames'),
    ]);

    if (shown === 'start') await start.click();

    const cells = await cellsShown(page);
    const setup = await page.evaluate(async () => {
      const gl = document.createElement('canvas').getContext('webgl');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');

      return {
        viewport: `${innerWidth}x${innerHeight}`,
        dpr: devicePixelRatio,
        renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'no webgl',
        userAgent: navigator.userAgent,
      };
    });
    const browserVersion = browser.version();
    const gpu = await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo').catch(() => null);

    console.log(
      JSON.stringify({
        setup: {
          ...setup,
          browserVersion,
          screen,
          flags,
          gpuFeatures: gpu?.gpu?.featureStatus,
          gpuDevice: gpu?.gpu?.devices?.[0],
        },
      }),
    );
    for (let run = 1; run <= runs; run++) {
      const result = await measureZoom(page, cells);

      console.log(JSON.stringify({ run, ...result }));
    }
  } catch (error) {
    const shot = join(tmpdir(), 'studio-cef-zoom-failure.png');
    const shown = await page
      ?.evaluate(() => `${location.href}\n${document.body.innerText.slice(0, 600)}`)
      .catch((reason) => `page unreadable: ${reason.message}`);

    await page?.screenshot({ path: shot }).catch(() => undefined);
    console.error(`${error.message}\npage ${shown}\nscreenshot ${shot}\nhost stderr:\n${host.stderrTail()}`);
    process.exitCode = 1;
  } finally {
    killGroup(host.child.pid);
    server?.close();
    if (process.exitCode) console.error(`host home kept: ${host.home}`);
    else rmSync(host.home, { recursive: true, force: true });
  }
};

if (!['linux', 'darwin'].includes(process.platform)) throw new Error('the CEF zoom measurement runs on Linux or macOS');
if (macOS || process.env[NAMESPACED]) await main();
else reExecNamespaced();
