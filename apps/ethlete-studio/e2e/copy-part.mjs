import { cpSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const SOURCE = /\.(ts|css)$/u;
const RELATIVE_SPECIFIER = /(['"])(\.{1,2}\/[^'"]+)\1/gu;

const insideOf = (dir, path) => {
  const rest = relative(dir, path);

  return !rest.startsWith('..') && !isAbsolute(rest);
};

const sourceFilesIn = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return sourceFilesIn(path);

    return SOURCE.test(entry.name) ? [path] : [];
  });

/**
 * Copies the part folder `from` to `to` as `et design sketch` does: a relative import that leaves `from` is
 * rewritten to reach the same file from `to`.
 */
export const copyPart = (from, to) => {
  cpSync(from, to, { recursive: true });

  for (const file of sourceFilesIn(to)) {
    const original = resolve(from, relative(to, file));
    const source = readFileSync(file, 'utf8');
    const rewritten = source.replace(RELATIVE_SPECIFIER, (match, quote, specifier) => {
      const path = resolve(dirname(original), specifier);

      if (insideOf(from, path)) return match;

      const rebased = relative(dirname(file), path).split(sep).join('/');

      return `${quote}${rebased.startsWith('.') ? rebased : `./${rebased}`}${quote}`;
    });

    if (rewritten !== source) writeFileSync(file, rewritten);
  }
};
