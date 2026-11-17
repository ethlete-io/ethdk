import { ListedComment, ListedPart } from '../../../host/design';

/** From this many states on, a part folds the states that need no look behind a count. */
export const MANY_STATES = 12;

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

/** The states of `part` that need a look: an open comment outside a sketch, a problem, or a change since the last merge. */
export const lookStatesOf = (
  comments: readonly Pick<ListedComment, 'part' | 'state' | 'sketch'>[],
  part: { key: string; listed: Pick<ListedPart, 'problemStates' | 'changedStates'> },
): ReadonlySet<string> =>
  new Set([
    ...commentedStatesOf(comments, part.key),
    ...(part.listed.problemStates ?? []),
    ...(part.listed.changedStates ?? []),
  ]);
