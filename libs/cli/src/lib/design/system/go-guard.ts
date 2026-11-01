import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { FileHashes } from './design-hash';

const IMPL_NOTE = /^Impl Q(\d+)$/;

const git = (root: string, args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const markdownFilesOf = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? markdownFilesOf(join(dir, entry.name))
          : entry.name.endsWith('.md')
            ? [join(dir, entry.name)]
            : [],
      )
    : [];

/**
 * Why a `go --by tom` is refused, or `null` when it may stand: the note must name an `Impl Qnn` entry of the plans,
 * and no design file of the part may be uncommitted or committed after the commit that recorded that entry.
 */
export const tomGoRefusalOf = (options: { root: string; note: string | undefined; files: FileHashes }) => {
  const { root, note, files } = options;
  const number = note ? IMPL_NOTE.exec(note.trim())?.[1] : undefined;

  if (!number) return 'go --by tom needs --note "Impl Qnn": the decision of Tom that releases this part';

  const entry = new RegExp(`^\\s*-\\s+Impl Q${number}\\b`, 'm');

  if (!markdownFilesOf(join(root, 'plans')).some((file) => entry.test(readFileSync(file, 'utf8'))))
    return `no plans entry "Impl Q${number}" found: --note must name a decision that is written down`;

  const paths = Object.keys(files);

  try {
    const decisions = git(root, ['log', '-G', `^\\s*-\\s+Impl Q${number}\\b`, '--format=%H', '--', 'plans'])
      .split('\n')
      .filter(Boolean);
    const decision = decisions.at(-1);

    if (!decision) return `Impl Q${number} is not committed yet: commit the decision first`;

    if (git(root, ['status', '--porcelain', '--', ...paths]))
      return `the design files of this part have uncommitted changes: Impl Q${number} (${decision}) does not cover them`;

    const newer = git(root, ['log', '-1', '--format=%H', '--', ...paths]);

    if (newer) {
      try {
        git(root, ['merge-base', '--is-ancestor', newer, decision]);
      } catch {
        return `the design changed after Impl Q${number}: decision commit ${decision}, newer design commit ${newer}`;
      }
    }
  } catch (error) {
    return `go --by tom could not check the decision with git: ${error instanceof Error ? error.message : String(error)}`;
  }

  return null;
};
