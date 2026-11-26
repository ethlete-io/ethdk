import { ChildProcess, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'fs';
import { basename, dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { createGunzip, createGzip } from 'zlib';
import { markApiStateDirty, writeApiState } from './api-state';
import { ApiProfile } from './definition';
import { DEFAULT_CHECKOUT_DIR } from './clone';
import { shellQuote } from './seeds';

export type ApiSnapshotConfig = NonNullable<ApiProfile['snapshot']>;

/** How to reach the container engine: the compose binary with its fixed arguments, in the API's compose directory. */
export type ComposeInvocation = {
  binary: string;
  prefix: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
};

const SNAPSHOT_SUFFIX = '.sql.gz';

export const SNAPSHOT_NAME = /^[\w.-]+$/;

export const snapshotsDirectory = (root: string, api: string) => join(root, DEFAULT_CHECKOUT_DIR, 'snapshots', api);

export const snapshotFileName = (options: { name: string; fingerprint: string }) =>
  `${options.name}-${options.fingerprint}${SNAPSHOT_SUFFIX}`;

export const snapshotFilePath = (options: { root: string; api: string; name: string; fingerprint: string }) =>
  join(snapshotsDirectory(options.root, options.api), snapshotFileName(options));

/** The snapshot files of one API, or only the ones made for `fingerprint`. */
export const listSnapshots = (options: { root: string; api: string; fingerprint?: string }) => {
  const directory = snapshotsDirectory(options.root, options.api);

  if (!existsSync(directory)) return [];

  return readdirSync(directory)
    .filter((file) => file.endsWith(SNAPSHOT_SUFFIX))
    .filter((file) => options.fingerprint === undefined || file.endsWith(`-${options.fingerprint}${SNAPSHOT_SUFFIX}`))
    .sort();
};

const snapshotScript = (snapshot: ApiSnapshotConfig, line: string) =>
  `export DATABASES=${shellQuote(snapshot.databases.join(' '))}\n${line}`;

const composeExecArgs = (options: { compose: ComposeInvocation; snapshot: ApiSnapshotConfig; line: string }) => [
  ...options.compose.prefix,
  'exec',
  '-T',
  options.snapshot.service,
  'sh',
  '-c',
  snapshotScript(options.snapshot, options.line),
];

const exitCodeOf = (child: ChildProcess) =>
  new Promise<number>((resolve) => {
    child.once('error', (error) => {
      console.error(`Could not run ${basename(child.spawnfile)}: ${error.message}`);
      resolve(127);
    });
    child.once('close', (code, signal) => resolve(code ?? (signal ? 128 : 1)));
  });

/** Pipes `producer`'s stdout through gzip into `file`, which appears only when the producer exits 0. */
export const pipeToGzipFile = async (options: {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  file: string;
}) => {
  const { command, args, cwd, env, file } = options;
  const temporary = `${file}.${randomUUID()}.tmp`;

  mkdirSync(dirname(file), { recursive: true });

  const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'inherit'] });
  const code = exitCodeOf(child);
  const written = child.stdout
    ? pipeline(child.stdout, createGzip(), createWriteStream(temporary)).then(
        () => true,
        () => false,
      )
    : Promise.resolve(false);
  const [exitCode, complete] = await Promise.all([code, written]);

  if (exitCode === 0 && complete) {
    renameSync(temporary, file);

    return 0;
  }

  rmSync(temporary, { force: true });

  return exitCode === 0 ? 1 : exitCode;
};

/** Pipes the gunzipped `file` into the stdin of `consumer` and returns its exit code. */
export const pipeFromGzipFile = async (options: {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  file: string;
}) => {
  const { command, args, cwd, env, file } = options;
  const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'inherit', 'inherit'] });
  const code = exitCodeOf(child);
  const read = child.stdin
    ? pipeline(createReadStream(file), createGunzip(), child.stdin).then(
        () => true,
        () => false,
      )
    : Promise.resolve(false);
  const [exitCode, complete] = await Promise.all([code, read]);

  return exitCode === 0 && !complete ? 1 : exitCode;
};

/** Dumps the profile's databases into `file`. Safe to call while holding the API lock. */
export const saveSnapshot = async (options: {
  file: string;
  snapshot: ApiSnapshotConfig;
  compose: ComposeInvocation;
}): Promise<number> => {
  const { file, snapshot, compose } = options;
  const code = await pipeToGzipFile({
    command: compose.binary,
    args: composeExecArgs({ compose, snapshot, line: snapshot.save }),
    cwd: compose.cwd,
    env: compose.env,
    file,
  });

  if (code !== 0) console.error(`Saving the snapshot failed with exit code ${code}. Nothing was written to ${file}.`);

  return code;
};

/**
 * Loads `file` into the profile's databases. With `state`, a success records the API as clean for that
 * profile and fingerprint and a failure marks it dirty. Safe to call while holding the API lock.
 */
export const restoreSnapshot = async (options: {
  file: string;
  snapshot: ApiSnapshotConfig;
  compose: ComposeInvocation;
  state?: { directory: string; profile: string; fingerprint: string };
}): Promise<number> => {
  const { file, snapshot, compose, state } = options;

  if (!existsSync(file)) {
    const directory = dirname(file);
    const names = existsSync(directory) ? readdirSync(directory).filter((name) => name.endsWith(SNAPSHOT_SUFFIX)) : [];

    console.error(
      names.length === 0
        ? `No snapshot at ${file}, and none exist for this API.`
        : `No snapshot at ${file}. These exist:\n\n${names.map((name) => `  ${name}`).join('\n')}`,
    );

    return 1;
  }

  const code = await pipeFromGzipFile({
    command: compose.binary,
    args: composeExecArgs({ compose, snapshot, line: snapshot.restore }),
    cwd: compose.cwd,
    env: compose.env,
    file,
  });

  if (code !== 0) {
    console.error(`Restoring the snapshot failed with exit code ${code}.`);

    if (state) markApiStateDirty(state.directory);

    return code;
  }

  if (state) {
    writeApiState({
      directory: state.directory,
      state: { profile: state.profile, fingerprint: state.fingerprint, dirty: false },
    });
  }

  return 0;
};
