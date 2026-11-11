import { spawnSync } from 'node:child_process';

export const DOCS_ONLY_PATHS = [
  /^plans\//,
  /^apps\/ethlete-studio\/docs\/adr\/[^/]+\.md$/,
  /^\.changeset\/[^/]+\.md$/,
  /^\.claude\/handoffs\//,
  /^\.agents\/skills\/.+\.md$/,
];

export const EXEMPT_PATHS = [/^plans\//, /^\.changeset\//, /\.md$/];

export const REUSE_DEPTH = 200;

export const parseLog = (output) =>
  output
    .split('\0')
    .filter((entry) => entry.trim())
    .map((entry) => {
      const [sha, ...files] = entry.split('\n').filter(Boolean);
      return { sha, files };
    });

export const verdictBelow = (commits, hasOk, exempt = DOCS_ONLY_PATHS) => {
  for (const [onTop, { sha, files }] of commits.entries()) {
    if (hasOk(sha)) return { sha, onTop };
    const file = files.find((path) => !exempt.some((pattern) => pattern.test(path)));
    if (file) return { blocker: sha, file };
  }
  return {};
};

export const missingVerdict = (commits, hasOk) => verdictBelow(commits, hasOk, EXEMPT_PATHS).blocker;

export const firstParentLog = (cwd, head = 'HEAD', depth = REUSE_DEPTH) =>
  parseLog(
    spawnSync(
      'git',
      ['log', '--first-parent', '--diff-merges=first-parent', '--format=%x00%H', '--name-only', `-${depth}`, head],
      { cwd, encoding: 'utf8', maxBuffer: 1 << 26 },
    ).stdout,
  );

export const reusedVerdictLine = (name, { sha, onTop }) =>
  `${name}: reused push-suite ok of ${sha.slice(0, 9)} (${onTop} docs-only commit${onTop === 1 ? '' : 's'} on top)`;
