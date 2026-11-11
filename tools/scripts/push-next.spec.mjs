import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

test('a push with a verdict reaches next and releases the slot', async (t) => {
  const { origin, mac, sha } = setup(t);
  assert.equal(claimSlot({ cwd: mac, holder: 'mac', sha }).ok, true);
  assert.notEqual(originRef(origin, SLOT_REF), '');

  const code = await pushNext({ cwd: mac, holder: 'mac', hasVerdict: () => true, log: () => undefined });

  assert.equal(code, 0);
  assert.equal(originRef(origin, 'refs/heads/next'), sha);
  assert.equal(originRef(origin, SLOT_REF), '');
});

test('a push without a verdict pushes nothing and keeps the slot', async (t) => {
  const { origin, mac, sha } = setup(t);
  claimSlot({ cwd: mac, holder: 'mac', sha });
  const lines = [];

  const code = await pushNext({ cwd: mac, hasVerdict: () => false, log: (l) => lines.push(l) });

  assert.equal(code, 1);
  assert.notEqual(originRef(origin, 'refs/heads/next'), sha);
  assert.notEqual(originRef(origin, SLOT_REF), '');
  assert.match(lines[0], /no push-suite ok verdict/);
});

test('a failed push keeps the slot and exits non-zero', async (t) => {
  const { origin, mac, sha } = setup(t);
  claimSlot({ cwd: mac, holder: 'mac', sha });
  run(origin, 'config', 'receive.denyNonFastForwards', 'true');
  run(mac, 'remote', 'set-url', '--push', 'origin', join(origin, 'missing'));

  const code = await pushNext({ cwd: mac, holder: 'mac', hasVerdict: () => true, log: () => undefined });

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

const commitFiles = (repo, ...files) => {
  for (const file of files) {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), `${file}\n`);
  }
  run(repo, 'add', '--', ...files);
  run(repo, 'commit', '-q', '-m', `touch ${files.join(' ')}`);
  return run(repo, 'rev-parse', 'HEAD');
};

const docsOnTop = (t) => {
  const { origin, mac, sha: green } = setup(t);
  commitFiles(mac, 'plans/ethlete-studio/design-to-code.md');
  const head = commitFiles(mac, '.agents/skills/builder-agent/SKILL.md', 'apps/ethlete-studio/docs/adr/0001-a.md');
  return { origin, mac, green, head };
};

const passing = (calls) => (base, head) => {
  calls.push([base, head]);
  return { status: 0, output: '', names: [] };
};

test('docs-only commits on a green ancestor reuse its verdict after the fast checks on HEAD', async (t) => {
  const { origin, mac, green, head } = docsOnTop(t);
  const calls = [];
  const lines = [];

  const code = await pushNext({
    cwd: mac,
    holder: 'mac',
    hasVerdict: (sha) => sha === green,
    checks: passing(calls),
    log: (l) => lines.push(l),
  });

  assert.equal(code, 0);
  assert.equal(originRef(origin, 'refs/heads/next'), head);
  assert.deepEqual(calls, [[green, head]]);
  assert.ok(lines.includes(`push-next: reused push-suite ok of ${green.slice(0, 9)} (2 docs-only commits on top)`));
});

test('a code commit above the green ancestor refuses the push without running the fast checks', async (t) => {
  const { origin, mac, green, head } = docsOnTop(t);
  const code = commitFiles(mac, 'tools/scripts/x.mjs');
  commitFiles(mac, '.changeset/a.md');
  const calls = [];
  const lines = [];

  const exit = await pushNext({
    cwd: mac,
    hasVerdict: (sha) => sha === green,
    checks: passing(calls),
    log: (l) => lines.push(l),
  });

  assert.equal(exit, 1);
  assert.notEqual(originRef(origin, 'refs/heads/next'), head);
  assert.deepEqual(calls, []);
  assert.match(lines.join('\n'), new RegExp(`${code.slice(0, 9)} changes tools/scripts/x\\.mjs`));
});

test('a failing fast check refuses the reuse', async (t) => {
  const { origin, mac, green, head } = docsOnTop(t);
  const lines = [];

  const code = await pushNext({
    cwd: mac,
    hasVerdict: (sha) => sha === green,
    checks: () => ({ status: 1, output: 'lint:person-names failed', names: ['lint:person-names'] }),
    log: (l) => lines.push(l),
  });

  assert.equal(code, 1);
  assert.notEqual(originRef(origin, 'refs/heads/next'), head);
  assert.match(lines.join('\n'), /fast checks failed \(lint:person-names\)/);
});

test('docs-only commits without a green ancestor refuse the push', async (t) => {
  const { origin, mac, head } = docsOnTop(t);
  const calls = [];
  const lines = [];

  const code = await pushNext({ cwd: mac, hasVerdict: () => false, checks: passing(calls), log: (l) => lines.push(l) });

  assert.equal(code, 1);
  assert.notEqual(originRef(origin, 'refs/heads/next'), head);
  assert.deepEqual(calls, []);
  assert.match(lines[0], /no push-suite ok verdict for .* or an ancestor/);
});

test('--dry-run names the reused verdict and pushes nothing', async (t) => {
  const { origin, mac, green, head } = docsOnTop(t);
  claimSlot({ cwd: mac, holder: 'mac', sha: head });
  const lines = [];

  const code = await pushNext({
    cwd: mac,
    holder: 'mac',
    hasVerdict: (sha) => sha === green,
    checks: passing([]),
    dryRun: true,
    log: (l) => lines.push(l),
  });

  assert.equal(code, 0);
  assert.notEqual(originRef(origin, 'refs/heads/next'), head);
  assert.notEqual(originRef(origin, SLOT_REF), '');
  assert.match(lines.join('\n'), new RegExp(`reused push-suite ok of ${green.slice(0, 9)}`));
});
