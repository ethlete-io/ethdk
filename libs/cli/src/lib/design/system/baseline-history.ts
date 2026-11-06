import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { basename, dirname } from 'path';

/** The entries of a baseline file's text, each as its name and the identity a committed version must hold. */
export type BaselineIdentitiesOf = (text: string) => [name: string, identity: string][];

/**
 * The names of the entries of the baseline `file` whose identity is not in every committed version of it, so the list
 * may only shrink: an entry added, added back or changed after the file was first committed counts. An uncommitted
 * file adds none.
 */
export const addedBaselineNamesOf = (options: { file: string; identitiesOf: BaselineIdentitiesOf }) => {
  const { file, identitiesOf } = options;

  if (!existsSync(file)) return [];

  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: dirname(file), maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  const path = `./${basename(file)}`;
  let versions: string[];

  try {
    versions = git(['log', '--format=%H', '--', path]).split('\n').filter(Boolean);
  } catch {
    return [];
  }

  const committed = versions.map((sha) => {
    try {
      return new Set(identitiesOf(git(['show', `${sha}:${path}`])).map(([, identity]) => identity));
    } catch {
      return new Set<string>();
    }
  });

  return identitiesOf(readFileSync(file, 'utf8'))
    .filter(([, identity]) => committed.some((set) => !set.has(identity)))
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
};
