import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { tempDir } from './temp-dir.mjs';
import {
  buildStudio,
  designChildState,
  designProject,
  ensureLibBuilds,
  linkWorkspaceDist,
  missingBuildInputs,
  serveOnlyAnswer,
  startDesignServer,
  studioHostAnswer,
  WEBKIT_BLIND_EXIT,
  webkitVerdict,
} from './verify-studio-headless.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const appSource = join(root, 'apps/ethlete-studio/src');

const invokedHostCommands = () =>
  new Set(
    readdirSync(appSource, { recursive: true })
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .flatMap((file) =>
        [
          ...readFileSync(join(appSource, file), 'utf8').matchAll(/\binvoke(?:Host\$)?(?:<[^(]*>)?\(\s*'([\w:|]+)'/g),
        ].map((match) => match[1]),
      ),
  );

test('names each missing build input with the command that builds it', () => {
  const checkout = tempDir('studio-headless-inputs-');
  const entry = join(checkout, 'cli.js');

  assert.deepEqual(missingBuildInputs(checkout, entry), [
    `${entry} is missing - run npx nx build cli`,
    `${join(checkout, 'dist/libs/components/package.json')} is missing - run npx nx build components`,
  ]);
});

test('answers nothing when both builds exist', () => {
  const checkout = tempDir('studio-headless-inputs-');
  const entry = join(checkout, 'cli.js');

  mkdirSync(join(checkout, 'dist/libs/components'), { recursive: true });
  writeFileSync(entry, '');
  writeFileSync(join(checkout, 'dist/libs/components/package.json'), '{}');

  assert.deepEqual(missingBuildInputs(checkout, entry), []);
});

test('builds the design libs a fresh checkout lacks before the design server renders from them', () => {
  const checkout = tempDir('studio-headless-libs-');
  const runs = [];

  mkdirSync(join(checkout, 'dist/libs/core'), { recursive: true });
  writeFileSync(join(checkout, 'dist/libs/core/package.json'), '{}');

  assert.deepEqual(ensureLibBuilds(checkout, { run: (...args) => runs.push(args.slice(0, 2)), log: () => undefined }), [
    'components',
  ]);
  assert.deepEqual(runs, [['npx', ['nx', 'run-many', '-t', 'build', '-p', 'components']]]);
});

test('builds nothing when every design lib is built', () => {
  const checkout = tempDir('studio-headless-libs-');
  const runs = [];

  for (const lib of ['core', 'components']) {
    mkdirSync(join(checkout, 'dist/libs', lib), { recursive: true });
    writeFileSync(join(checkout, 'dist/libs', lib, 'package.json'), '{}');
  }

  assert.deepEqual(ensureLibBuilds(checkout, { run: (...args) => runs.push(args), log: () => undefined }), []);
  assert.deepEqual(runs, []);
});

const linkedCopy = () => {
  const workspace = tempDir('studio-headless-workspace-');
  const checkout = tempDir('studio-headless-linked-');

  writeFileSync(join(workspace, 'nx.json'), '{}');
  symlinkSync(join(workspace, 'nx.json'), join(checkout, 'nx.json'));

  return { workspace, checkout };
};

test('links the workspace dist into a linked copy made before dist existed', () => {
  const { workspace, checkout } = linkedCopy();

  mkdirSync(join(workspace, 'dist/libs/cli'), { recursive: true });
  linkWorkspaceDist(checkout, workspace);

  assert.equal(realpathSync(join(checkout, 'dist')), realpathSync(join(workspace, 'dist')));
});

test('links no dist into a checkout that is not a linked copy of the workspace', () => {
  const workspace = tempDir('studio-headless-workspace-');
  const checkout = tempDir('studio-headless-own-');

  writeFileSync(join(workspace, 'nx.json'), '{}');
  writeFileSync(join(checkout, 'nx.json'), '{}');
  mkdirSync(join(workspace, 'dist'));
  linkWorkspaceDist(checkout, workspace);

  assert.equal(existsSync(join(checkout, 'dist')), false);
});

test('calls a WebKit run blind, not failed, when only the wheel control got no event', () => {
  assert.deepEqual(webkitVerdict({ 'frame-wheel': WEBKIT_BLIND_EXIT, soak: 0 }), {
    exit: WEBKIT_BLIND_EXIT,
    lines: ['BLIND: frame-wheel - the wheel control got no event, so the run proves nothing'],
  });
});

test('still fails a WebKit run when another check failed next to a blind one', () => {
  const verdict = webkitVerdict({ 'frame-wheel': WEBKIT_BLIND_EXIT, paint: 1 });

  assert.equal(verdict.exit, 1);
  assert.deepEqual(verdict.lines, [
    'FAIL: paint',
    'BLIND: frame-wheel - the wheel control got no event, so the run proves nothing',
  ]);
});

test('passes a WebKit run only when every check passed', () => {
  assert.deepEqual(webkitVerdict({ 'frame-wheel': 0, edges: 0 }), { exit: 0, lines: [] });
});

test('answers every host command the app invokes', async () => {
  const commands = invokedHostCommands();
  const unanswered = [];

  assert.ok(commands.has('design_project'), `found no design_project invoke among ${[...commands].join(', ')}`);
  for (const command of commands) {
    await studioHostAnswer(command, root, 4402).catch((error) => unanswered.push(`${command}: ${error.message}`));
  }

  assert.deepEqual(unanswered, []);
});

test('gives a product view the themes the app gives it', () => {
  const config = JSON.parse(readFileSync(join(root, '.ethlete/design/config.json'), 'utf8'));
  const themed = Object.entries(config.projects).filter(([, project]) => project.themes);
  const project = designProject(root, 4999);

  assert.ok(themed.length > 0, 'the design config themes no project');
  assert.equal(project.port, 4999);
  assert.ok(project.calls.length > 0, 'the project has no calls');
  assert.deepEqual(Object.keys(project.themes).sort(), themed.map(([name]) => name).sort());
  for (const [name, { themes }] of themed) assert.deepEqual(project.themes[name], themes);
});

test('reads the port from the coloured ready banner a real vite run prints', async () => {
  const dir = tempDir('design-banner-');
  const entry = join(dir, 'fake-cli.cjs');
  const banner = join(import.meta.dirname, 'fixtures', 'vite-dev-ready-color.txt');

  writeFileSync(
    entry,
    `process.stdout.write(require('node:fs').readFileSync(${JSON.stringify(banner)}, 'utf8')); setInterval(() => undefined, 1000);`,
  );

  const { child, port } = await startDesignServer(dir, () => undefined, false, entry);

  child.kill('SIGTERM');
  assert.equal(port, 5199);
});

test('moves a taken pinned DE_PORT to a free port instead of failing the run', async () => {
  const dir = tempDir('design-port-');
  const entry = join(dir, 'fake-cli.cjs');
  const held = createServer();
  const heldPort = await new Promise((done) => held.listen(0, () => done(held.address().port)));
  const pinned = process.env['DE_PORT'];

  writeFileSync(
    entry,
    `const port = process.env.DE_PORT;
if (port === '${heldPort}') { console.log('Port ' + port + ' is already in use'); process.exitCode = 1; }
else { console.log('  Local:   http://localhost:' + port + '/'); setInterval(() => undefined, 1000); }`,
  );
  process.env['DE_PORT'] = String(heldPort);

  try {
    const { child, port } = await startDesignServer(dir, () => undefined, false, entry);

    child.kill('SIGTERM');
    assert.notEqual(port, heldPort);
    assert.equal(process.env['DE_PORT'], String(port));
  } finally {
    held.close();
    if (pinned === undefined) delete process.env['DE_PORT'];
    else process.env['DE_PORT'] = pinned;
  }
});

const withServeOnly = async (answer, run) => {
  const dir = tempDir('studio-serve-only-');
  const { createServer } = await import('node:http');

  writeFileSync(join(dir, 'index.html'), '<html><head></head><body></body></html>');
  const server = createServer(async (request, response) => {
    if (!(await serveOnlyAnswer(dir, answer, { checkout: '/c' })(request, response))) response.end('static');
  });

  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
};

test('serve-only forwards a host command to the answer and returns its value', async () => {
  await withServeOnly(
    async (command) => (command === 'workspace_root' ? '/c' : null),
    async (url) => {
      const post = (command) => fetch(`${url}/__host`, { method: 'POST', body: JSON.stringify({ command }) });

      assert.deepEqual(await (await post('workspace_root')).json(), { value: '/c' });
      assert.deepEqual(await (await post('update_ready')).json(), { value: null });
    },
  );
});

test('serve-only answers 500 with the message when the host command throws', async () => {
  await withServeOnly(
    async () => {
      throw new Error('not stubbed');
    },
    async (url) => {
      const response = await fetch(`${url}/__host`, { method: 'POST', body: JSON.stringify({ command: 'x' }) });

      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'not stubbed' });
    },
  );
});

