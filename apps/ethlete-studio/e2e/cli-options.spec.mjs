import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { argvCheckOf, CANVAS_OPTIONS, usageOf } from './cli-options.mjs';

const check = (...args) => argvCheckOf({ args, options: CANVAS_OPTIONS });

test('--help and -h ask for the usage, even beside other options', () => {
  assert.deepEqual(check('--help'), { kind: 'help' });
  assert.deepEqual(check('--case', 'x', '-h'), { kind: 'help' });
});

test('an option the script does not know is named, a known option with its value passes', () => {
  assert.deepEqual(check('--bogus'), { kind: 'unknown', option: '--bogus' });
  assert.deepEqual(check('--case', 'a sketch', '--list', '--workers', '2'), { kind: 'ok' });
});

test('canvas.e2e.mjs --help prints the usage and exits 0 without starting a run', () => {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('./canvas.e2e.mjs', import.meta.url)), '--help'], {
    encoding: 'utf8',
    timeout: 20_000,
  });

  assert.equal(run.status, 0);
  assert.match(run.stdout, /^Usage: node /);
  assert.match(run.stdout, /--case <name>/);
});

test('canvas.e2e.mjs with an unknown option exits 2 with the usage on stderr', () => {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('./canvas.e2e.mjs', import.meta.url)), '--bogus'], {
    encoding: 'utf8',
    timeout: 20_000,
  });

  assert.equal(run.status, 2);
  assert.match(run.stderr, /^unknown option --bogus\n\nUsage: node /);
  assert.equal(usageOf({ script: 's', options: [['--a', 'x']] }).split('\n').length, 4);
});
