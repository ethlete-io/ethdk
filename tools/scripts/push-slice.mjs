import { spawnSync } from 'node:child_process';

const BASE = 'next';

const runCommand =
  (root) =>
  (command, args, { inherit = false } = {}) => {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe' });

    return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  };

export const sliceBranchOf = (name, sha) => `slice/${name || sha.slice(0, 10)}`;

export const parseArgs = (argv) => ({
  dryRun: argv.includes('--dry-run'),
  name: argv.find((arg) => !arg.startsWith('--')),
});

export const pushSlice = (root, { name, dryRun = false, run = runCommand(root), log = console.log } = {}) => {
  const head = run('git', ['rev-parse', 'HEAD']);

  if (head.status !== 0) {
    log(`push:slice: no HEAD to push.\n${head.stderr}`);

    return 1;
  }

  const sha = head.stdout.trim();
  const branch = sliceBranchOf(name, sha);
  const push = ['push', 'origin', `HEAD:refs/heads/${branch}`];

  if (dryRun) log(`would run: git ${push.join(' ')}`);
  else if (run('git', push, { inherit: true }).status !== 0) {
    log(`push:slice: the push of ${branch} failed (above).`);

    return 1;
  }

  const list = run('gh', ['pr', 'list', '--head', branch, '--base', BASE, '--state', 'open', '--json', 'url']);

  if (list.status !== 0) {
    log(`push:slice: gh pr list failed.\n${list.stderr}`);

    return 1;
  }

  const [open] = JSON.parse(list.stdout || '[]');

  if (open) {
    log(`push:slice: ${branch} is at ${sha.slice(0, 10)}; its draft pull request reruns CI: ${open.url}`);

    return 0;
  }

  const subject = run('git', ['log', '-1', '--format=%s']).stdout.trim();
  const create = [
    'pr',
    'create',
    '--draft',
    '--base',
    BASE,
    '--head',
    branch,
    '--title',
    `Slice ${branch.slice('slice/'.length)}: ${subject}`,
    '--body',
    `CI for a slice of \`${BASE}\` while its push is held (ADR 0216). Do not merge: \`${BASE}\` is pushed on its own.`,
  ];

  if (dryRun) {
    log(`would run: gh ${create.join(' ')}`);

    return 0;
  }

  const created = run('gh', create);

  if (created.status !== 0) {
    log(`push:slice: gh pr create failed.\n${created.stderr}`);

    return 1;
  }

  log(`push:slice: opened ${created.stdout.trim()}`);

  return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(pushSlice(process.cwd(), parseArgs(process.argv.slice(2))));
}
