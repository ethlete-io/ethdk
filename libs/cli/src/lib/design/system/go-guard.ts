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

const IMPL_REFUSAL = 'needs --note "Impl Qnn": the decision of Tom that releases this part';

/** The number of the `Impl Qnn` entry a note names, or why the note names no written-down decision. */
export const decisionOf = (options: { root: string; note: string | undefined }) => {
  const number = options.note ? IMPL_NOTE.exec(options.note.trim())?.[1] : undefined;

  if (!number) return { refusal: IMPL_REFUSAL };

  const entry = new RegExp(`^\\s*-\\s+Impl Q${number}\\b`, 'm');

  if (!markdownFilesOf(join(options.root, 'plans')).some((file) => entry.test(readFileSync(file, 'utf8'))))
    return { refusal: `no plans entry "Impl Q${number}" found: --note must name a decision that is written down` };

  return { number };
};

/**
 * Checks a `go --by tom`: the note must name a committed `Impl Qnn` entry of the plans, else it answers the refusal.
 * A design file of the part that is uncommitted or committed after that entry is no refusal but a note for Tom's
 * confirm.
 */
export const tomGoCheckOf = (options: {
  root: string;
  note: string | undefined;
  files: FileHashes;
}): { refusal: string } | { notes: string[] } => {
  const { root, files } = options;
  const decided = decisionOf(options);

  if ('refusal' in decided) return { refusal: `go --by tom ${decided.refusal}` };

  const { number } = decided;
  const paths = Object.keys(files);

  try {
    const decisions = git(root, ['log', '-G', `^\\s*-\\s+Impl Q${number}\\b`, '--format=%H', '--', 'plans'])
      .split('\n')
      .filter(Boolean);
    const decision = decisions[decisions.length - 1];

    if (!decision) return { refusal: `Impl Q${number} is not committed yet: commit the decision first` };

    const short = git(root, ['rev-parse', '--short', decision]);
    const notes: string[] = [];

    if (git(root, ['status', '--porcelain', '--', ...paths]))
      notes.push(`design has uncommitted changes after Impl Q${number} (${short})`);

    const newer = git(root, ['log', '-1', '--format=%H', '--', ...paths]);

    if (newer) {
      try {
        git(root, ['merge-base', '--is-ancestor', newer, decision]);
      } catch {
        notes.push(`design changed after Impl Q${number} (${short})`);
      }
    }

    return { notes };
  } catch (error) {
    return {
      refusal: `go --by tom could not check the decision with git: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
