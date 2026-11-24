import { dirname } from 'path';
import { git } from '../../git-reader';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { EDIT_NEW, EDIT_OLD } from './edit-old-base';
import { isEditSketch } from './merged-parts';
import { Sketch } from './sketch';

export type EditCommit = { hash: string; subject: string };

export type EditStates = { removed: string[]; added: string[]; redrawn: string[] };

type EditTarget = {
  part?: string;
  variant: string;
  states: string[];
  unchanged?: string[];
  changes?: { added: string[]; dropped: string[] };
};

/** The commits after `since` up to HEAD that changed `partDir`, newest first; empty when git cannot answer. */
export const editCommitsOf = ({ partDir, since }: { partDir: string; since: string | undefined }): EditCommit[] => {
  if (!since) return [];

  try {
    return git(['log', '--format=%h%x00%s', `${since}..HEAD`, '--', '.'], { cwd: partDir, stdio: 'pipe' })
      .split('\n')
      .filter((line) => line.includes('\0'))
      .map((line) => {
        const [hash = '', subject = ''] = line.split('\0');

        return { hash, subject };
      });
  } catch {
    return [];
  }
};

/**
 * How the `new` of an edit sketch draws `part` apart from its `old`: the states it removes, adds and draws differently.
 * The `old` target is compared against the product, which is `new` itself.
 */
export const editStatesOf = (targets: readonly EditTarget[], part: string): EditStates => {
  const old = targets.find((entry) => entry.variant === EDIT_OLD && (entry.part ?? part) === part);
  const unchanged = old?.unchanged;

  return {
    removed: old?.changes?.added ?? [],
    added: old?.changes?.dropped ?? [],
    redrawn: unchanged
      ? (old?.states ?? []).filter(
          (state) => !unchanged.includes(state) && !(old?.changes?.added ?? []).includes(state),
        )
      : [],
  };
};

/**
 * The targets of an edit sketch with each `new` entry given the `unchanged` of its `old` entry, so a state both draw
 * alike counts as unchanged in both. Any other sketch's targets come back as they are.
 */
export const withEditUnchanged = <T extends EditTarget>(sketch: Sketch, targets: T[]): T[] => {
  if (!isEditSketch(sketch)) return targets;

  return targets.map((entry) => {
    if (entry.variant !== EDIT_NEW) return entry;

    const old = targets.find((other) => other.variant === EDIT_OLD && other.part === entry.part);

    if (!old?.unchanged) return entry;

    return { ...entry, unchanged: entry.states.filter((state) => old.unchanged?.includes(state)) };
  });
};

const statesLineOf = ({ removed, added, redrawn }: EditStates) =>
  [
    ...removed.map((state) => `${state} entfernt`),
    ...added.map((state) => `${state} neu`),
    ...redrawn.map((state) => `${state} anders`),
  ].join(', ');

/** The note of an edit sketch's `new`: what it is, the commits that made it, and the states that differ. */
export const editNoteOf = ({
  note,
  commits,
  states,
}: {
  note: string;
  commits: readonly EditCommit[];
  states: EditStates;
}) => {
  const made =
    commits.length === 0 ? 'noch nicht committet' : commits.map(({ hash, subject }) => `${hash} ${subject}`).join('; ');
  const differs = statesLineOf(states);

  return [`${note}: ${made}`, ...(differs ? [`Unterschied: ${differs}`] : [])].join(' · ');
};

/** The `variantInfo` of an edit sketch with the note of `new` naming its commits and differing states; any other sketch's as it is. */
export const editVariantInfoOf = ({
  product,
  sketch,
  targets,
}: {
  product: ResolvedProduct;
  sketch: Sketch;
  targets: readonly EditTarget[] | null;
}) => {
  const info = sketch.variantInfo;
  const resolved = product.parts.find((part) => partKeyOf(part) === partKeyOf(sketch));

  if (!isEditSketch(sketch) || !info?.[EDIT_NEW] || !resolved || resolved.origin === 'base') return info;

  const commits = editCommitsOf({ partDir: dirname(resolved.file), since: sketch.editOldCommit });
  const states = editStatesOf(targets ?? [], partKeyOf(sketch));

  return {
    ...info,
    [EDIT_NEW]: { ...info[EDIT_NEW], note: editNoteOf({ note: info[EDIT_NEW].note ?? '', commits, states }) },
  };
};
