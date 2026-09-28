import { Observable, forkJoin, map, of } from 'rxjs';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { GIT_REFLOG_FORMAT } from './format';
import { branchOrNothing, gitBranchSwitchesIn } from './reflog-switch';

/**
 * How far back the reflog is read. A switch older than this is not found, and the checkout reports no
 * branch rather than a wrong one. 500 covers months of ordinary work in one process call.
 */
const REFLOG_DEPTH = 500;

const headReflogSpec = (repoPath: string): ProcessSpec => ({
  command: 'git',
  args: ['reflog', 'show', `-n${REFLOG_DEPTH}`, '--date=iso-strict', `--format=${GIT_REFLOG_FORMAT}`],
  cwd: repoPath,
});

/**
 * Which branch a checkout was on at an instant, read from `git reflog show` output.
 *
 * The newest switch at or before the instant names it. When every switch in the reflog is younger than
 * the instant, the oldest of them says where HEAD came from, and that is the branch of the day being
 * asked about. A reflog holding no switch at all answers nothing.
 */
export const parseHeadBranchAt = (options: { output: string; at: Date }) => {
  const switches = gitBranchSwitchesIn(options.output);
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
