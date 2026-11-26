import { Observable, map } from 'rxjs';
import { TimetrackProcessRunner } from '../transport/ports';

export const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const git$ = (options: {
  context: { repoPath: string; processes: TimetrackProcessRunner };
  args: string[];
}): Observable<void> =>
  options.context.processes.run$({ command: 'git', args: options.args, cwd: options.context.repoPath }).pipe(
    map((result) => {
      if (result.code !== 0)
        throw new Error(result.stderr.trim() || `git ${options.args[0]} exited with ${result.code}`);
    }),
  );
