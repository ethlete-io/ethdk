import { ListedComment } from '../../../host/design';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

export type StateGroup = { name: string; states: string[] };

/** From this many states on, a part folds the states that need no look behind a count. */
export const MANY_STATES = 12;

/**
 * Groups state names by their first `-` segment, in the order each prefix first appears. States whose prefix no
 * other state shares go to a last group named Weitere.
 */
export const stateGroupsOf = (states: readonly string[]): StateGroup[] => {
  const byPrefix = new Map<string, string[]>();

  for (const state of states) {
    const prefix = state.split('-')[0] ?? state;

    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), state]);
  }

  const groups = [...byPrefix].filter(([, members]) => members.length > 1);
  const rest = [...byPrefix].flatMap(([, members]) => (members.length === 1 ? members : []));

  return [
    ...groups.map(([name, members]) => ({ name, states: members })),
    ...(rest.length > 0 ? [{ name: STUDIO_LABELS.system.otherStates, states: rest }] : []),
  ];
};

/**
 * The states of a part with at least `MANY_STATES` states that fold behind a count: every state outside
 * `needsLook`. None fold for a smaller part, or when no state or every state needs a look.
 */
export const foldedStatesOf = (states: readonly string[], needsLook: ReadonlySet<string>): ReadonlySet<string> => {
  const folded = states.filter((state) => !needsLook.has(state));

  return states.length < MANY_STATES || folded.length === 0 || folded.length === states.length
    ? new Set()
    : new Set(folded);
};

/** The states of `part` that hold an open comment outside a sketch. */
export const commentedStatesOf = (
  comments: readonly Pick<ListedComment, 'part' | 'state' | 'sketch'>[],
  part: string,
): ReadonlySet<string> =>
  new Set(comments.filter((comment) => comment.part === part && !comment.sketch).map((comment) => comment.state));
