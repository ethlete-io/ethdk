import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  listen,
  missingBuildInputs,
  serveStatic,
  startDesignServer,
  studioHostAnswer,
  webkitVerdict,
} from './verify-studio-headless.mjs';

const root = resolve(import.meta.dirname, '../..');
const swift = resolve(root, 'tools/scripts/verify-webkit-studio.swift');
const args = process.argv.slice(2);
const value = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const checkout = resolve(value('--checkout', root));
const built = value('--built');
const checks = value('--checks', 'frame-wheel,soak,edges,paint').split(',');
const pngDir = resolve(value('--png-dir', join(tmpdir(), 'webkit-studio-shots')));
const soakBatches = value('--soak-batches', '600');
const paintHangs = value('--paint-hangs', '24');
const SOAK_FRAMES = [
  '/frame.html?product=studio&part=pages/start&state=no-repo',
  '/frame.html?product=studio&part=pages/start&state=no-products',
  '/frame.html?product=studio&part=pages/system&state=part',
  '/frame.html?product=studio&part=pages/sketches&state=page-sketch',
  '/frame.html?product=studio&part=pages/merge&state=open',
  '/frame.html?product=studio&part=pages/flows&state=flow',
];
const VIEW = { checkout, systemProduct: 'studio', systemEntry: 'pages/system' };
const PAINT_VIEW = { checkout, systemProduct: 'sdk', systemEntry: 'components/textarea' };

const freePort = () =>
  new Promise((done, fail) => {
    const probe = createServer();
    probe.on('error', fail);
    probe.listen(0, '::1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });

const readBody = async (request) => {
  let body = '';
  for await (const chunk of request) body += chunk;

  return JSON.parse(body);
};

const runSwift = (...given) =>
  new Promise((done) => {
    const child = spawn('swift', [swift, ...given.map(String)], { stdio: 'inherit' });
    child.on('exit', (status) => done(status ?? 1));
  });

const stamp = (phase) => console.log(`[webkit-studio] ${phase}`);
const statuses = {};
const finish = () => {
  const { exit, lines } = webkitVerdict(statuses);

  for (const line of lines) console.error(line);
  process.exit(exit);
};

if (checks.includes('frame-wheel')) {
  stamp('frame-wheel starting');
  statuses['frame-wheel'] = await runSwift('frame-wheel');
}

const studioChecks = checks.filter((check) => check !== 'frame-wheel');

if (!studioChecks.length) finish();

const scratch = mkdtempSync(join(tmpdir(), 'webkit-studio-'));
let design;
let app;

try {
  const missing = missingBuildInputs(checkout);

  if (missing.length) throw new Error(`build inputs missing:\n${missing.join('\n')}`);

  if (!built && studioChecks.some((check) => check !== 'soak')) {
    stamp('studio build starting');
    execFileSync(
      'npx',
      ['nx', 'build', 'ethlete-studio', `--outputPath=${scratch}`, '--excludeTaskDependencies', '--skip-nx-cache'],
      { cwd: root, stdio: 'inherit', env: { ...process.env, NX_NO_CLOUD: 'true' } },
    );
  }

  process.env['DE_PORT'] ??= String(await freePort());
  process.env['ETHLETE_DESIGN_SLOW_CHECKS'] ??= 'off';
  design = await startDesignServer(checkout, stamp);
  const designUrl = `http://localhost:${design.port}/`;

  app = serveStatic(join(built ? resolve(built) : scratch, 'browser'), async (request, response) => {
    if (request.url !== '/__host') return false;
    try {
      const { command } = await readBody(request);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify((await studioHostAnswer(command, checkout, design.port)) ?? null));
    } catch (error) {
      response.statusCode = 500;
      response.end(String(error.message));
    }

    return true;
  });
  const studioUrl = `http://localhost:${await listen(app)}/`;

  for (const check of studioChecks) {
    stamp(`${check} starting`);
    const status =
      check === 'soak'
        ? await runSwift('soak', designUrl, soakBatches, ...SOAK_FRAMES, ...SOAK_FRAMES)
        : check === 'edges'
          ? await runSwift('edges', studioUrl, JSON.stringify(VIEW))
          : await runSwift('paint', studioUrl, JSON.stringify(PAINT_VIEW), paintHangs, pngDir);

    statuses[check] = status;
  }
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  statuses['setup'] = 1;
} finally {
  app?.close();
  design?.child.removeAllListeners('exit');
  design?.child.kill('SIGTERM');
  rmSync(scratch, { recursive: true, force: true });
}

finish();
