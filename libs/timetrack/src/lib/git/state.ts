import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';

/** What a repository looks like locally, for a plan that has to refuse before it mutates anything. */
export type GitBranchState = {
  dirty: boolean;
  localBranches: string[];
  /** The remote the repository pushes to, and the branch names it holds. Absent when it has none. */
  remote?: { name: string; url: string; branches: string[] };
};

const spec = (options: { repoPath: string; args: string[] }): ProcessSpec => ({
  command: 'git',
  args: options.args,
  cwd: options.repoPath,
});

const lines = (output: string) =>
  output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** `origin` when it exists, so a repository with several remotes is not read through a fork. */
const preferredRemote = (names: string[]) => (names.includes('origin') ? 'origin' : names[0]);

/**
 * Reads the branch names, the remote and whether the working tree is clean.
 *
 * `--porcelain` is the stable spelling of `git status` and the only one worth parsing; untracked
 * files count as dirty, because a rename that strands them is the same surprise as one that strands
 * an edit. A failed command reads as "nothing found" rather than throwing, so one unreadable
 * repository refuses its own repair instead of failing the view around it.
 */
export const readGitBranchState$ = (options: {
  processes: TimetrackProcessRunner;
  repoPath: string;
}): Observable<GitBranchState> => {
  const { processes, repoPath } = options;
  const run$ = (args: string[]) => processes.run$(spec({ repoPath, args }));

  return forkJoin({
    status: run$(['status', '--porcelain']),
    locals: run$(['for-each-ref', '--format=%(refname:short)', 'refs/heads']),
    remotes: run$(['remote']),
  }).pipe(
    switchMap(({ status, locals, remotes }) => {
      const base = {
        dirty: status.code === 0 && lines(status.stdout).length > 0,
        localBranches: locals.code === 0 ? lines(locals.stdout) : [],
      };
      const name = remotes.code === 0 ? preferredRemote(lines(remotes.stdout)) : undefined;

      if (!name) return of<GitBranchState>(base);

      return forkJoin({
        branches: run$(['for-each-ref', '--format=%(refname:strip=3)', `refs/remotes/${name}`]),
        url: run$(['remote', 'get-url', name]),
      }).pipe(
        map(({ branches, url }): GitBranchState => ({
          ...base,
          remote: {
            name,
            url: url.code === 0 ? url.stdout.trim() : '',
            branches: branches.code === 0 ? lines(branches.stdout).filter((branch) => branch !== 'HEAD') : [],
          },
        })),
      );
    }),
  );
};
