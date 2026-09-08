import { Observable, forkJoin, map, of } from 'rxjs';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { GIT_FIELD_SEPARATOR, GIT_REFLOG_FORMAT } from './format';

const SELECTOR = /^HEAD@\{(.+)\}$/;
const CHECKOUT = /^checkout: moving from (.+) to (.+)$/;

/** A detached checkout records the object name where a branch would be, and a commit is not a branch. */
const OBJECT_NAME = /^[0-9a-f]{7,40}$/;

/**
 * How far back the reflog is read. A switch older than this is not found, and the checkout reports no
 * branch rather than a wrong one. 500 covers months of ordinary work in one process call.
 */
const REFLOG_DEPTH = 500;

type BranchSwitch = { at: Date; from: string; to: string };

const headReflogSpec = (repoPath: string): ProcessSpec => ({
  command: 'git',
  args: ['reflog', 'show', `-n${REFLOG_DEPTH}`, '--date=iso-strict', `--format=${GIT_REFLOG_FORMAT}`],
  cwd: repoPath,
});

const switchesIn = (output: string) => {
  const found: BranchSwitch[] = [];

  for (const line of output.split('\n')) {
    const [selector, subject] = line.split(GIT_FIELD_SEPARATOR);
    const stamp = selector ? SELECTOR.exec(selector.trim())?.[1] : undefined;
    const moved = subject ? CHECKOUT.exec(subject.trim()) : null;
    const from = moved?.[1];
    const to = moved?.[2];

    if (!stamp || !from || !to) continue;

    const at = new Date(stamp);

    if (Number.isNaN(at.getTime())) continue;

    found.push({ at, from, to });
  }

  return found.sort((a, b) => a.at.getTime() - b.at.getTime());
};

const branchOrNothing = (name: string) => (OBJECT_NAME.test(name) ? undefined : name);

/**
 * Which branch a checkout was on at an instant, read from `git reflog show` output.
 *
 * The newest switch at or before the instant names it. When every switch in the reflog is younger than
 * the instant, the oldest of them says where HEAD came from, and that is the branch of the day being
 * asked about. A reflog holding no switch at all answers nothing.
 */
export const parseHeadBranchAt = (options: { output: string; at: Date }) => {
  const switches = switchesIn(options.output);
  const before = switches.filter((entry) => entry.at.getTime() <= options.at.getTime()).pop();

  if (before) return branchOrNothing(before.to);

  const oldest = switches[0];

  return oldest ? branchOrNothing(oldest.from) : undefined;
};

/**
 * The branch each checkout was on at an instant.
 *
 * This is the answer for a checkout a day holds no git event and no agent session for: nothing that
 * day says which branch it was on, and the reflog does. A repository whose reflog cannot be read is
 * left out rather than failing the others.
 */
export const readHeadBranches$ = (options: {
  processes: TimetrackProcessRunner;
  repoPaths: readonly string[];
  at: Date;
}): Observable<Record<string, string>> => {
  if (!options.repoPaths.length) return of({});

  return forkJoin(
    options.repoPaths.map((repoPath) =>
      options.processes.run$(headReflogSpec(repoPath)).pipe(
        map((result) => ({
          repoPath,
          branch: result.code === 0 ? parseHeadBranchAt({ output: result.stdout, at: options.at }) : undefined,
        })),
      ),
    ),
  ).pipe(
    map((found) =>
      found.reduce<Record<string, string>>(
        (all, one) => (one.branch ? { ...all, [one.repoPath]: one.branch } : all),
        {},
      ),
    ),
  );
};
