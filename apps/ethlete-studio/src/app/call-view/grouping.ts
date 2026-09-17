import { Call } from '../../host/design';
import { CallOrder } from './remembered';

/** One project of a checkout: the top folder of a call slug, with how much of it is still open. */
export type ProjectSummary = {
  name: string;
  calls: number;
  open: number;
};

export const openOptions = (call: Call) => call.options.filter((option) => !option.verdict).length;

/** The project a call belongs to. */
export const projectOf = (call: Call) => call.slug.split('/')[0] ?? '';

const matches = (call: Call, term: string) =>
  !term || `${call.slug} ${call.eyebrow} ${call.headline}`.toLowerCase().includes(term);

const byName = (left: Call, right: Call) => left.slug.localeCompare(right.slug);

const byOpen = (left: Call, right: Call) => openOptions(right) - openOptions(left) || byName(left, right);

/** Which calls the sidebar draws, in which order, and what the reader typed to find them. */
export type CallListRequest = {
  calls: Call[];
  /** Only the calls of this project. An empty name keeps every call. */
  project: string;
  /** Matched against the slug, the eyebrow and the headline. An empty term keeps every call. */
  term: string;
  order: CallOrder;
};

/** The call list as the sidebar draws it: one project, found by the term, in the order asked for. */
export const callList = ({ calls, project, term, order }: CallListRequest): Call[] => {
  const wanted = term.trim().toLowerCase();

  return calls
    .filter((call) => (!project || projectOf(call) === project) && matches(call, wanted))
    .sort(order === 'open' ? byOpen : byName);
};

/** Every project of a checkout, by name, as the welcome screen lists them. */
export const projectSummaries = (calls: Call[]): ProjectSummary[] => {
  const found = new Map<string, Call[]>();

  for (const call of calls) {
    const name = projectOf(call);

    found.set(name, [...(found.get(name) ?? []), call]);
  }

  return [...found.entries()]
    .map(([name, entries]) => ({
      name,
      calls: entries.length,
      open: entries.filter((call) => openOptions(call) > 0).length,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};
