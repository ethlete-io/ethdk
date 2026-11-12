import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { loadPassTriggers, pinnedCommand, startBusyLoops } from './ci-like-load.mjs';

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
