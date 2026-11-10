import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnPlain } from '../plain-output';

export type PushStatus = {
  base: string;
  strayUpstream: string | null;
  unpushed: number;
  oldestAt: string | null;
  oldestAgeHours: number | null;
} & CiStatus;

export type CiState = 'green' | 'red' | 'running' | 'unknown';

export type CiStatus = { ci: CiState; ciUrl: string | null; ciAt: string | null };

type CiRun = { status: string; conclusion: string; url: string; createdAt: string };

const UNKNOWN_CI: CiStatus = { ci: 'unknown', ciUrl: null, ciAt: null };

const CI_WORKFLOW = 'ci-next.yml';

const CI_CACHE_MS = 60_000;

const SKIPPED_CONCLUSIONS = ['cancelled', 'skipped', 'neutral', 'stale'];

const flattened = (value: string) => value.replace(/[^A-Za-z0-9]/gu, '-');

const git = (cwd: string, args: string[]) => {
  const result = spawnPlain(['git', ...args], { cwd });

  return result.status === 0 ? result.stdout.trim() : null;
};

const baseOf = (cwd: string) => {
  const upstream = git(cwd, ['rev-parse', '--abbrev-ref', '@{u}']);
  const branch = git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const own = branch === null ? null : `origin/${branch}`;
  const base =
    own !== null && git(cwd, ['rev-parse', '--verify', '--quiet', `refs/remotes/${own}`]) !== null
      ? own
      : (upstream ?? 'origin/next');

  return { base, strayUpstream: upstream !== null && upstream !== base ? upstream : null };
};

const ciOfRun = ({ status, conclusion }: CiRun): CiState => {
  if (status !== 'completed') return 'running';
  if (conclusion === 'success') return 'green';

  return conclusion ? 'red' : 'unknown';
};

/** The CI state of the newest run in `gh run list --json status,conclusion,url,createdAt` output that was not cancelled or skipped. */
export const ciStatusOfRuns = (json: string): CiStatus => {
  let runs: CiRun[];

  try {
    runs = JSON.parse(json) as CiRun[];
  } catch {
    return UNKNOWN_CI;
  }

  const run = Array.isArray(runs) ? runs.find((entry) => !SKIPPED_CONCLUSIONS.includes(entry.conclusion)) : undefined;

  if (!run) return UNKNOWN_CI;

  return { ci: ciOfRun(run), ciUrl: run.url ?? null, ciAt: run.createdAt ?? null };
};

/** Where `ciStatusOf` caches the CI state of one checkout. */
export const ciCachePath = (checkout: string) =>
  join(tmpdir(), 'ethlete-studio-checks', `${flattened(checkout)}.ci.json`);

type CiCache = { head: string; fetchedAt: number; status: CiStatus };

const cachedCi = (checkout: string, { head, now }: { head: string; now: number }) => {
  try {
    const cache = JSON.parse(readFileSync(ciCachePath(checkout), 'utf8')) as CiCache;

    return cache.head === head && now - cache.fetchedAt < CI_CACHE_MS ? cache.status : null;
  } catch {
    return null;
  }
};

export type StatusOptions = { now?: number; gh?: string };

/**
 * The state of the latest finished or running "CI (Next)" run on GitHub, through `gh`, cached for a minute per
 * pushed head of `next`. No `gh`, no network or any error gives `unknown`. Blocks for the `gh` call: never call it
 * on a server thread.
 */
export const ciStatusOf = (checkout: string, { now = Date.now(), gh = 'gh' }: StatusOptions = {}): CiStatus => {
  const head = git(checkout, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/next']);

  if (head === null) return UNKNOWN_CI;

  const cached = cachedCi(checkout, { head, now });

  if (cached) return cached;

  const result = spawnPlain(
    [
      gh,
      'run',
      'list',
      '--workflow',
      CI_WORKFLOW,
      '--branch',
      'next',
      '--limit',
      '10',
      '--json',
      'status,conclusion,url,createdAt',
    ],
    { cwd: checkout, timeout: 15_000 },
  );
  const status = result.status === 0 ? ciStatusOfRuns(result.stdout) : UNKNOWN_CI;

  try {
    mkdirSync(join(ciCachePath(checkout), '..'), { recursive: true });
    writeFileSync(ciCachePath(checkout), JSON.stringify({ head, fetchedAt: now, status } satisfies CiCache));
  } catch {
    return status;
  }

  return status;
};

/** The commits of `checkout` the remote does not have yet and the age of the oldest. */
export const pushStatusOf = (
  checkout: string,
  { now = Date.now(), gh = 'gh' }: StatusOptions = {},
): PushStatus | null => {
  const { base, strayUpstream } = baseOf(checkout);
  const head = git(checkout, ['rev-parse', 'HEAD']);
  const stamps = git(checkout, ['log', '--format=%cI', `${base}..HEAD`]);

  if (head === null || stamps === null) return null;

  const dates = stamps.split('\n').filter(Boolean);
  const oldest = dates.map((date) => Date.parse(date)).sort((a, b) => a - b)[0];

  return {
    base,
    strayUpstream,
    unpushed: dates.length,
    oldestAt: oldest === undefined ? null : new Date(oldest).toISOString(),
    oldestAgeHours: oldest === undefined ? null : Math.round(((now - oldest) / 3_600_000) * 10) / 10,
    ...ciStatusOf(checkout, { now, gh }),
  };
};

export const pushStatusLines = (status: PushStatus) => [
  status.unpushed === 0
    ? `nothing unpushed (${status.base})`
    : `${status.unpushed} unpushed commit(s) on ${status.base}, oldest ${status.oldestAgeHours} h old`,
  `ci: ${status.ci}${status.ci === 'red' ? ' - fix or revert before any feature slice' : ''}${status.ciUrl ? ` (${status.ciUrl})` : ''}`,
  ...(status.strayUpstream === null
    ? []
    : [
        `warning: the upstream is ${status.strayUpstream}, not ${status.base}; run git branch --set-upstream-to=${status.base}`,
      ]),
];
