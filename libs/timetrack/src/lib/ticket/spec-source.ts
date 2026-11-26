import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { Evidence } from '../model/evidence';
import { TimetrackProcessRunner, TimetrackSpecSource } from '../transport/ports';
import { SpecHeader, readSpecHeader, touchedDirectories } from './spec';

/** How a commit's short sha is printed into the evidence a band carries. */
const SHA_PREFIX = /^([0-9a-f]{7,40})\s/;

/** More commits than this say nothing more about which directory the work sat in. */
const MAX_COMMITS = 40;

/**
 * Pulls the short shas out of a band's commit evidence.
 *
 * The stream writes a commit's detail as `<sha> <subject>`, and that string is the only place a sha
 * survives into a work group — the stored event keeps one, but the band that reaches the ticket form
 * carries evidence, not events.
 */
export const shasFromEvidence = (evidence: readonly Evidence[]): string[] => {
  const shas: string[] = [];

  for (const entry of evidence) {
    if (entry.kind !== 'commit') continue;

    const sha = SHA_PREFIX.exec(entry.detail)?.[1];

    if (sha && !shas.includes(sha)) shas.push(sha);
  }

  return shas.slice(0, MAX_COMMITS);
};

/**
 * `--no-walk` limits the log to the commits named rather than their history, and an empty `--pretty`
 * leaves only the paths. `log` is the operation the host allowlist permits; `show` is not.
 */
export const specPathArgs = (shas: readonly string[]) => [
  'log',
  '--no-walk',
  '--name-only',
  '--pretty=format:',
  ...shas,
];

/**
 * Finds the spec the work was written against, by asking which files its commits touched and reading
 * the first directory among them that holds one.
 *
 * Answers null wherever the guess does not land: no commits, a checkout whose commits touched nothing
 * that looks like a spec, or a git call that failed. A ticket is written without a spec in that case,
 * which is what every ticket had before this.
 */
export const specForCommits$ = (options: {
  repoPath: string;
  shas: readonly string[];
  processes: TimetrackProcessRunner;
  specs: TimetrackSpecSource;
}): Observable<SpecHeader | null> => {
  if (!options.shas.length) return of(null);

  return options.processes.run$({ command: 'git', args: specPathArgs(options.shas), cwd: options.repoPath }).pipe(
    map((result) =>
      result.code === 0 ? touchedDirectories(result.stdout.split('\n').map((line) => line.trim())) : [],
    ),
    switchMap((directories) =>
      directories.length ? options.specs.read$({ repoPath: options.repoPath, directories }) : of(null),
    ),
    map((files) => (files ? readSpecHeader({ metadata: files.metadata, index: files.index }) : null)),
    catchError(() => of(null)),
  );
};
