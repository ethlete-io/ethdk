import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { tempDir } from './temp-dir.mjs';
import {
  designProject,
  missingBuildInputs,
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
