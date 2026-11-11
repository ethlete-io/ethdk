#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { hostname } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SLOT_REF = 'refs/push-slot/next';
const SEEN_REF = 'refs/push-slot-seen/next';
export const SLOT_TTL_MS = 60 * 60_000;

export const NETWORK_TIMEOUT_MS = 30_000;
const SSH_COMMAND = 'ssh -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3';

const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });

/** The environment of a network git call: a default `GIT_SSH_COMMAND` that gives up on a dead link, unless one is set. */
export const remoteEnv = (env = process.env) =>
  env['GIT_SSH_COMMAND'] || env['GIT_SSH'] ? env : { ...env, GIT_SSH_COMMAND: SSH_COMMAND };

const remoteGit = (cwd, timeoutMs, ...args) => {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: remoteEnv(),
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
  });
  if (result.error?.code === 'ETIMEDOUT') {
    return { status: null, stderr: `git ${args[0]} timed out after ${timeoutMs / 1000} s` };
  }
  return result;
};

/** The builder name a slot is held under: `ETHLETE_BUILDER`, else the host name. */
export const builderName = (env = process.env) => env['ETHLETE_BUILDER'] || hostname();

export const slotMessage = ({ holder, sha, expires }) =>
  `push slot ${holder}\n\nholder ${holder}\nsha ${sha}\nexpires ${new Date(expires).toISOString()}\n`;

export const parseSlotMessage = (message) => {
  const field = (name) => message.match(new RegExp(`^${name} (.+)$`, 'm'))?.[1];
  const expires = Date.parse(field('expires') ?? '');
  const holder = field('holder');
  const sha = field('sha');
  return holder && sha && !Number.isNaN(expires) ? { holder, sha, expires } : undefined;
};

const lsRemote = (cwd, remote, ref, timeoutMs) => {
  const listed = remoteGit(cwd, timeoutMs, 'ls-remote', remote, ref);
  if (listed.status !== 0) return { error: listed.stderr.trim() };
  return { sha: listed.stdout.split('\t')[0] || undefined };
};

const isPushed = (cwd, slotSha, nextSha) =>
  !!nextSha && (slotSha === nextSha || git(cwd, 'merge-base', '--is-ancestor', slotSha, nextSha).status === 0);

export const readSlot = ({ cwd, remote = 'origin', branch = 'next', timeoutMs = NETWORK_TIMEOUT_MS }) => {
  const listed = lsRemote(cwd, remote, SLOT_REF, timeoutMs);
  if (listed.error) return { error: listed.error };
  const next = lsRemote(cwd, remote, `refs/heads/${branch}`, timeoutMs);
  if (next.error) return { error: next.error };
  if (!listed.sha) return { observed: '', nextSha: next.sha };
  const fetched = remoteGit(cwd, timeoutMs, 'fetch', '-q', '--no-write-fetch-head', remote, `+${SLOT_REF}:${SEEN_REF}`);
  if (fetched.status !== 0) return { error: fetched.stderr.trim() };
  const observed = git(cwd, 'rev-parse', SEEN_REF).stdout.trim();
  const slot = parseSlotMessage(git(cwd, 'log', '-1', '--format=%B', observed).stdout);
  return { observed, slot, nextSha: next.sha, pushed: slot ? isPushed(cwd, slot.sha, next.sha) : false };
};

/** `free` when there is no slot, it expired, its sha already reached the branch, or it cannot be parsed. */
export const slotState = (read, now = Date.now()) => {
  if (!read.slot) return 'free';
  if (read.slot.expires <= now) return 'free';
  if (read.pushed) return 'free';
  return 'held';
};

export const releasedLine = (slot) =>
  `push slot of ${slot.holder} for ${slot.sha.slice(0, 12)} treated as released: origin/next contains it`;

const noteReleased = (read, now, log) => {
  if (read.slot && read.pushed && read.slot.expires > now) log(releasedLine(read.slot));
};

const writeSlot = (cwd, remote, observed, target) =>
  remoteGit(
    cwd,
    NETWORK_TIMEOUT_MS,
    'push',
    '-q',
    '--no-verify',
    `--force-with-lease=${SLOT_REF}:${observed}`,
    remote,
    `${target}:${SLOT_REF}`,
  );

/**
 * Claims the push slot of `next` on `remote` for `holder` and `sha` until `now + ttlMs`. A live slot of another holder
 * blocks; two concurrent claimers lease on the slot they read, so exactly one wins.
 */
