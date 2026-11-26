import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('./heavy.mjs', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'heavy-spec-'));
  const env = { ...process.env, HEAVY_LOCK_PREFIX: join(dir, 'lock'), HEAVY_POLL_MS: '50' };
  const start = (cmd) => {
    const child = spawn('node', [script, 'run', '--', 'sh', '-c', cmd], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.out = '';
    child.err = '';
    child.stdout.on('data', (d) => (child.out += d));
    child.stderr.on('data', (d) => (child.err += d));
    child.done = new Promise((r) => child.on('close', (code) => r(code)));
    return child;
  };
  return { dir, start };
};

const waitFor = async (cond) => {
  for (let i = 0; i < 200; i++) {
    if (cond()) return;
    await sleep(50);
  }
  assert.fail('timeout');
};

const holdUntil = (gate, tag) => `echo ${tag}; while [ ! -e ${gate} ]; do sleep 0.05; done`;

test('4 jobs: 3 run at once, the 4th waits and prints holders', async () => {
  const { dir, start } = setup();
  const gate = join(dir, 'go');
  const jobs = [1, 2, 3].map((i) => start(holdUntil(gate, `started-${i}`)));
  await waitFor(() => jobs.every((j) => j.out.includes('started-')));
  const fourth = start('echo fourth-ran');
  await waitFor(() => fourth.err.includes('all 3 slots are taken'));
  assert.equal(fourth.out, '');
  assert.equal(fourth.err.match(/slot \d: pid \d+/g).length, 3);
  writeFileSync(gate, '');
  assert.equal(await fourth.done, 0);
  assert.match(fourth.out, /fourth-ran/);
  await Promise.all(jobs.map((j) => j.done));
});

test('a killed holder frees its slot', async () => {
  const { dir, start } = setup();
  const gate = join(dir, 'go');
  const jobs = [1, 2, 3].map((i) => start(holdUntil(gate, `started-${i}`)));
  await waitFor(() => jobs.every((j) => j.out.includes('started-')));
  const fourth = start('echo fourth-ran');
  await waitFor(() => fourth.err.includes('all 3 slots are taken'));
  const pid = Number(fourth.err.match(/slot \d: pid (\d+)/)[1]);
  process.kill(pid, 'SIGKILL');
  assert.equal(await fourth.done, 0);
  assert.match(fourth.out, /fourth-ran/);
  writeFileSync(gate, '');
  await Promise.all(jobs.map((j) => j.done));
});

test('exit code passes through', async () => {
  const { start } = setup();
  assert.equal(await start('exit 7').done, 7);
  assert.equal(await start('exit 0').done, 0);
});
