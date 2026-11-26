import { catFilesOf, git as gitText } from '../git-reader';
import { existsSync, readFileSync } from 'fs';
import { basename, dirname } from 'path';

/** The entries of a baseline file's text, each as its name and the identity a committed version must hold. */
export type BaselineIdentitiesOf = (text: string) => [name: string, identity: string][];

/**
 * The names of the entries of the baseline `file` whose identity is not in every committed version of it, so the list
 * may only shrink: an entry added, added back or changed after the file was first committed counts. An uncommitted
 * file adds none. With `groupOf`, only a version that holds an identity of the same group counts, so a new group may
 * start with entries.
 */
export const addedBaselineNamesOf = (options: {
  file: string;
  identitiesOf: BaselineIdentitiesOf;
  groupOf?: (identity: string) => string;
}) => {
  const { file, identitiesOf, groupOf } = options;

  if (!existsSync(file)) return [];

  const git = (args: string[]) => gitText(args, { cwd: dirname(file), stdio: ['ignore', 'pipe', 'pipe'] });
  const path = `./${basename(file)}`;
  let versions: string[];

  try {
    versions = git(['log', '--format=%H', '--', path]).split('\n').filter(Boolean);
  } catch {
    return [];
  }

  let blobs: (Buffer | null)[];

  try {
    blobs = catFilesOf(
      versions.map((sha) => `${sha}:${path}`),
      { cwd: dirname(file) },
    );
  } catch {
    blobs = [];
  }

  const committed = versions.map(
    (_, index) => new Set(identitiesOf(blobs[index]?.toString('utf8') ?? '').map(([, identity]) => identity)),
  );

  return identitiesOf(readFileSync(file, 'utf8'))
    .filter(([, identity]) =>
      committed.some(
        (set) => !set.has(identity) && (!groupOf || [...set].some((other) => groupOf(other) === groupOf(identity))),
      ),
    )
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
};
