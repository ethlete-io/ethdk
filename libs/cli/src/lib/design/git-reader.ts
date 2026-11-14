import { execFile, execFileSync, spawnSync, StdioOptions } from 'child_process';

const MAX_BUFFER = 1 << 28;

export type GitOptions = {
  cwd?: string;
  input?: string | Buffer;
  env?: NodeJS.ProcessEnv;
  stdio?: StdioOptions;
  maxBuffer?: number;
};

/**
 * Runs one git command and answers its stdout as text. Throws like `execFileSync` on a non-zero exit; `stdio` defaults
 * to node's, which passes stderr through.
 */
export const git = (args: string[], options: GitOptions = {}): string =>
  execFileSync('git', args, { maxBuffer: MAX_BUFFER, ...options, encoding: 'utf8' });

/** `git` that answers stdout as raw bytes, for blobs and binary output. */
export const gitBytes = (args: string[], options: GitOptions = {}): Buffer =>
  execFileSync('git', args, { maxBuffer: MAX_BUFFER, ...options });

/** Runs one git command without throwing and answers its exit status and text output, like `spawnSync`. */
export const gitStatusOf = (args: string[], options: GitOptions = {}) =>
  spawnSync('git', args, { maxBuffer: MAX_BUFFER, ...options, encoding: 'utf8' });

/** One git command that does not block the event loop: the trimmed stdout, or `null` on any failure or after `timeout` ms. */
export const gitLater = (args: string[], options: { cwd?: string; timeout?: number } = {}) =>
  new Promise<string | null>((done) =>
    execFile('git', args, { maxBuffer: MAX_BUFFER, ...options }, (error, stdout) => done(error ? null : stdout.trim())),
  );

/** Each object of a `git cat-file --batch` output in input order: its bytes, or `null` when missing or not a blob. */
export const catFileBatchOf = (output: Buffer): (Buffer | null)[] => {
  const blobs: (Buffer | null)[] = [];

  for (let at = 0; at < output.length;) {
    const end = output.indexOf(0x0a, at);

    if (end === -1) break;

    const found = /^[0-9a-f]+ (\S+) (\d+)$/u.exec(output.subarray(at, end).toString('utf8'));
    const size = found ? Number(found[2]) : -1;

    blobs.push(found?.[1] === 'blob' ? output.subarray(end + 1, end + 1 + size) : null);
    at = found ? end + 2 + size : end + 1;
  }

  return blobs;
};

/**
 * The blobs `objects` name (`<rev>:<path>` or an object id), in one `git cat-file --batch`: each one's bytes, or `null`
 * when it is missing or not a blob. A name with a line break cannot go through the batch and answers `null`.
 */
export const catFilesOf = (objects: string[], options: Pick<GitOptions, 'cwd' | 'env'> = {}): (Buffer | null)[] => {
  const batched = objects.filter((object) => !object.includes('\n'));

  if (batched.length === 0) return objects.map(() => null);

  const blobs = catFileBatchOf(
    gitBytes(['cat-file', '--batch'], {
      ...options,
      input: batched.map((object) => `${object}\n`).join(''),
      stdio: ['pipe', 'pipe', 'pipe'],
    }),
  );
  let next = 0;

  return objects.map((object) => (object.includes('\n') ? null : (blobs[next++] ?? null)));
};

/** The content of each of `paths` (relative to the repository root) at `rev`, read in one git process. */
export const showFilesOf = (options: {
  cwd: string;
  rev: string;
  paths: string[];
  env?: NodeJS.ProcessEnv;
}): Map<string, Buffer | null> => {
  const unique = [...new Set(options.paths)];
  const blobs = catFilesOf(
    unique.map((path) => `${options.rev}:${path}`),
    { cwd: options.cwd, env: options.env },
  );

  return new Map(unique.map((path, index) => [path, blobs[index] ?? null]));
};

/** Each commit `git log <args>` lists, newest first, with the paths `--name-only` names for it, in one git process. */
export const logNamesOf = (args: string[], options: Pick<GitOptions, 'cwd' | 'env' | 'stdio'> = {}) =>
  gitBytes(['-c', 'core.quotePath=false', 'log', '--format=%x00%H', '--name-only', ...args], options)
    .toString('utf8')
    .split('\0')
    .filter((entry) => entry !== '')
    .map((entry) => {
      const [commit = '', ...paths] = entry.split('\n').filter(Boolean);

      return { commit, paths };
    });
