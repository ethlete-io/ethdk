import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { OWN_SCOPE_ENV } from './own-scope.mjs';
import { devJobLimits, heavyJobOf } from './own-scope-preload.mjs';

const preload = fileURLToPath(new URL('./own-scope-preload.mjs', import.meta.url));
const userScopes =
  process.platform === 'linux' &&
  spawnSync('busctl', [
    '--user',
    'get-property',
    'org.freedesktop.systemd1',
    '/org/freedesktop/systemd1',
    'org.freedesktop.systemd1.Manager',
    'Version',
  ]).status === 0;

test('nx, vitest and tsc entries are heavy jobs, through a .bin link too', () => {
  const same = (path) => path;
  assert.equal(heavyJobOf('/repo/node_modules/nx/dist/bin/nx.js', same), 'nx');
  assert.equal(heavyJobOf('/repo/node_modules/nx/bin/nx.js', same), 'nx');
  assert.equal(heavyJobOf('/repo/node_modules/vitest/vitest.mjs', same), 'vitest');
  assert.equal(heavyJobOf('/repo/node_modules/typescript/bin/tsc', same), 'tsc');
  assert.equal(heavyJobOf('/repo/node_modules/vitest/dist/workers/forks.js', same), undefined);
  assert.equal(heavyJobOf('/repo/node_modules/nx/src/daemon/server/start.js', same), undefined);
  assert.equal(heavyJobOf('/repo/node_modules/prettier/bin/prettier.cjs', same), undefined);
  assert.equal(heavyJobOf(undefined, same), undefined);
  assert.equal(
    heavyJobOf('/repo/node_modules/.bin/vitest', () => '/repo/node_modules/vitest/vitest.mjs'),
    'vitest',
  );
  assert.equal(
    heavyJobOf('/gone', () => {
      throw new Error('ENOENT');
    }),
    undefined,
  );
});

test('a dev job gets 16G high / 20G max unless the env overrides it', () => {
  assert.deepEqual(devJobLimits({}), { memoryHigh: '16G', memoryMax: '20G' });
  assert.deepEqual(devJobLimits({ ETHLETE_OWN_SCOPE_MEMORY_MAX: '256M' }), { memoryHigh: '256M', memoryMax: '256M' });
});

test(
  'a hog started as a plain vitest bin dies in its own scope and the launching process survives',
  { skip: !userScopes },
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'own-scope-preload-'));
    try {
      const bin = join(dir, 'node_modules', 'vitest');
      mkdirSync(bin, { recursive: true });
      writeFileSync(
        join(bin, 'vitest.mjs'),
        `import { readFileSync } from 'node:fs';
console.log(readFileSync('/proc/self/cgroup', 'utf8').trim());
const keep = []; for (let mb = 0; mb < 768; mb += 16) keep.push(Buffer.alloc(16 * 1024 * 1024, 1));
console.log('not killed');`,
      );
      mkdirSync(join(dir, 'node_modules', '.bin'));
      symlinkSync('../vitest/vitest.mjs', join(dir, 'node_modules', '.bin', 'vitest'));
      const run = spawnSync(process.execPath, ['--import', preload, join(dir, 'node_modules', '.bin', 'vitest')], {
        encoding: 'utf8',
        env: { ...process.env, [OWN_SCOPE_ENV]: '', ETHLETE_OWN_SCOPE_MEMORY_MAX: '256M' },
      });
      assert.match(run.stdout, /\/vitest-\d+\.scope$/m);
      assert.doesNotMatch(run.stdout, /not killed/);
      assert.equal(run.signal, 'SIGKILL');
      assert.doesNotMatch(readFileSync('/proc/self/cgroup', 'utf8'), /vitest-\d+\.scope/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
