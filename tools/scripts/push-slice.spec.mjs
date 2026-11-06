import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArgs, pushSlice, sliceBranchOf } from './push-slice.mjs';

const SHA = 'c9dc8788d0123456789abcdef0123456789abcde';

const fake = (responses) => {
  const calls = [];
  const run = (command, args) => {
    const call = `${command} ${args.join(' ')}`;
    calls.push(call);
    const [, response] = Object.entries(responses).find(([prefix]) => call.startsWith(prefix)) ?? [];

    return { status: 0, stdout: '', stderr: '', ...response };
  };
  const logs = [];

  return { run, calls, logs, log: (line) => logs.push(line) };
};

const HEAD = { 'git rev-parse HEAD': { stdout: `${SHA}\n` }, 'git log -1': { stdout: 'feat(cli): Add x\n' } };

test('names the slice branch after the argument, else the short sha', () => {
  assert.equal(sliceBranchOf('menu-fix', SHA), 'slice/menu-fix');
  assert.equal(sliceBranchOf(undefined, SHA), 'slice/c9dc8788d0');
  assert.deepEqual(parseArgs(['--dry-run', 'menu-fix']), { dryRun: true, name: 'menu-fix' });
});

test('pushes HEAD with the hook and opens a draft pull request into next', () => {
  const { run, calls, log } = fake({ ...HEAD, 'gh pr create': { stdout: 'https://github.com/o/r/pull/7\n' } });

  assert.equal(pushSlice('/repo', { name: 'menu-fix', run, log }), 0);
  assert.deepEqual(calls.slice(0, 3), [
    'git rev-parse HEAD',
    'git push origin HEAD:refs/heads/slice/menu-fix',
    'gh pr list --head slice/menu-fix --base next --state open --json url',
  ]);
  assert.ok(calls.some((call) => call.startsWith('gh pr create --draft --base next --head slice/menu-fix --title')));
  assert.ok(calls.every((call) => !call.includes('--no-verify') && !call.includes('--force')));
});

test('reuses the open draft pull request of the branch', () => {
  const { run, calls, logs, log } = fake({
    ...HEAD,
    'gh pr list': { stdout: JSON.stringify([{ url: 'https://github.com/o/r/pull/7' }]) },
  });

  assert.equal(pushSlice('/repo', { run, log }), 0);
  assert.ok(calls.every((call) => !call.startsWith('gh pr create')));
  assert.match(logs.join('\n'), /pull\/7/);
});

test('stops before the pull request when the push fails', () => {
  const { run, calls, log } = fake({ ...HEAD, 'git push': { status: 1 } });

  assert.equal(pushSlice('/repo', { run, log }), 1);
  assert.ok(calls.every((call) => !call.startsWith('gh ')));
});

test('a dry run pushes nothing and creates nothing', () => {
  const { run, calls, logs, log } = fake(HEAD);

  assert.equal(pushSlice('/repo', { name: 'x', dryRun: true, run, log }), 0);
  assert.ok(calls.every((call) => !call.startsWith('git push') && !call.startsWith('gh pr create')));
  assert.match(logs.join('\n'), /would run: git push origin HEAD:refs\/heads\/slice\/x/);
  assert.match(logs.join('\n'), /would run: gh pr create --draft --base next --head slice\/x/);
});
