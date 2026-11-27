import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { runStep } from './push-suite.mjs';
import { ENDED_KEEP_MS, listRuns, registerRun } from './run-registry.mjs';
import { tempDir } from './temp-dir.mjs';

const entriesIn = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')));

test('registerRun writes one entry per run with machine, log and pid; finish records the exit code', () => {
  const dir = tempDir('run-registry-');
  const env = { RUN_REGISTRY_DIR: dir };
  const run = registerRun({ machine: 'rack', label: 'remote-run yarn e2e', command: 'yarn e2e', env });

  const [open] = entriesIn(dir);
  assert.equal(open.machine, 'rack');
  assert.equal(open.pid, process.pid);
  assert.equal(open.log, join(dir, `${run.id}.log`));
  assert.equal(open.endedAt, undefined);

  run.finish(3);
  const [ended] = entriesIn(dir);
  assert.equal(ended.exitCode, 3);
  assert.equal(typeof ended.endedAt, 'number');
});

test('listRuns deletes entries of dead processes and entries ended over an hour ago, with their own logs', () => {
  const dir = tempDir('run-registry-');
  const env = { RUN_REGISTRY_DIR: dir };
  const now = Date.now();
  const write = (entry) => writeFileSync(join(dir, `${entry.id}.json`), JSON.stringify(entry));
  write({ id: 'dead', pid: 111, log: join(dir, 'dead.log') });
  writeFileSync(join(dir, 'dead.log'), 'x');
  write({ id: 'live', pid: 222, log: '/elsewhere/live.log' });
  write({ id: 'old', pid: 222, endedAt: now - ENDED_KEEP_MS - 1 });
  write({ id: 'recent', pid: 111, endedAt: now - 1000 });

  const kept = listRuns({ env, now, alive: (pid) => pid === 222 });

  assert.deepEqual(kept.map((e) => e.id).sort(), ['live', 'recent']);
  assert.deepEqual(
    entriesIn(dir)
      .map((e) => e.id)
      .sort(),
    ['live', 'recent'],
  );
  assert.equal(existsSync(join(dir, 'dead.log')), false);
});

test('heavy.mjs registers its run on this machine and tees the output and the slot to the log', () => {
  const dir = tempDir('run-registry-heavy-');
  const result = spawnSync(
    process.execPath,
    [new URL('./heavy.mjs', import.meta.url).pathname, 'run', '--', 'sh', '-c', 'echo unit-out; exit 4'],
    {
      encoding: 'utf8',
      env: { ...process.env, HEAVY_LOCK_PREFIX: join(dir, 'lock'), RUN_REGISTRY_DIR: dir, RUN_MACHINE: 'tank' },
    },
  );
  assert.equal(result.status, 4);
  assert.match(result.stdout, /unit-out/);

  const [entry] = entriesIn(dir);
  assert.equal(entry.machine, 'tank');
  assert.equal(entry.exitCode, 4);
  assert.match(entry.label, /^heavy sh -c echo unit-out/);
  assert.match(readFileSync(entry.log, 'utf8'), /\[heavy\] slot 1\nunit-out\n/);
});

test('push-suite runStep registers each step with a log of its output', async () => {
  const dir = tempDir('run-registry-push-');
  const previous = process.env['RUN_REGISTRY_DIR'];
  process.env['RUN_REGISTRY_DIR'] = dir;
  try {
    const step = await runStep(process.execPath, ['-e', 'console.log("step-out"); process.exit(2)'], dir);
    assert.equal(step.status, 2);

    const [entry] = entriesIn(dir);
    assert.match(entry.label, /^push-suite \S+ -e /);
    assert.equal(entry.exitCode, 2);
    assert.equal(readFileSync(entry.log, 'utf8'), 'step-out\n');
  } finally {
    if (previous === undefined) delete process.env['RUN_REGISTRY_DIR'];
    else process.env['RUN_REGISTRY_DIR'] = previous;
  }
});

test('run-registry.mjs track registers a light run', () => {
  const dir = tempDir('run-registry-track-');
  const result = spawnSync(
    process.execPath,
    [new URL('./run-registry.mjs', import.meta.url).pathname, 'track', '--', 'sh', '-c', 'echo ok 1 - a'],
    { encoding: 'utf8', env: { ...process.env, RUN_REGISTRY_DIR: dir, RUN_MACHINE: 'mac' } },
  );
  assert.equal(result.status, 0);
  const [entry] = entriesIn(dir);
  assert.equal(entry.machine, 'mac');
  assert.equal(entry.exitCode, 0);
  assert.equal(readFileSync(entry.log, 'utf8'), 'ok 1 - a\n');
});

test('registerRun records the Claude session id of the starting session, and none for a plain shell', () => {
  const dir = tempDir('run-registry-');
  registerRun({ label: 'a', command: 'a', env: { RUN_REGISTRY_DIR: dir, CLAUDE_CODE_SESSION_ID: 'sess-1' } });
  assert.equal(entriesIn(dir)[0].sessionId, 'sess-1');

  const plain = tempDir('run-registry-');
  registerRun({ label: 'b', command: 'b', env: { RUN_REGISTRY_DIR: plain } });
  assert.equal('sessionId' in entriesIn(plain)[0], false);
});
