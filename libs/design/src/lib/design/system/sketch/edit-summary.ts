import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { EDIT_NEW, EDIT_OLD } from './edit-old-base';
import { isEditSketch } from './merged-parts';
import { Sketch } from './sketch';

export type EditStates = { removed: string[]; added: string[]; redrawn: string[] };

type EditTarget = {
  part?: string;
  variant: string;
  states: string[];
  unchanged?: string[];
  changes?: { added: string[]; dropped: string[] };
  crops?: Record<string, unknown>;
  pending?: string[];
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
 * alike counts as unchanged in both, and none while `old` is still compared. `new` also gets the changed areas of `old`,
 * which are measured between the two, and the `pending` states `old` has not compared yet. Any other sketch's targets come back as
 * they are.
 */
export const withEditUnchanged = <T extends EditTarget>(sketch: Sketch, targets: T[]): T[] => {
  if (!isEditSketch(sketch)) return targets;

  return targets.map((entry) => {
    if (entry.variant !== EDIT_NEW) return entry;

    const old = targets.find((other) => other.variant === EDIT_OLD && other.part === entry.part);

    if (!old) return entry;
    if (!old.unchanged) return { ...entry, unchanged: undefined };

    const crops = Object.fromEntries(Object.entries(old.crops ?? {}).filter(([state]) => entry.states.includes(state)));

    return {
      ...entry,
      unchanged: entry.states.filter((state) => old.unchanged?.includes(state)),
      ...(Object.keys(crops).length > 0 ? { crops } : {}),
      pending: old.pending ? entry.states.filter((state) => old.pending?.includes(state)) : undefined,
    };
  });
};

const countOf = (states: string[], what: string) =>
  states.length ? [`${states.length} ${states.length === 1 ? 'Zustand' : 'Zustände'} ${what}`] : [];

const statesLineOf = ({ removed, added, redrawn }: EditStates) => [
  ...countOf(removed, 'entfällt'),
  ...countOf(added, 'neu'),
  ...countOf(redrawn, 'anders'),
];

/** The note of an edit sketch's `new`: what it is, and how many states it removes, adds and draws differently. */
export const editNoteOf = ({ note, states }: { note: string; states: EditStates }) =>
  [note, ...statesLineOf(states)].join(' · ');

/** The `variantInfo` of an edit sketch with the note of `new` counting its differing states; any other sketch's as it is. */
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

  const states = editStatesOf(targets ?? [], partKeyOf(sketch));

  return {
    ...info,
    [EDIT_NEW]: { ...info[EDIT_NEW], note: editNoteOf({ note: info[EDIT_NEW].note ?? '', states }) },
  };
};
