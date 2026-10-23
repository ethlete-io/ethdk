import { Call, CALL_STAGES, CallStage, InventoryPart } from '../../host/design';

/** One project of a checkout: the top folder of a call slug, with how much of it is still open. */
export type ProjectSummary = {
  name: string;
  calls: number;
  open: number;
};

export const openVariants = (call: Call) => call.variants.filter((variant) => !variant.verdict).length;

/** The project a call belongs to. */
export const projectOf = (call: Call) => call.slug.split('/')[0] ?? '';

/** Whether a call previews a design system entry, `<project>/system/<entry>`. */
export const isSystemCall = (call: Call) => call.slug.split('/')[1] === 'system';

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

  return calls
    .filter((call) => !isSystemCall(call) && (!project || projectOf(call) === project) && matches(call, wanted))
    .sort(byName);
};

/** Every call that still has an open variant, the most recently written first. */
export const unsettledCalls = (request: CallListRequest): Call[] =>
  callList(request)
    .filter((call) => openVariants(call) > 0)
    .sort((left, right) => right.touched - left.touched);

/** The open calls of one stage, in the order `unsettledCalls` gives them. */
export type StageGroup = {
  /** Left out for the loose calls. A value outside the design order keeps its raw id. */
  stage: string | null;
  calls: Call[];
};

const stageRank = (stage: string | null) => {
  if (!stage) return CALL_STAGES.length + 1;

  const index = (CALL_STAGES as readonly string[]).indexOf(stage);

  return index === -1 ? CALL_STAGES.length : index;
};

const STAGE_LABELS: Record<CallStage, string> = {
  themes: 'Foundations',
  ci: 'Logo and CI',
  wireframe: 'Wireframes',
  component: 'Components',
  element: 'Elements',
  page: 'Pages',
  prototype: 'Prototype',
};

/** The words a stage reads as, numbered by its place in the design order. An unknown stage keeps its id. */
export const stageLabel = (stage: string) => {
  const index = (CALL_STAGES as readonly string[]).indexOf(stage);

  return index === -1 ? stage : `${index + 1} ${STAGE_LABELS[stage as CallStage]}`;
};

/** The open calls, one group per stage in the design order, the loose calls last. */
export const stageGroups = (request: CallListRequest): StageGroup[] => {
  const found = new Map<string | null, Call[]>();

  for (const call of unsettledCalls(request)) {
    const stage = call.stage || null;

    found.set(stage, [...(found.get(stage) ?? []), call]);
  }

  return [...found.entries()]
    .map(([stage, calls]) => ({ stage, calls }))
    .sort((left, right) => stageRank(left.stage) - stageRank(right.stage));
};

/** How far one stage of the design order has come. */
export type StageSummary = {
  stage: CallStage;
  open: number;
  ready: number;
  settled: number;
  /** The earliest stage before this one that has no settled or ready call, when this stage already has calls. */
  before: CallStage | null;
};

/** One summary per stage of the design order, the empty ones too. `ready` counts calls whose status is ready. */
export const stageOverview = (request: CallListRequest, states: Record<string, string | undefined>): StageSummary[] => {
  const calls = callList(request);

  const summaries = CALL_STAGES.map((stage) => {
    const inStage = calls.filter((call) => call.stage === stage);
    const open = inStage.filter((call) => openVariants(call) > 0).length;

    return {
      stage,
      open,
      ready: inStage.filter((call) => states[call.slug] === 'ready').length,
      settled: inStage.length - open,
    };
  });

  return summaries.map((summary, index) => {
    const hasCalls = summary.open + summary.ready + summary.settled > 0;
    const missing = summaries
      .slice(0, index)
      .find((earlier) => earlier.stage !== 'ci' && !earlier.settled && !earlier.ready);

    return { ...summary, before: hasCalls && missing ? missing.stage : null };
  });
};

/** How many calls of the request declare no stage and so sit outside the design process. */
export const unstagedCount = (request: CallListRequest) =>
  callList(request).filter((call) => !CALL_STAGES.includes(call.stage as CallStage)).length;

export const ruledLabel = (call: Call) =>
  `${call.variants.length - openVariants(call)} of ${call.variants.length} ruled`;

export const defaultVariant = (call: Call) => {
  const open = call.variants.find((variant) => !variant.verdict);

  if (open) return open.key;

  const order = call.rounds.map((round) => round.key);
  const winners = call.variants
    .filter((variant) => variant.verdict === 'chosen')
    .sort((left, right) => order.indexOf(left.round ?? '') - order.indexOf(right.round ?? ''));

  return winners.at(-1)?.key ?? call.variants[0]?.key ?? '';
};

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const count = (amount: number, unit: string) => `${amount} ${unit}${amount === 1 ? '' : 's'} ago`;

/** How long ago a call was written, in the words the explorer prints. */
export const touchedLabel = (touched: number, now = Date.now() / 1000) => {
  const ago = Math.max(0, now - touched);

  if (!touched) return '';
  if (ago < MINUTE) return 'just now';
  if (ago < HOUR) return count(Math.floor(ago / MINUTE), 'minute');
  if (ago < DAY) return count(Math.floor(ago / HOUR), 'hour');
  if (ago < 2 * DAY) return 'yesterday';
  if (ago < WEEK) return count(Math.floor(ago / DAY), 'day');

  return count(Math.floor(ago / WEEK), 'week');
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
    .map(([name, calls]) => ({ name, open: calls.filter((call) => openVariants(call) > 0).length, calls }))
    .sort((left, right) => rank(left.name) - rank(right.name) || left.name.localeCompare(right.name));
};

const rank = (name: string) => (name === LOOSE_FEATURE ? 1 : 0);

/** The settled half of the explorer: every call with no open variant left, grouped by feature. */
export const settledGroups = (request: CallListRequest): FeatureGroup[] =>
  featureGroups({ ...request, calls: request.calls.filter((call) => openVariants(call) === 0) });

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
      open: entries.filter((call) => openVariants(call) > 0).length,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

/** One inventory part, with whether the component call it names exists yet. */
export type InventoryRow = InventoryPart & { exists: boolean };

/** The parts of every wireframe call of a project, in the order the wireframes list them. */
export const inventoryRows = (calls: Call[], project: string): InventoryRow[] => {
  const slugs = new Set(calls.map((call) => call.slug));

  return calls
    .filter((call) => call.stage === 'wireframe' && (!project || projectOf(call) === project))
    .sort(byName)
    .flatMap((call) => call.inventory)
    .map((part) => ({ ...part, exists: !!part.call && slugs.has(part.call) }));
};

/** How many of the new parts already have their component call. Null when no part is new. */
export const inventoryProgress = (rows: InventoryRow[]) => {
  const queued = rows.filter((row) => row.new);

  return queued.length ? `${queued.filter((row) => row.exists).length} of ${queued.length} parts have a call` : null;
};
