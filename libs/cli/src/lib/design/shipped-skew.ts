import { readFileSync } from 'fs';
import { resolve } from 'path';

const ERROR_START = /^(\S.*?)\(\d+,\d+\): error TS\d+/;
const SHIPPED = /^(.*?node_modules\/@ethlete\/components)\/design\//;

/**
 * Folds the type errors of the design parts an installed `@ethlete/components` ships into one line. Those files
 * are not the checkout's own: an error in them means the installed components and cli versions do not fit, and
 * dozens of them would push the checkout's own errors out of the trimmed output.
 */
export const collapseShippedErrors = (raw: string, cwd: string) => {
  const blocks: string[][] = [];

  for (const line of raw.split('\n')) {
    if (ERROR_START.test(line) || blocks.length === 0) blocks.push([line]);
    else blocks[blocks.length - 1]?.push(line);
  }

  const shipped = new Map<string, string[]>();
  const own: string[] = [];

  for (const block of blocks) {
    const file = ERROR_START.exec(block[0] ?? '')?.[1];
    const root = file ? SHIPPED.exec(file)?.[1] : undefined;

    if (!file || !root) own.push(...block);
    else shipped.set(root, [...(shipped.get(root) ?? []), file]);
  }

  const lines = [...shipped].map(([root, files]) => {
    const version = versionOf(resolve(cwd, root));

    return `SDK-VERSION-SKEW ${root}${version ? ` (${version})` : ''}: ${files.length} type errors in the design parts it ships, first in ${files[0]} - they do not fit the installed @ethlete/cli, install matching versions of both`;
  });

  return [...own.filter((line) => line.trim() !== ''), ...lines].join('\n');
};

const versionOf = (root: string) => {
  try {
    return (JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
};
