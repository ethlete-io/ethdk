import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), 'remote-guard.sh');

const runGuard = (home, slot, log, tag) =>
  new Promise((resolve) => {
    const script = `. ${GUARD}; rr_guard ${slot} bash -c 'echo ${tag}-start >> ${log}; sleep 1; echo ${tag}-end >> ${log}'`;
    const child = spawn('bash', ['-c', script], { env: { ...process.env, HOME: home, RR_HEARTBEAT_S: '1' } });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.on('close', () => resolve(out));
  });

const events = (log) => readFileSync(log, 'utf8').trim().split('\n');

test('two guards on the same slot run one after the other', async () => {
  const home = mkdtempSync(join(tmpdir(), 'rr-guard-'));
  const log = join(home, 'log');
  try {
    const [a, b] = await Promise.all([runGuard(home, 'w1', log, 'a'), runGuard(home, 'w1', log, 'b')]);
    const order = events(log);
    assert.equal(order[0].split('-')[0], order[1].split('-')[0], `overlap: ${order.join(' ')}`);
    assert.equal(order[2].split('-')[0], order[3].split('-')[0], `overlap: ${order.join(' ')}`);
    assert.match(a + b, /\[remote-run\] slot w1 busy, waiting/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('guards on different slots run at the same time', async () => {
  const home = mkdtempSync(join(tmpdir(), 'rr-guard-'));
  const log = join(home, 'log');
  try {
    await Promise.all([runGuard(home, 'w1', log, 'a'), runGuard(home, 'w2', log, 'b')]);
    assert.deepEqual(
      events(log).map((line) => line.split('-')[1]),
      ['start', 'start', 'end', 'end'],
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