test('serve-only injects the shim script into index.html and preselects the view', async () => {
  await withServeOnly(
    async () => null,
    async (url) => {
      assert.match(await (await fetch(`${url}/some/route`)).text(), /<head><script src="\/__studio-serve-only.js">/);
      const script = await (await fetch(`${url}/__studio-serve-only.js`)).text();

      assert.match(script, /__TAURI_INTERNALS__/);
      assert.match(script, /ethlete-studio\.call-view/);
    },
  );
});

const studioBuildRun = (lockFile, module = './verify-studio-headless.mjs') => {
  const env = { ...process.env, ETHLETE_HEAVY_LOCK_FILE: lockFile, NX_DAEMON: 'false', NX_NO_CLOUD: 'true' };

  delete env['ETHLETE_HEAVY_RUN_HELD'];
  delete env['ETHLETE_HEAVY_MAX_WAIT_MS'];
  delete env['ETHLETE_HEAVY_POLL_MS'];
  const script = `
    const { buildStudio } = await import(${JSON.stringify(new URL(module, import.meta.url).href)});
    await buildStudio('/nonexistent-studio-build', console.log, {
      maxWaitMs: 1500,
      pollMs: 100,
      run: () => console.log('nx build ran'),
    });
  `;

  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 45_000,
  });
};

