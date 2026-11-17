import { STUDIO_LABELS } from '../../i18n/studio-labels';

export type StateGroup = { name: string; states: string[] };

/** From this many states on, a part shows its frames in state groups instead of one long column. */
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

/** The state groups of a part with at least `MANY_STATES` states, or none for a smaller part. */
export const partStateGroupsOf = (states: readonly string[]): StateGroup[] =>
  states.length >= MANY_STATES ? stateGroupsOf(states) : [];
