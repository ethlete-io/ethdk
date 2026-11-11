import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { e2eLoadStep, loadPassTriggers, pinnedCommand, startBusyLoops } from './ci-like-load.mjs';

const harness = () => {
  const calls = [];
  const busy = [];
  return {
    calls,
    busy,
    options: {
      runner: '/export/apps/ethlete-studio/e2e/canvas.e2e.mjs',
      run: async (command, args) => {
        calls.push({ command, args, loopsRunning: busy.filter((loop) => !loop.stopped).length });
        return { status: 0, output: '' };
      },
      busy: async (count, { taskset }) => {
        const loop = { count, taskset, stopped: false };
        busy.push(loop);
        return {
          ok: true,
          stop: () => {
            loop.stopped = true;
          },
        };
      },
    },
  };
};

test('a design server change runs one shard on 2 workers, pinned to 4 cores, while the busy loops run', async () => {
  const { calls, busy, options } = harness();
  const result = await e2eLoadStep(['libs/cli/src/lib/design/serve.ts'], { ...options, taskset: true });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'taskset');
  assert.deepEqual(calls[0].args.slice(0, 3), ['--cpu-list', '0-3', process.execPath]);
  assert.deepEqual(calls[0].args.slice(3), [options.runner, '--workers', '2', '--shard', '1/6', '--no-timings']);
  assert.equal(calls[0].loopsRunning, 1);
  assert.deepEqual(busy, [{ count: 12, taskset: true, stopped: true }]);
  assert.match(result.note, /CI-like: shard 1\/6, 2 workers, 12 busy loops, pinned to cores 0-3/);
});

test('without taskset the pass runs unpinned and says so', async () => {
  const { calls, options } = harness();
  const result = await e2eLoadStep(['libs/cli/src/lib/design/serve.ts'], { ...options, taskset: false });

  assert.equal(calls[0].command, process.execPath);
  assert.match(result.note, /ran unpinned: no taskset/);
});

test('a range without a design server change runs no load pass', async () => {
  const { calls, busy, options } = harness();
  const result = await e2eLoadStep(['libs/cli/src/lib/other.ts', 'apps/ethlete-studio/src/a.ts'], options);

  assert.deepEqual(calls, []);
  assert.deepEqual(busy, []);
  assert.equal(result.status, 0);
  assert.match(result.note, /no change under libs\/cli\/src\/lib\/design\//);
});

test('a failed pass keeps its status and still stops the busy loops', async () => {
  const { busy, options } = harness();
  const result = await e2eLoadStep(['libs/cli/src/lib/design/a.ts'], {
    ...options,
    taskset: true,
    run: async () => ({ status: 1, output: 'sketch fixture check could not list the sketches' }),
  });

  assert.equal(result.status, 1);
  assert.equal(busy[0].stopped, true);
});

test('pins a command with taskset and leaves it alone without', () => {
  assert.deepEqual(pinnedCommand('node', ['x'], { taskset: true, cores: '0-3' }).args, [
    '--cpu-list',
    '0-3',
    'node',
    'x',
  ]);
  assert.deepEqual(pinnedCommand('node', ['x'], { taskset: false }), {
    command: 'node',
    args: ['x'],
    note: 'ran unpinned: no taskset on this machine',
  });
  assert.deepEqual(loadPassTriggers(['libs/cli/src/lib/design/x.ts', 'libs/cli/src/y.ts']), [
    'libs/cli/src/lib/design/x.ts',
  ]);
});

test('a second load generator refuses while the first holds the heavy run lock, and starts once it is released', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-like-load-lock-'));
  const lock = (env) => ({ file: join(dir, 'heavy.lock'), wait: false, env, log: () => undefined });
  try {
    const first = await startBusyLoops(1, { taskset: false, lock: lock({}) });
    assert.equal(first.ok, true);

    const second = await startBusyLoops(1, { taskset: false, lock: lock({}) });
    assert.equal(second.ok, false);
    assert.equal(second.holder.name, 'ci-like-load');

    first.stop();
    const third = await startBusyLoops(1, { taskset: false, lock: lock({}) });
    assert.equal(third.ok, true);
    third.stop();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the push suite pass refuses to start its load while another run holds the lock', async () => {
  const { calls, options } = harness();
  const result = await e2eLoadStep(['libs/cli/src/lib/design/serve.ts'], {
    ...options,
    taskset: true,
    busy: async () => ({ ok: false, holder: { pid: 1, name: 'push-suite', started: 0 } }),
  });

  assert.deepEqual(calls, []);
  assert.equal(result.status, 1);
  assert.match(result.note, /no load started: heavy run lock held by push-suite/);
});
