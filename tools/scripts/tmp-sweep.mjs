import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, readdirSync, readlinkSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const UNIT = 'ethlete-tmp-sweep';
export const claudeTmpDir = () => join(homedir(), '.cache', 'claude-tmp');

const mkdtempOf = (prefix) => new RegExp(`^${prefix.replace(/[.-]/g, '\\$&')}[A-Za-z0-9]{6}$`);

export const TMP_PATTERNS = [
  /^tmp-\d+-/,
  /^et-design-/,
  /^cli-/,
  /^studio-canvas-e2e-/,
  /^commit-export-spec-/,
  /^playwright-artifacts-/,
  ...[
    'adr-',
    'archive-',
    'archive-cli-',
    'completeness-cache-',
    'completeness-parallel-',
    'et-samples-',
    'git-env-hook-',
    'git-env-raw-',
    'git-env-temp-',
    'lint-changesets-',
    'migration-entries-',
    'person-names-',
    'plan-findings-',
    'plan-findings-archive-',
    'plan-findings-order-',
    'render-cache-',
    'repeat-live-log-',
    'scratch-out-',
    'scratch-spec-',
    'size-budget-',
    'slice-merge-',
    'spec-stress-',
    'studio-headless-inputs-',
    'untrack-spec-',
    'vitest-targets-',
    'wf-',
  ].map(mkdtempOf),
];

export const KEPT_TMP_NAMES = ['node-compile-cache', 'et-design-harness-cache', 'jest_rs'];

export const isSweptTmpName = (name) =>
  !KEPT_TMP_NAMES.includes(name) && TMP_PATTERNS.some((pattern) => pattern.test(name));

const lstatOf = (path) => {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
};

const touchedSince = (path, cutoff) => {
  const stat = lstatOf(path);
  if (!stat) return false;
  if (stat.mtimeMs >= cutoff) return true;
  if (!stat.isDirectory()) return false;
  let names;
  try {
    names = readdirSync(path);
  } catch {
    return true;
  }
  return names.some((name) => touchedSince(join(path, name), cutoff));
};

export const openPathsOf = (proc = '/proc') => {
  const paths = [];
  for (const pid of readdirSync(proc).filter((name) => /^\d+$/.test(name))) {
    const read = (link) => {
      try {
        paths.push(readlinkSync(join(proc, pid, link)));
      } catch {
        /* the process ended or is not ours */
      }
    };
    read('cwd');
    let fds = [];
    try {
      fds = readdirSync(join(proc, pid, 'fd'));
    } catch {
      /* the process ended or is not ours */
    }
    fds.forEach((fd) => read(join('fd', fd)));
  }
  return paths;
};

const usedBy = (path, openPaths) => openPaths.some((open) => open === path || open.startsWith(`${path}/`));

export const sweepTargets = ({ tmpRoot, claudeTmp, now, maxAgeMs = MAX_AGE_MS, openPaths }) => {
  const cutoff = now - maxAgeMs;
  const stale = (path) => !touchedSince(path, cutoff) && !usedBy(path, openPaths);
  const list = (dir) => {
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  };
  const fromTmp = list(tmpRoot)
    .filter(isSweptTmpName)
    .map((name) => join(tmpRoot, name))
    .filter(stale);
  const prune = (dir) =>
    list(dir).flatMap((name) => {
      const path = join(dir, name);
      if (stale(path)) return [path];
      return lstatOf(path)?.isDirectory() ? prune(path) : [];
    });
  return [...fromTmp, ...(claudeTmp ? prune(claudeTmp) : [])];
};

const sweep = (dryRun) => {
  const targets = sweepTargets({
    tmpRoot: '/tmp',
    claudeTmp: claudeTmpDir(),
    now: Date.now(),
    openPaths: openPathsOf(),
  });
  let failed = 0;
  for (const path of targets) {
    if (dryRun) {
      process.stdout.write(`would delete ${path}\n`);
      continue;
    }
    try {
      rmSync(path, { recursive: true, force: true });
    } catch (error) {
      failed++;
      process.stderr.write(`tmp-sweep: ${path}: ${error.message}\n`);
    }
  }
  process.stdout.write(
    `tmp-sweep: ${dryRun ? 'would delete' : 'deleted'} ${targets.length - failed} entries${failed ? `, ${failed} failed` : ''}\n`,
  );
  return failed ? 1 : 0;
};

export const unitFiles = ({ node, script }) => ({
  [`${UNIT}.service`]: `[Unit]
Description=Delete ethlete test folders and Claude Code temp files older than 6 h

[Service]
Type=oneshot
ExecStart=${node} ${script}
Nice=10
IOSchedulingClass=idle
`,
  [`${UNIT}.timer`]: `[Unit]
Description=Run ${UNIT} every hour

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
`,
});

const install = (dryRun) => {
  const unitDir = join(homedir(), '.config', 'systemd', 'user');
  const files = unitFiles({ node: realpathSync(process.execPath), script: fileURLToPath(import.meta.url) });
  const commands = [
    ['systemctl', '--user', 'daemon-reload'],
    ['systemctl', '--user', 'enable', '--now', `${UNIT}.timer`],
  ];
  if (dryRun) {
    for (const [name, text] of Object.entries(files))
      process.stdout.write(`would write ${join(unitDir, name)}:\n${text}\n`);
    commands.forEach((command) => process.stdout.write(`would run ${command.join(' ')}\n`));
    return 0;
  }
  mkdirSync(unitDir, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(unitDir, name), text);
  for (const [program, ...args] of commands) {
    const status = spawnSync(program, args, { stdio: 'inherit' }).status;
    if (status !== 0) return status ?? 1;
  }
  process.stdout.write(`Installed ${UNIT}.timer. Check it with: systemctl --user list-timers ${UNIT}.timer\n`);
  return 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  process.exitCode = args[0] === 'install' ? install(dryRun) : sweep(dryRun);
}
