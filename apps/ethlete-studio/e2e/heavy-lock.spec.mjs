import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../../..');

test('studio:e2e refuses at once while another run holds the heavy run lock', () => {
  const dir = mkdtempSync(join(tmpdir(), 'heavy-lock-spec-'));

  try {
    writeFileSync(
      join(dir, 'ethlete-heavy-run.lock'),
      JSON.stringify({ pid: process.pid, name: 'push-suite', started: Date.now() }),
    );
    const env = { ...process.env, TMPDIR: dir };

    delete env['ETHLETE_HEAVY_RUN_HELD'];
    const startedAt = Date.now();
    const run = spawnSync(process.execPath, ['apps/ethlete-studio/e2e/canvas.e2e.mjs', '--no-wait-lock'], {
      cwd: root,
      env,
      encoding: 'utf8',
      timeout: 60_000,
    });

    assert.equal(run.status, 2, `${run.stdout}${run.stderr}`);
    assert.match(run.stderr, /heavy run lock held by push-suite/);
    assert.ok(Date.now() - startedAt < 15_000, 'a refused run starts no server');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
