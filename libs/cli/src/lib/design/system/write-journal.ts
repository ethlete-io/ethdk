import { gitStatusOf } from '../git-reader';
import {
  closeSync,
  cpSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from 'fs';
import { basename, dirname, resolve, sep } from 'path';
import { setTimeout as pause } from 'timers/promises';
import { threadId } from 'worker_threads';
import { productCacheDirOf } from './product';

type Image = { path: string; image: string | null };

export type JournalCommit = { top: string; head: string; subject: string; paths: string[] };

type Manifest = { label: string; pid: number; root: string; before: Image[]; after: Image[]; commit?: JournalCommit };

type OpenJournal = { dir: string; productDir: string; manifest: Manifest; handle: WriteJournal };

export type WriteJournal = {
  close: () => void;
  rollback: () => void;
  markCommit: (commit: JournalCommit) => void;
  keepAfter: (path: string, text: string) => void;
};

const JOURNAL = 'journal';
const WAIT_MS = 10_000;
const MANIFEST = 'manifest.json';

let current: OpenJournal | null = null;

const sleeper = new Int32Array(new SharedArrayBuffer(4));

const sleepSync = (ms: number) => Atomics.wait(sleeper, 0, 0, ms);

const ownSuffixOf = () => `${process.pid}-${threadId}`;

const journalDirOf = (productDir: string) => resolve(productCacheDirOf(resolve(productDir)), JOURNAL);

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const inside = (dir: string, path: string) => path === dir || path.startsWith(`${dir}${sep}`);

const exists = (path: string) => {
  try {
    lstatSync(path);

    return true;
  } catch {
    return false;
  }
};

const writeManifest = (dir: string, manifest: Manifest) => {
  const file = resolve(dir, MANIFEST);
  const tmp = `${file}.tmp`;
  const fd = openSync(tmp, 'w');

  try {
    writeSync(fd, JSON.stringify(manifest), null, 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }

  renameSync(tmp, file);
};

const MISSING = 'missing';

const readManifest = (dir: string): Manifest | null | typeof MISSING => {
  try {
    return JSON.parse(readFileSync(resolve(dir, MANIFEST), 'utf8')) as Manifest;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? MISSING : null;
  }
};

const copy = (from: string, to: string) => {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, verbatimSymlinks: true });
};

const drop = (dir: string) => {
  const gone = `${dir}.${ownSuffixOf()}.done`;

  renameSync(dir, gone);
  rmSync(gone, { recursive: true, force: true });
};

const landed = (commit: JournalCommit) => {
  const log = gitStatusOf(['log', '-1', '--format=%P%x00%s'], { cwd: commit.top });

  return log.status === 0 && log.stdout.trim() === `${commit.head}\0${commit.subject}`;
};

const restore = (dir: string, manifest: Manifest) => {
  if (manifest.commit && landed(manifest.commit)) {
    for (const { path, image } of manifest.after) if (image) copy(resolve(dir, image), path);

    return 'finished';
  }

  for (const { path, image } of [...manifest.before].reverse()) {
    if (image) copy(resolve(dir, image), path);
    else rmSync(path, { recursive: true, force: true });
  }

  const commit = manifest.commit;

  if (commit) for (const path of commit.paths) gitStatusOf(['reset', '-q', '--', path], { cwd: commit.top });

  return 'undid';
};

const dropDeadLeftovers = (dir: string) => {
  const parent = dirname(dir);

  if (!existsSync(parent)) return;

  for (const name of readdirSync(parent)) {
    const match = new RegExp(`^${JOURNAL}\\.(\\d+)-\\d+\\.(?:done|new)$`, 'u').exec(name);

    if (match && !isAlive(Number(match[1]))) rmSync(resolve(parent, name), { recursive: true, force: true });
  }
};

/**
 * Finishes or undoes the journaled write of a process that died before it closed its journal: a step whose git commit
 * landed is rolled forward, any other is undone file by file. Answers what it did, or `null` when no dead journal is
 * there. Call it while holding the product lock.
 */
export const recoverJournal = (productDir: string): string | null => {
  const dir = journalDirOf(productDir);

  dropDeadLeftovers(dir);

  if (!existsSync(dir)) return null;

  const manifest = readManifest(dir);

  // `created` moves a journal into place with its manifest, so a missing one means another thread just dropped it.
  if (manifest === MISSING || (manifest && isAlive(manifest.pid))) return null;

  const how = manifest ? restore(dir, manifest) : 'dropped';

  drop(dir);

  return `${how} the interrupted ${manifest?.label ?? 'write'} of ${basename(productDir)}`;
};

/** Whether `productDir` holds a journal a recovery may have to finish. */
export const hasJournal = (productDir: string) => existsSync(journalDirOf(productDir));

/**
 * Records the state of `path` before the open journal's first write to it, so a killed step can be undone; does
 * nothing without an open journal, or for a path outside its checkout or inside a path it already holds.
 */
