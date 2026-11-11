import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { formattedTextOf } from './design/system/prettier';

/** `text` (JSON) formatted as `file` by the target checkout's Prettier; unchanged without Prettier or when it fails. */
export const formattedJsonTextOf = (options: { target: string; file: string; text: string }) => {
  const formatted = formattedTextOf({ ...options, file: resolve(options.target, options.file) });

  return typeof formatted === 'string' ? formatted : options.text;
};

/** Writes `text` to `file` unless the file already holds exactly that text, so an equal file keeps its mtime. */
export const writeChangedFile = (file: string, text: string) => {
  if (existsSync(file) && readFileSync(file, 'utf8') === text) return;

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text, 'utf8');
};

/** `value` serialized as JSON and written to `file`, formatted like {@link formattedJsonTextOf}; an equal file stays untouched. */
export const writeJsonFile = (options: { file: string; value: unknown }) => {
  const file = resolve(options.file);
  const target = dirname(file);

  writeChangedFile(file, formattedJsonTextOf({ target, file, text: `${JSON.stringify(options.value, null, 2)}\n` }));
};