export const claimSlot = (
  {
    cwd,
    holder = builderName(),
    sha,
    now = Date.now(),
    ttlMs = SLOT_TTL_MS,
    remote = 'origin',
    branch = 'next',
    log = console.error,
  },
  read = readSlot({ cwd, remote, branch }),
) => {
  if (read.error) return { ok: false, reason: `slot unreadable: ${read.error}` };
  noteReleased(read, now, log);
  if (slotState(read, now) === 'held' && read.slot.holder !== holder) return { ok: false, slot: read.slot };
  const treeSha = spawnSync('git', ['mktree'], { cwd, input: '', encoding: 'utf8' }).stdout.trim();
  const slot = { holder, sha, expires: now + ttlMs };
  const commit = spawnSync('git', ['commit-tree', treeSha, '-F', '-'], {
    cwd,
    input: slotMessage(slot),
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: holder,
      GIT_AUTHOR_EMAIL: 'push-slot@localhost',
      GIT_COMMITTER_NAME: holder,
      GIT_COMMITTER_EMAIL: 'push-slot@localhost',
    },
  });
  if (commit.status !== 0) return { ok: false, reason: commit.stderr.trim() };
  const pushed = writeSlot(cwd, remote, read.observed, commit.stdout.trim());
  if (pushed.status === null) return { ok: false, reason: `slot unreadable: ${pushed.stderr}` };
  if (pushed.status !== 0) return { ok: false, reason: 'another claim won the race', lost: true };
  return { ok: true, slot };
};

export const releaseSlot = ({ cwd, holder = builderName(), remote = 'origin', branch = 'next' }) => {
  const read = readSlot({ cwd, remote, branch });
  if (read.error) return { ok: false, reason: `slot unreadable: ${read.error}` };
  if (!read.observed) return { ok: true };
  if (read.slot && read.slot.holder !== holder) return { ok: false, slot: read.slot };
  const deleted = remoteGit(
    cwd,
    NETWORK_TIMEOUT_MS,
    'push',
    '-q',
    '--no-verify',
    `--force-with-lease=${SLOT_REF}:${read.observed}`,
    remote,
    `:${SLOT_REF}`,
  );
  return deleted.status === 0 ? { ok: true } : { ok: false, reason: deleted.stderr.trim() };
};

export const heldLine = (slot) =>
  `push slot held by ${slot.holder} for ${slot.sha.slice(0, 12)} until ${new Date(slot.expires).toISOString()}`;

export const hasOkVerdict = (cwd, sha) => {
  const dir = resolve(cwd, git(cwd, 'rev-parse', '--git-path', 'push-suite').stdout.trim());
  const file = join(dir, sha);
  return existsSync(file) && readFileSync(file, 'utf8').startsWith('ok ');
};

/** A slot passes for its holder by name, or for anyone pushing the slot's own sha with a local push-suite ok verdict. */
export const checkSlot = ({
  cwd,
  holder = builderName(),
  pushedSha,
  now = Date.now(),
  log = console.error,
  hasVerdict = (sha) => hasOkVerdict(cwd, sha),
  remote = 'origin',
  timeoutMs = NETWORK_TIMEOUT_MS,
}) => {
  const read = readSlot({ cwd, remote, timeoutMs });
  if (read.error) {
    log(`pre-push: push slot not readable, pushing anyway: ${read.error}`);
    return 0;
  }
  noteReleased(read, now, log);
  if (slotState(read, now) === 'free' || read.slot.holder === holder) return 0;
  if (pushedSha && read.slot.sha === pushedSha && hasVerdict(pushedSha)) return 0;
  log(
    `pre-push: ${heldLine(read.slot)}. Wait for its push or expiry, then merge origin/next and run \`yarn push:suite\`. Set ETHLETE_BUILDER=${read.slot.holder} if this is you.`,
  );
  return 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const [command, pushedSha] = process.argv.slice(2);
  const cwd = resolve(import.meta.dirname, '../..');
  if (command === 'check') process.exit(checkSlot({ cwd, pushedSha }));
  if (command === 'release') {
    const released = releaseSlot({ cwd });
    console.log(released.ok ? 'push slot released' : released.slot ? heldLine(released.slot) : released.reason);
    process.exit(released.ok ? 0 : 1);
  }
  if (command === 'status') {
    const read = readSlot({ cwd });
    if (read.error) console.log(`push slot unreadable: ${read.error}`);
    else {
      noteReleased(read, Date.now(), console.log);
      console.log(slotState(read) === 'held' ? heldLine(read.slot) : 'push slot free');
    }
    process.exit(read.error ? 1 : 0);
  }
  console.error('usage: push-slot.mjs status | release | check [<pushed sha>]');
  process.exit(2);
}