export const noteWrite = (path: string) => {
  if (!current) return;

  const file = resolve(path);
  const { dir, manifest } = current;

  if (!inside(manifest.root, file) || inside(dir, file)) return;
  if (manifest.before.some((entry) => inside(entry.path, file))) return;

  const name = `before-${manifest.before.length}`;
  const image = exists(file) ? name : null;

  if (image) copy(file, resolve(dir, image));

  manifest.before.push({ path: file, image });
  writeManifest(dir, manifest);
};

const joinedOf = (open: OpenJournal): WriteJournal => ({
  ...open.handle,
  close: () => undefined,
  rollback: () => undefined,
});

const created = ({ fresh, dir, manifest }: { fresh: string; dir: string; manifest: Manifest }) => {
  rmSync(fresh, { recursive: true, force: true });
  mkdirSync(fresh, { recursive: true });
  writeManifest(fresh, manifest);

  try {
    renameSync(fresh, dir);

    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== 'ENOTEMPTY' && code !== 'EEXIST') throw error;

    rmSync(fresh, { recursive: true, force: true });

    return false;
  }
};

type JournalOptions = { productDir: string; root: string; label: string; waitMs?: number };

type Attempt = { opened: () => WriteJournal | null; deadline: number; timedOut: () => Error };

const attemptOf = (options: JournalOptions): Attempt | WriteJournal => {
  const productDir = resolve(options.productDir);

  if (current?.productDir === productDir) return joinedOf(current);
  if (current) throw new Error(`${options.label}: the ${current.manifest.label} still writes`);

  const dir = journalDirOf(productDir);
  const manifest: Manifest = {
    label: options.label,
    pid: process.pid,
    root: resolve(options.root),
    before: [],
    after: [],
  };
  const fresh = `${dir}.${ownSuffixOf()}.new`;
  let left: Manifest | null = null;

  const opened = () => {
    recoverJournal(productDir);

    const seen = existsSync(dir) ? readManifest(dir) : null;

    left = seen === MISSING ? null : seen;

    if (left || !created({ fresh, dir, manifest })) return null;

    const close = () => {
      current = null;
      drop(dir);
    };
    const handle: WriteJournal = {
      close,
      rollback: () => {
        restore(dir, manifest);
        close();
      },
      markCommit: (commit) => {
        manifest.commit = commit;
        writeManifest(dir, manifest);
      },
      keepAfter: (path, text) => {
        const image = `after-${manifest.after.length}`;
        const fd = openSync(resolve(dir, image), 'w');

        try {
          writeSync(fd, text, null, 'utf8');
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }

        manifest.after.push({ path: resolve(path), image });
        writeManifest(dir, manifest);
      },
    };

    current = { dir, productDir, manifest, handle };

    return handle;
  };
  const timedOut = () =>
    new Error(
      `${options.label} waits: the ${left?.label ?? 'journaled write'} of pid ${left?.pid ?? '?'} has not finished (${dir}) - wait for it, or stop it`,
    );

  return { opened, deadline: Date.now() + (options.waitMs ?? WAIT_MS), timedOut };
};

const isAttempt = (value: Attempt | WriteJournal): value is Attempt => 'opened' in value;

const pauseMs = () => 25 + Math.floor(Math.random() * 25);

/**
 * Opens the write journal of a product: until `close`, every write to a file below `root` that goes through
 * `noteWrite` first keeps the file's old state, so a process killed half way is undone (or, once its git commit
 * landed, finished) by the next process that takes the product lock. One journal per thread; a nested open of the same
 * product joins it (its `close` and `rollback` leave both to the outer one), another product throws. Waits up to
 * `waitMs` (10 s) while another thread or process has the product's journal open, and throws naming it after that.
 */
export const openJournal = (options: JournalOptions): WriteJournal => {
  const attempt = attemptOf(options);

  if (!isAttempt(attempt)) return attempt;

  for (;;) {
    const journal = attempt.opened();

    if (journal) return journal;
    if (Date.now() >= attempt.deadline) throw attempt.timedOut();

    sleepSync(pauseMs());
  }
};

const runIn = <T>(journal: WriteJournal, run: () => T): T => {
  try {
    const result = run();

    journal.close();

    return result;
  } catch (error) {
    journal.rollback();

    throw error;
  }
};

/** The journal this process has open, if any. */
export const openJournalOf = (): WriteJournal | null => (current ? joinedOf(current) : null);

/** Runs `run` inside a journal of `productDir` (see `openJournal`): a throw undoes its writes and rethrows. */
export const journaled = <T>(options: JournalOptions, run: () => T): T => runIn(openJournal(options), run);

/**
 * `journaled` for a thread that must keep serving while it waits: the wait for another holder's journal yields to the
 * event loop instead of blocking it. `run` stays synchronous, so no other task of this thread sees the open journal.
 */
export const journaledAsync = async <T>(options: JournalOptions, run: () => T): Promise<T> => {
  const attempt = attemptOf(options);

  if (!isAttempt(attempt)) return runIn(attempt, run);

  for (;;) {
    const journal = attempt.opened();

    if (journal) return runIn(journal, run);
    if (Date.now() >= attempt.deadline) throw attempt.timedOut();

    await pause(pauseMs());
  }
};
