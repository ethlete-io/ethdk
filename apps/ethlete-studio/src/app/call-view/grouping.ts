import { Call } from '../../host/design';

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

/** Which calls the explorer draws, and what the reader typed to find them. */
export type CallListRequest = {
  calls: Call[];
  /** Only the calls of this project. An empty name keeps every call. */
  project: string;
  /** Matched against the slug, the eyebrow and the headline. An empty term keeps every call. */
  term: string;
};

/** The calls of one project that the term found, by name. */
export const callList = ({ calls, project, term }: CallListRequest): Call[] => {
  const wanted = term.trim().toLowerCase();

  return calls.filter((call) => (!project || projectOf(call) === project) && matches(call, wanted)).sort(byName);
};

/** Every call that still has an open variant, the most recently written first. */
export const unsettledCalls = (request: CallListRequest): Call[] =>
  callList(request)
    .filter((call) => openOptions(call) > 0)
    .sort((left, right) => right.touched - left.touched);

/** Every round of a call, in the order its options declare them, each saying whether it is settled. */
export const roundPips = (call: Call): boolean[] => {
  const rounds = new Map<string, boolean>();

  for (const option of call.options) {
    const key = option.round ?? option.key;

    rounds.set(key, (rounds.get(key) ?? true) && !!option.verdict);
  }

  return [...rounds.values()];
};

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const count = (amount: number, unit: string) => `${amount} ${unit}${amount === 1 ? '' : 's'} ago`;

/** How long ago a call was written, in the words the explorer prints. */
export const touchedLabel = (touched: number, now = Date.now() / 1000): string => {
  const ago = Math.max(0, now - touched);

  if (!touched) return '';
  if (ago < MINUTE) return 'just now';
  if (ago < HOUR) return count(Math.round(ago / MINUTE), 'minute');
  if (ago < DAY) return count(Math.round(ago / HOUR), 'hour');
  if (ago < 2 * DAY) return 'yesterday';
  if (ago < WEEK) return count(Math.round(ago / DAY), 'day');

  return count(Math.round(ago / WEEK), 'week');
};

/** The heading a call without a feature reads under. */
export const LOOSE_FEATURE = 'No feature';

/** Every call of one feature, and how many of its calls are still open. */
export type FeatureGroup = {
  name: string;
  open: number;
  calls: Call[];
};

/** One band per feature of the project, the loose calls last. */
export const featureGroups = (request: CallListRequest): FeatureGroup[] => {
  const found = new Map<string, Call[]>();

  for (const call of callList(request)) {
    const name = call.feature || LOOSE_FEATURE;

    found.set(name, [...(found.get(name) ?? []), call]);
  }

  return [...found.entries()]
    .map(([name, calls]) => ({ name, open: calls.filter((call) => openOptions(call) > 0).length, calls }))
    .sort((left, right) => rank(left.name) - rank(right.name) || left.name.localeCompare(right.name));
};

const rank = (name: string) => (name === LOOSE_FEATURE ? 1 : 0);

/** The settled half of the explorer: every call with no open variant left, grouped by feature. */
export const settledGroups = (request: CallListRequest): FeatureGroup[] =>
  featureGroups({ ...request, calls: request.calls.filter((call) => openOptions(call) === 0) });

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
