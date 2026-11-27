import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const RUN_RECORD = 'run.json';
export const DEFAULT_MAX_AGE_DAYS = 7;

/** The repo paths whose change makes the client agent see a different tool: design cli, its skills, the order, the sandbox. */
export const CLIENT_PATHS = [
  'libs/cli/src/lib/design',
  'libs/agent-rules/content/skills',
  'tools/client-run/order.md',
  'tools/client-run/expect.json',
  'tools/scripts/clean-slate-run',
];

const STAMP = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/;
const DAY_MS = 86_400_000;

const startOfStamp = (name) => {
  const match = STAMP.exec(name);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute);
};

/** The newest stamped run under `out` with its `run.json` record; a run without a record has no SDK commit. */
export const lastRunOf = (out) => {
  if (!existsSync(out)) return null;
  const name = readdirSync(out)
    .filter((entry) => startOfStamp(entry))
    .sort()
    .at(-1);
  if (!name) return null;

  const recordPath = join(out, name, RUN_RECORD);
  const record = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, 'utf8')) : {};
  return { name, startedAt: startOfStamp(name), sdkCommit: record.sdkCommit ?? null };
};

/** Counts the commits after `sdkCommit` up to HEAD of `repo` that touch `CLIENT_PATHS`; null when git does not know the commit. */
export const clientCommitsSince = ({ repo, sdkCommit, spawn = spawnSync }) => {
  const result = spawn('git', ['rev-list', '--count', `${sdkCommit}..HEAD`, '--', ...CLIENT_PATHS], {
    cwd: repo,
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return Number(result.stdout.trim());
};

/** Why a new client run is due, or null when the last run still shows the current tool. */
export const dueReasonOf = ({ last, now, maxAgeDays = DEFAULT_MAX_AGE_DAYS, clientCommits }) => {
  if (!last) return 'no client run yet';

  const ageDays = Math.floor((now.getTime() - last.startedAt.getTime()) / DAY_MS);
  if (ageDays >= maxAgeDays) return `the last run ${last.name} is ${ageDays} days old`;
  if (!last.sdkCommit) return null;
  if (clientCommits === null) return `the SDK commit ${last.sdkCommit} of ${last.name} is not in this repo`;
  if (clientCommits > 0) return `${clientCommits} commits since ${last.name} change what the client agent uses`;

  return null;
};
