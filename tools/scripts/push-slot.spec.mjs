import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkSlot, claimSlot, readSlot, releaseSlot, remoteEnv, slotState, SLOT_TTL_MS } from './push-slot.mjs';
import { gitSpawn } from './git-test-env.mjs';

const run = (cwd, ...args) => {
  const result = gitSpawn(args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

const setup = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'push-slot-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const origin = join(dir, 'origin.git');
  run(dir, 'init', '-q', '--bare', '-b', 'next', origin);
  const seed = join(dir, 'seed');
  run(dir, 'init', '-q', '-b', 'next', seed);
  run(seed, '-c', 'user.name=seed', '-c', 'user.email=seed@localhost', 'commit', '-q', '--allow-empty', '-m', 'seed');
  run(seed, 'push', '-q', origin, 'next');
  const clone = (name) => {
    const path = join(dir, name);
    run(dir, 'clone', '-q', origin, path);
    run(path, 'config', 'user.name', name);
    run(path, 'config', 'user.email', `${name}@localhost`);
    return path;
  };
  return { origin, mac: clone('mac'), linux: clone('linux') };
};

const commit = (cwd, message) => {
  run(cwd, 'commit', '-q', '--allow-empty', '-m', message);
  return run(cwd, 'rev-parse', 'HEAD');
};

test('two claimers that read the same free slot: exactly one wins', (t) => {
  const { mac, linux } = setup(t);
  const macSha = commit(mac, 'mac work');
  const linuxSha = commit(linux, 'linux work');
  const macRead = readSlot({ cwd: mac });
  const linuxRead = readSlot({ cwd: linux });

  const macClaim = claimSlot({ cwd: mac, holder: 'mac', sha: macSha }, macRead);
  const linuxClaim = claimSlot({ cwd: linux, holder: 'linux', sha: linuxSha }, linuxRead);

  assert.deepEqual([macClaim.ok, linuxClaim.ok], [true, false]);
  assert.equal(linuxClaim.lost, true);
  assert.equal(readSlot({ cwd: linux }).slot.holder, 'mac');
});

test('a live slot of another holder blocks a claim and the push check', (t) => {
  const { mac, linux } = setup(t);
  assert.equal(claimSlot({ cwd: mac, holder: 'mac', sha: commit(mac, 'mac work') }).ok, true);

  const blocked = claimSlot({ cwd: linux, holder: 'linux', sha: commit(linux, 'linux work') });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.slot.holder, 'mac');
  const lines = [];
  assert.equal(checkSlot({ cwd: linux, holder: 'linux', log: (line) => lines.push(line) }), 1);
  assert.match(lines[0], /push slot held by mac/);
  assert.equal(checkSlot({ cwd: mac, holder: 'mac', log: () => undefined }), 0);
});

test('an expired claim is free', (t) => {
  const { mac, linux } = setup(t);
  const now = Date.now();
  claimSlot({ cwd: mac, holder: 'mac', sha: commit(mac, 'mac work'), now });

  assert.equal(slotState(readSlot({ cwd: linux }), now + SLOT_TTL_MS - 1), 'held');
  assert.equal(slotState(readSlot({ cwd: linux }), now + SLOT_TTL_MS), 'free');
  const late = claimSlot({ cwd: linux, holder: 'linux', sha: commit(linux, 'linux work'), now: now + SLOT_TTL_MS });
  assert.equal(late.ok, true);
});

test('release frees the slot, and only its holder can release it', (t) => {
  const { mac, linux } = setup(t);
  claimSlot({ cwd: mac, holder: 'mac', sha: commit(mac, 'mac work') });

  assert.equal(releaseSlot({ cwd: linux, holder: 'linux' }).ok, false);
  assert.equal(releaseSlot({ cwd: mac, holder: 'mac' }).ok, true);

  assert.equal(slotState(readSlot({ cwd: linux })), 'free');
  assert.equal(claimSlot({ cwd: linux, holder: 'linux', sha: commit(linux, 'linux work') }).ok, true);
});

test('the holder can re-claim its own live slot', (t) => {
  const { mac } = setup(t);
  claimSlot({ cwd: mac, holder: 'mac', sha: commit(mac, 'first') });
  const second = commit(mac, 'second');

  assert.equal(claimSlot({ cwd: mac, holder: 'mac', sha: second }).ok, true);

  assert.equal(readSlot({ cwd: mac }).slot.sha, second);
});

test('a slot whose sha reached next is free', (t) => {
  const { mac, linux } = setup(t);
  const sha = commit(mac, 'mac work');
  claimSlot({ cwd: mac, holder: 'mac', sha });
  run(mac, 'push', '-q', 'origin', 'next');
  run(linux, 'fetch', '-q', 'origin');

  assert.equal(slotState(readSlot({ cwd: linux })), 'free');
  assert.equal(checkSlot({ cwd: linux, holder: 'linux', log: () => undefined }), 0);
});

test('a remote that never answers ends the check within the timeout, warns, and lets the push go on', (t) => {
  const { mac } = setup(t);
  run(mac, 'remote', 'add', 'dead', 'ssh://push-slot.invalid/never.git');
  const ssh = process.env['GIT_SSH_COMMAND'];
  process.env['GIT_SSH_COMMAND'] = 'sleep 30 #';
  t.after(() => (ssh === undefined ? delete process.env['GIT_SSH_COMMAND'] : (process.env['GIT_SSH_COMMAND'] = ssh)));
  const lines = [];
  const started = Date.now();
  const exit = checkSlot({ cwd: mac, remote: 'dead', timeoutMs: 1000, log: (line) => lines.push(line) });
  assert.ok(Date.now() - started < 5000, `took ${Date.now() - started} ms`);
  assert.equal(exit, 0);
  assert.match(lines.join('\n'), /push slot not readable, pushing anyway: git ls-remote timed out after 1 s/);
});

test('a network git call gets an ssh command that gives up on a dead link, unless one is set', () => {
  assert.match(remoteEnv({}).GIT_SSH_COMMAND, /ConnectTimeout=10 .*ServerAliveInterval=5 .*ServerAliveCountMax=3/);
  assert.equal(remoteEnv({ GIT_SSH_COMMAND: 'ssh -v' }).GIT_SSH_COMMAND, 'ssh -v');
  assert.equal(remoteEnv({ GIT_SSH: '/bin/ssh' }).GIT_SSH_COMMAND, undefined);
});

test('another holder is refused with the holder hint', (t) => {
  const { mac } = setup(t);
  const sha = commit(mac, 'mac work');
  claimSlot({ cwd: mac, holder: 'builder', sha });
  const lines = [];

  assert.equal(checkSlot({ cwd: mac, holder: 'other-host', log: (l) => lines.push(l) }), 1);

  assert.match(lines[0], /set ETHLETE_BUILDER=builder if this is you/i);
});
