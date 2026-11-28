import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { stateGroupsOf, stateNamesOf } from '../sketch/part-definition';

const RULE = 'STATE-GROUPS';

/** A part with more own states than this names the groups of its states. */
export const MAX_UNGROUPED_STATES = 12;

const messagesOf = (source: string): { message: string; states?: string[] }[] => {
  const states = stateNamesOf(source);
  const groups = stateGroupsOf(source);

  if (states === null || groups === 'unknown') return [];
  if (groups === 'none')
    return states.length > MAX_UNGROUPED_STATES
      ? [
          {
            message: `${states.length} states and no groups: add definePart({ groups: [{ label, states }] }) in flow order, the normal case first and errors last`,
          },
        ]
      : [];

  const grouped = groups.flatMap((group) => group.states);
  const ungrouped = states.filter((state) => !grouped.includes(state));
  const twice = states.filter((state) => grouped.indexOf(state) !== grouped.lastIndexOf(state));
  const unknown = [...new Set(grouped.filter((state) => !states.includes(state)))];

  return [
    ...(ungrouped.length > 0 ? [{ message: `state in no group: ${ungrouped.join(', ')}`, states: ungrouped }] : []),
    ...(twice.length > 0 ? [{ message: `state in more than one group: ${twice.join(', ')}`, states: twice }] : []),
    ...(unknown.length > 0 ? [{ message: `group names a state the part does not have: ${unknown.join(', ')}` }] : []),
  ];
};

/** Each own part of `product` with many states and no `groups`, or whose `groups` miss a state or name one twice. */
export const stateGroupProblemsOf = (product: ResolvedProduct): Problem[] =>
  product.parts
    .filter((part) => part.origin !== 'base')
    .flatMap((part) =>
      messagesOf(part.source).map(({ message, states }) => ({
        rule: RULE,
        file: part.file,
        ...(states && { states }),
        message,
      })),
    );
