import { Call } from '../../host/design';
import { CallOrder } from './remembered';

/** Every call of one group of a checkout, and how much of the group is still open. */
export type CallGroup = {
  name: string;
  open: number;
  calls: Call[];
};

export const openOptions = (call: Call) => call.options.filter((option) => !option.verdict).length;

const matches = (call: Call, term: string) =>
  !term || `${call.slug} ${call.eyebrow} ${call.headline}`.toLowerCase().includes(term);

const groupName = (call: Call) => call.slug.split('/')[0] ?? '';

const byName = (left: Call, right: Call) => left.slug.localeCompare(right.slug);

const byOpen = (left: Call, right: Call) => openOptions(right) - openOptions(left) || byName(left, right);

/** Which calls the sidebar draws, in which order, and what the reader typed to find them. */
export type GroupRequest = {
  calls: Call[];
  /** Matched against the slug, the eyebrow and the headline. An empty term keeps every call. */
  term: string;
  order: CallOrder;
};

/**
 * The call list as the sidebar draws it: one group per top folder, the groups by name, and the
 * calls inside each group in the order asked for.
 */
export const callGroups = ({ calls, term, order }: GroupRequest): CallGroup[] => {
  const wanted = term.trim().toLowerCase();
  const groups = new Map<string, Call[]>();

  for (const call of calls.filter((call) => matches(call, wanted))) {
    const name = groupName(call);

    groups.set(name, [...(groups.get(name) ?? []), call]);
  }

  return [...groups.entries()]
    .map(([name, found]) => ({
      name,
      open: found.filter((call) => openOptions(call) > 0).length,
      calls: [...found].sort(order === 'open' ? byOpen : byName),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};
