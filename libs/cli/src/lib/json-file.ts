import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from 'fs';
import { basename, dirname, resolve } from 'path';
import { formattedTextOf } from './design/system/prettier';
import { noteWrite } from './design/system/write-journal';

/** `text` (JSON) formatted as `file` by the target checkout's Prettier; unchanged without Prettier or when it fails. */
export const formattedJsonTextOf = (options: { target: string; file: string; text: string }) => {
  const formatted = formattedTextOf({ ...options, file: resolve(options.target, options.file) });

  return typeof formatted === 'string' ? formatted : options.text;
};

const tmpFileOf = (file: string) =>
  resolve(dirname(file), `.${basename(file)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`);

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const dropDeadTmpFiles = (file: string) => {
  const prefix = `.${basename(file)}.`;

  for (const name of readdirSync(dirname(file))) {
    if (!name.startsWith(prefix) || !name.endsWith('.tmp')) continue;

    const pid = Number.parseInt(name.slice(prefix.length), 10);

    if (Number.isInteger(pid) && !isAlive(pid)) rmSync(resolve(dirname(file), name), { force: true });
  }
};

/**
 * Writes `text` to `file` through a temporary file in the same folder and a rename, so a reader or a killed writer
 * sees either the old or the new text, never a part of it; the next write drops a dead writer's temporary file. An equal file is left untouched and keeps its mtime.
 */
export const writeChangedFile = (file: string, text: string | Buffer) => {
  const bytes = typeof text === 'string' ? Buffer.from(text, 'utf8') : text;

  if (existsSync(file) && readFileSync(file).equals(bytes)) return;

  noteWrite(file);
  mkdirSync(dirname(file), { recursive: true });
  dropDeadTmpFiles(file);

  const tmp = tmpFileOf(file);

  noteWrite(tmp);

  try {
    const fd = openSync(tmp, 'wx');

    try {
      writeSync(fd, bytes);
      // fsync before the rename: a crash after it must not leave an empty file under the real name.
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    renameSync(tmp, file);
  } catch (error) {
    rmSync(tmp, { force: true });

    throw error;
  }
};

/** `value` serialized as JSON and written to `file`, formatted like {@link formattedJsonTextOf}; an equal file stays untouched. */
export const writeJsonFile = (options: { file: string; value: unknown }) => {
  const file = resolve(options.file);
  const target = dirname(file);

  writeChangedFile(file, formattedJsonTextOf({ target, file, text: `${JSON.stringify(options.value, null, 2)}\n` }));
};