test('a studio build waits in the open while a heavy run holds the lock and gives up with its holder', () => {
  const dir = tempDir('studio-build-wait-');
  const lockFile = join(dir, 'ethlete-heavy-run.lock');

  writeFileSync(lockFile, JSON.stringify({ pid: process.pid, name: 'studio:e2e', started: Date.now() }));
  const startedAt = Date.now();
  const run = studioBuildRun(lockFile);

  assert.notEqual(run.signal, 'SIGTERM', `the build hung past 45s:\n${run.stdout}${run.stderr}`);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /studio build: waiting for studio:e2e/);
  assert.match(run.stderr, /heavy run lock held by studio:e2e .*still after 2s; run again after it ends/);
  assert.doesNotMatch(run.stdout, /nx build ran/);
  assert.ok(Date.now() - startedAt < 15_000);
});

test('a studio build runs Nx without its wait hook once the heavy-run lock is free', async () => {
  const dir = tempDir('studio-build-free-');
  const calls = [];
  const lines = [];

  await buildStudio(join(dir, 'out'), (line) => lines.push(line), {
    env: { ETHLETE_HEAVY_LOCK_FILE: join(dir, 'ethlete-heavy-run.lock') },
    pollMs: 10,
    run: (command, args, options) => calls.push({ command, args, env: options.env }),
  });

  assert.deepEqual(lines, ['studio build starting', 'studio build done']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].env['NX_DAEMON'], 'false');
  assert.equal(calls[0].env['ETHLETE_HEAVY_NO_WAIT'], 'true');
});

test('designChildState names a live child, an exited child and the last output lines', async () => {
  const lines = Array.from({ length: 50 }, (_, index) => `line ${index}`).join('\n');

  assert.match(
    await designChildState(
      Object.assign(new EventEmitter(), { pid: 7, exitCode: null, signalCode: null, output: 'ready' }),
    ),
    /pid 7 alive.*\nready$/s,
  );
  const exited = await designChildState({ pid: 7, exitCode: null, signalCode: 'SIGKILL', output: lines });

  assert.match(exited, /exited, code null, signal SIGKILL/);
  assert.match(exited, /line 49$/);
  assert.doesNotMatch(exited, /line 9\n/);
  assert.match(await designChildState(undefined), /no design child.*\n\(none\)$/s);
});
