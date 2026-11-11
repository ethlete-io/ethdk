import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gitSpawn } from './git-test-env.mjs';
import { pushNext } from './push-next.mjs';
import { claimSlot, readSlot, releasedLine, SLOT_REF } from './push-slot.mjs';

const run = (cwd, ...args) => {
  const result = gitSpawn(args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

const setup = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'push-next-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const origin = join(dir, 'origin.git');
  run(dir, 'init', '-q', '--bare', '-b', 'next', origin);
  const seed = join(dir, 'seed');
  run(dir, 'init', '-q', '-b', 'next', seed);
  run(seed, '-c', 'user.name=seed', '-c', 'user.email=seed@localhost', 'commit', '-q', '--allow-empty', '-m', 'seed');
  run(seed, 'push', '-q', origin, 'next');
  const mac = join(dir, 'mac');
  run(dir, 'clone', '-q', origin, mac);
  run(mac, 'config', 'user.name', 'mac');
  run(mac, 'config', 'user.email', 'mac@localhost');
  run(mac, 'commit', '-q', '--allow-empty', '-m', 'work');
  const sha = run(mac, 'rev-parse', 'HEAD');
  return { origin, mac, sha };
};

const originRef = (origin, ref) => run(origin, 'for-each-ref', '--format=%(objectname)', ref);

test('a push with a verdict reaches next and releases the slot', (t) => {
  const { origin, mac, sha } = setup(t);
  assert.equal(claimSlot({ cwd: mac, holder: 'mac', sha }).ok, true);
  assert.notEqual(originRef(origin, SLOT_REF), '');

  const code = pushNext({ cwd: mac, holder: 'mac', hasVerdict: () => true, log: () => undefined });

  assert.equal(code, 0);
  assert.equal(originRef(origin, 'refs/heads/next'), sha);
  assert.equal(originRef(origin, SLOT_REF), '');
});

test('a push without a verdict pushes nothing and keeps the slot', (t) => {
  const { origin, mac, sha } = setup(t);
  claimSlot({ cwd: mac, holder: 'mac', sha });
  const lines = [];

  const code = pushNext({ cwd: mac, hasVerdict: () => false, log: (l) => lines.push(l) });

  assert.equal(code, 1);
  assert.notEqual(originRef(origin, 'refs/heads/next'), sha);
  assert.notEqual(originRef(origin, SLOT_REF), '');
  assert.match(lines[0], /no push-suite ok verdict/);
});

test('a failed push keeps the slot and exits non-zero', (t) => {
  const { origin, mac, sha } = setup(t);
  claimSlot({ cwd: mac, holder: 'mac', sha });
  run(origin, 'config', 'receive.denyNonFastForwards', 'true');
  run(mac, 'remote', 'set-url', '--push', 'origin', join(origin, 'missing'));

  const code = pushNext({ cwd: mac, holder: 'mac', hasVerdict: () => true, log: () => undefined });

  assert.notEqual(code, 0);
  assert.notEqual(originRef(origin, SLOT_REF), '');
});

test('a held slot on a sha that next already contains does not block a claim and says so', (t) => {
  const { mac, sha } = setup(t);
  claimSlot({ cwd: mac, holder: 'linux', sha });
  run(mac, 'push', '-q', 'origin', 'next');
  const lines = [];

  const claim = claimSlot({ cwd: mac, holder: 'mac', sha, log: (l) => lines.push(l) });

  assert.equal(claim.ok, true);
  assert.deepEqual(lines, [releasedLine({ holder: 'linux', sha })]);
  assert.equal(readSlot({ cwd: mac }).slot.holder, 'mac');
});
