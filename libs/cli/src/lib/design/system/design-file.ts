import { writeFileSync } from 'fs';
import { extname, resolve, sep } from 'path';
import { gitStatusOf } from '../git-reader';
import { formattedTextOf } from './prettier';

const DESIGN_SEGMENT = `${sep}.ethlete${sep}design${sep}`;
const FORMATTED = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.scss',
  '.html',
  '.md',
  '.yaml',
  '.yml',
]);

const checkoutOf = (file: string) => {
  const at = file.lastIndexOf(DESIGN_SEGMENT);

  return at === -1 ? null : file.slice(0, at) || sep;
};

const ignored = new Map<string, boolean>();

const isUncommittable = (root: string, file: string) => {
  const known = ignored.get(file);

  if (known !== undefined) return known;

  const result = gitStatusOf(['check-ignore', '-q', '--', file], { cwd: root }).status !== 1;

  ignored.set(file, result);

  return result;
};

/** Whether `file` lies under a `.ethlete/design` folder, is a type Prettier formats, and lies in a git checkout that does not ignore it. */
export const isFormattedDesignFile = (file: string) => {
  const absolute = resolve(file);
  const root = checkoutOf(absolute);

  return root !== null && FORMATTED.has(extname(absolute)) && !isUncommittable(root, absolute);
};

/**
 * `content` as it should land in `file`: formatted with the checkout's Prettier for a {@link isFormattedDesignFile},
 * else unchanged. A file Prettier cannot parse keeps its content as is.
 */
export const designContentOf = <T extends string | Buffer>(file: string, content: T): T | string => {
  const absolute = resolve(file);

  if (!isFormattedDesignFile(absolute)) return content;

  const root = checkoutOf(absolute) as string;
  const formatted = formattedTextOf({ target: root, file: absolute, text: content.toString() });

  return typeof formatted === 'string' ? formatted : content;
};

/**
 * Writes `content` to `file` like `writeFileSync`, formatted first when the file lies under `.ethlete/design` (see
 * {@link designContentOf}). Every write by a design command goes through here or `writeChangedFile`.
 */
export const writeDesignFile = (file: string, content: string | Buffer) =>
  writeFileSync(file, designContentOf(file, content));
