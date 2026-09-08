import { FakeBackend } from './types';

const MUTATING_PREFIXES = ['branch ', 'push ', 'switch ', 'fetch '];

/**
 * What the fixture's repository answers. A mutating command succeeds and changes nothing except
 * `git.ran` — a repair test is about what the app plans and reports, not about git.
 *
 * `clean: false` puts one modified file in `status --porcelain`, which is the state every write flow
 * has to refuse on.
 */
export const runFakeGit = (backend: FakeBackend, spec: { args: readonly string[]; cwd?: string }) => {
  const command = spec.args.join(' ');
  const { git } = backend;

  if (MUTATING_PREFIXES.some((prefix) => command.startsWith(prefix))) {
    backend.git.ran = [...git.ran, command];

    return '';
  }

  if (command.startsWith('reflog show')) return git.reflog[spec.cwd ?? ''] ?? '';

  if (command === 'status --porcelain') return git.clean ? '' : ' M src/invite.ts\n';
  if (command === 'remote') return 'origin\n';
  if (command === 'remote get-url origin') return `${git.remoteUrl}\n`;
  if (command === 'for-each-ref --format=%(refname:short) refs/heads') return `${git.branches.join('\n')}\n`;
  if (command === 'for-each-ref --format=%(refname:strip=3) refs/remotes/origin') {
    return `HEAD\n${git.remoteBranches.join('\n')}\n`;
  }

  return 'e2e@example.com\n';
};
