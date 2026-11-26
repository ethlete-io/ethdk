import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { gitSpawn } from './git-test-env.mjs';
import { pushNext } from './push-next.mjs';
import { claimSlot, readSlot, releasedLine, SLOT_REF, SLOT_TTL_MS } from './push-slot.mjs';

for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[key];
process.env['ETHLETE_MIRROR_DIR'] = join(tmpdir(), 'push-next-no-mirror');

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
  const mirror = join(dir, 'mirror');
  mkdirSync(mirror);
  return { origin, mac, sha, mirror };
};

const originRef = (origin, ref) => run(origin, 'for-each-ref', '--format=%(objectname)', ref);

test('a push reaches next and releases the slot', (t) => {
  const { origin, mac, sha } = setup(t);
  assert.equal(claimSlot({ cwd: mac, holder: 'mac', sha }).ok, true);
  assert.notEqual(originRef(origin, SLOT_REF), '');

  const code = pushNext({ cwd: mac, holder: 'mac', log: () => undefined });

  assert.equal(code, 0);
  assert.equal(originRef(origin, 'refs/heads/next'), sha);
  assert.equal(originRef(origin, SLOT_REF), '');
});

test('a failed push keeps the slot and exits non-zero', (t) => {
  const { origin, mac, sha } = setup(t);
  claimSlot({ cwd: mac, holder: 'mac', sha });
  run(origin, 'config', 'receive.denyNonFastForwards', 'true');
  run(mac, 'remote', 'set-url', '--push', 'origin', join(origin, 'missing'));

  const code = pushNext({ cwd: mac, holder: 'mac', log: () => undefined });

  assert.notEqual(code, 0);
  assert.notEqual(originRef(origin, SLOT_REF), '');
});

test('a held slot on a sha that next already contains does not block a claim and says so', async (t) => {
  const { mac, sha } = setup(t);
  claimSlot({ cwd: mac, holder: 'linux', sha });
  run(mac, 'push', '-q', 'origin', 'next');
  const lines = [];

  const claim = claimSlot({ cwd: mac, holder: 'mac', sha, log: (l) => lines.push(l) });

  assert.equal(claim.ok, true);
  assert.deepEqual(lines, [releasedLine({ holder: 'linux', sha })]);
  assert.equal(readSlot({ cwd: mac }).slot.holder, 'mac');
});

test('--dry-run names the sha and pushes nothing', (t) => {
  const { origin, mac, sha } = setup(t);
  claimSlot({ cwd: mac, holder: 'mac', sha });
  const lines = [];

  const code = pushNext({ cwd: mac, holder: 'mac', dryRun: true, log: (l) => lines.push(l) });

  assert.equal(code, 0);
  assert.notEqual(originRef(origin, 'refs/heads/next'), sha);
  assert.notEqual(originRef(origin, SLOT_REF), '');
  assert.deepEqual(lines, [`push-next: --dry-run, would push ${sha.slice(0, 12)} to origin next`]);
});

test('a push names each uncommitted design record file with its age', (t) => {
  const { mac } = setup(t);
  const ready = join(mac, '.ethlete/design/studio/ready.json');
  mkdirSync(dirname(ready), { recursive: true });
  writeFileSync(ready, '{}\n');
  writeFileSync(join(mac, '.ethlete/design/studio/other.json'), '{}\n');
  const lines = [];

  pushNext({ cwd: mac, dryRun: true, log: (l) => lines.push(l) });

  assert.equal(lines.filter((l) => l.includes('is uncommitted')).length, 1);
  assert.match(lines[0], /\.ethlete\/design\/studio\/ready\.json is uncommitted, last written 0 min ago/);
});

const writeVerdict = (mirror, sha, status) =>
  writeFileSync(join(mirror, `${sha}.json`), JSON.stringify({ sha, status }));

// Tom's decision: a red mirror verdict blocks `yarn push` for that commit only, nothing is reverted.
test('a commit the mirror judged red is refused; a green, error or unjudged one pushes', (t) => {
  const { origin, mac, sha, mirror } = setup(t);
  writeVerdict(mirror, sha, 'red');
  const lines = [];

  assert.equal(pushNext({ cwd: mac, holder: 'mac', mirror, log: (l) => lines.push(l) }), 1);
  assert.notEqual(originRef(origin, 'refs/heads/next'), sha);
  assert.match(lines[0], /judged [0-9a-f]{12} red/);

  run(mac, 'commit', '-q', '--allow-empty', '-m', 'fix');
  const fix = run(mac, 'rev-parse', 'HEAD');
  assert.equal(pushNext({ cwd: mac, holder: 'mac', mirror, log: () => undefined }), 0);
  assert.equal(originRef(origin, 'refs/heads/next'), fix);

  for (const status of ['green', 'error']) {
    run(mac, 'commit', '-q', '--allow-empty', '-m', status);
    const head = run(mac, 'rev-parse', 'HEAD');
    writeVerdict(mirror, head, status);
    assert.equal(pushNext({ cwd: mac, holder: 'mac', mirror, log: () => undefined }), 0);
    assert.equal(originRef(origin, 'refs/heads/next'), head);
  }
});

test('an expired slot of another holder is taken and released without a warning', (t) => {
  const { origin, mac, sha, mirror } = setup(t);
  claimSlot({ cwd: mac, holder: 'linux', sha, now: Date.now() - 2 * SLOT_TTL_MS, log: () => undefined });
  const lines = [];

  const code = pushNext({ cwd: mac, holder: 'mac', mirror, log: (l) => lines.push(l) });

  assert.equal(code, 0);
  assert.deepEqual(lines, ['push slot released']);
  assert.equal(originRef(origin, 'refs/heads/next'), sha);
  assert.equal(originRef(origin, SLOT_REF), '');
});

test('a live slot of another holder blocks the push and stays', (t) => {
  const { origin, mac, sha, mirror } = setup(t);
  claimSlot({ cwd: mac, holder: 'linux', sha, log: () => undefined });
  const slot = originRef(origin, SLOT_REF);
  const lines = [];

  const code = pushNext({ cwd: mac, holder: 'mac', mirror, log: (l) => lines.push(l) });

  assert.equal(code, 1);
  assert.notEqual(originRef(origin, 'refs/heads/next'), sha);
  assert.equal(originRef(origin, SLOT_REF), slot);
  assert.match(lines[0], /push slot held by linux/);
});
