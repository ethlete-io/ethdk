import { GitFlowConfig, parseBranch } from '@ethlete/agent-rules/git-flow';
import { isReadableSummary } from '../model/acknowledgement';
import { UnnamedContext } from '../model/attribution';
import { CollectedEvent, MergeRequestActivityEvent } from '../model/event';
import { CheckoutKeys } from '../model/peer-path';
import { pathIsUnder } from '../model/project-link';
import { StandIn } from '../model/stand-in';
import { TimeWindow } from '../model/time-window';
import { issueKeyInText } from '../rows/attribute';

/** One agent session behind a stretch of work: its title where it reads as words, and whether it wrote a file. */
export type WorkSession = { sessionId: string; title?: string; wroteFiles: boolean };

/** A merge request of the stretch's checkout the user was active on that day. */
export type RelatedMergeRequest = {
  /** Such as `!1095`. */
  reference: string;
  title?: string;
  /** The issue its source branch, title or description names. */
  issueKey?: string;
  /** What the user did on it nearest the stretch, in the forge's words, such as `commented on`. */
  action: string;
  at: Date;
};

/**
 * What a day's events say about one stretch of work beyond its notes. `mergeRequest` is set only where
 * the stretch changed nothing: agent sessions ran in it and wrote no file, and nothing committed or
 * pushed in its checkout while it ran.
 */
export type WorkFacts = { sessions: WorkSession[]; mergeRequest?: RelatedMergeRequest };

type Stretch = { repoPath: string; windows: readonly TimeWindow[]; session?: string };

type FactsOptions = {
  events: readonly CollectedEvent[];
  config: GitFlowConfig;
  /** Each checkout's key read from its remote, which is what names the forge project its merge requests sit in. */
  repoKeys?: CheckoutKeys;
};

/** A reflog move the user's own change made, as opposed to a pull, a fetch or a reset. */
const MOVED_BY_WORK = /^(commit|rebase|merge|cherry-pick|revert|am)\b/;

const lastSegment = (path: string) =>
  (
    path
      .split(/[\\/]+/)
      .filter(Boolean)
      .pop() ?? ''
  ).toLowerCase();

const sameCheckout = (options: { event: MergeRequestActivityEvent; repoPath: string; repoKeys?: CheckoutKeys }) => {
  const project = options.event.projectPath?.toLowerCase();
  const key = options.repoKeys?.[options.repoPath]?.toLowerCase();

  if (!project) return false;
  if (key && (key === project || key.endsWith(`/${project}`))) return true;

  return lastSegment(project) === lastSegment(options.repoPath);
};

const isMergeRequestActivity = (event: CollectedEvent): event is MergeRequestActivityEvent =>
  event.kind === 'merge-request-activity';

const within = (at: Date, windows: readonly TimeWindow[]) =>
  windows.some((window) => at >= window.from && at <= window.to);

const distanceMs = (at: Date, windows: readonly TimeWindow[]) =>
  Math.min(
    ...windows.map((window) => Math.max(0, window.from.getTime() - at.getTime(), at.getTime() - window.to.getTime())),
  );

const wordsOf = (text: string | undefined) =>
  new Set(
    (text ?? '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3),
  );

const overlap = (text: string | undefined, titles: readonly string[]) => {
  const words = wordsOf(text);

  return titles.reduce((count, title) => count + [...wordsOf(title)].filter((word) => words.has(word)).length, 0);
};

const sessionsOf = (stretch: Stretch, events: readonly CollectedEvent[]): WorkSession[] => {
  const ids = new Set(
    events.flatMap((event) =>
      event.kind === 'agent-session' &&
      (stretch.session
        ? event.sessionId === stretch.session
        : within(event.at, stretch.windows) && pathIsUnder(stretch.repoPath, event.cwd))
        ? [event.sessionId]
        : [],
    ),
  );

  return [...ids].map((sessionId) => {
    let title: string | undefined;
    let wroteFiles = false;

    for (const event of events) {
      if ((event.kind !== 'agent-session' && event.kind !== 'agent-usage') || event.sessionId !== sessionId) continue;
      if (event.workedIn && event.workedIn !== event.cwd) wroteFiles = true;
      if (event.kind === 'agent-session' && event.title) title = event.title;
    }

    return { sessionId, ...(title && isReadableSummary(title) ? { title } : {}), wroteFiles };
  });
};

const changedSomething = (stretch: Stretch, options: FactsOptions) =>
  options.events.some((event) => {
    if (!within(event.at, stretch.windows)) return false;

    switch (event.kind) {
      case 'git-commit':
        return !event.authoredAt && pathIsUnder(stretch.repoPath, event.repoPath);
      case 'git-branch-update':
        return MOVED_BY_WORK.test(event.action) && pathIsUnder(stretch.repoPath, event.repoPath);
      case 'merge-request-activity':
        return (
          event.action.startsWith('pushed') &&
          sameCheckout({ event, repoPath: stretch.repoPath, repoKeys: options.repoKeys })
        );
      default:
        return false;
    }
  });

const issueKeyOf = (events: readonly MergeRequestActivityEvent[], config: GitFlowConfig) => {
  for (const event of events) {
    const key =
      (event.branch ? parseBranch({ branch: event.branch, config }).issueKey : undefined) ??
      issueKeyInText({ text: [event.title, event.description].filter(Boolean).join('\n'), config });

    if (key) return key;
  }

  return undefined;
};

/**
 * The merge request of the stretch's checkout whose activity that day lay nearest the stretch, a tie
 * going to the one whose title shares the most words with the sessions' titles.
 */
const nearestMergeRequest = (
  stretch: Stretch & { sessions: readonly WorkSession[] },
  options: FactsOptions,
): RelatedMergeRequest | undefined => {
  const byReference = new Map<string, MergeRequestActivityEvent[]>();

  for (const event of options.events) {
    if (!isMergeRequestActivity(event) || !event.mergeRequestIid) continue;
    if (!sameCheckout({ event, repoPath: stretch.repoPath, repoKeys: options.repoKeys })) continue;

    const key = `${event.projectPath}!${event.mergeRequestIid}`;

    byReference.set(key, [...(byReference.get(key) ?? []), event]);
  }

  const titles = stretch.sessions.flatMap((session) => (session.title ? [session.title] : []));
  const ranked = [...byReference.values()]
    .map((activity) => {
      const nearestMs = Math.min(...activity.map((event) => distanceMs(event.at, stretch.windows)));
      const nearest = activity.find((event) => distanceMs(event.at, stretch.windows) === nearestMs) ?? activity[0];
      const title = activity.find((event) => event.title)?.title;

      return { activity, nearest, nearestMs, title, overlap: overlap(title, titles) };
    })
    .sort(
      (a, b) =>
        a.nearestMs - b.nearestMs ||
        b.overlap - a.overlap ||
        (a.nearest?.mergeRequestIid ?? '').localeCompare(b.nearest?.mergeRequestIid ?? ''),
    );
  const chosen = ranked[0];

  if (!chosen?.nearest) return undefined;

  const issueKey = issueKeyOf(chosen.activity, options.config);

  return {
    reference: `!${chosen.nearest.mergeRequestIid}`,
    ...(chosen.title ? { title: chosen.title } : {}),
    ...(issueKey ? { issueKey } : {}),
    action: chosen.nearest.action,
    at: chosen.nearest.at,
  };
};

const stretchFacts = (stretch: Stretch | null, options: FactsOptions): WorkFacts => {
  if (!stretch || !stretch.windows.length) return { sessions: [] };

  const sessions = sessionsOf(stretch, options.events);

  if (!sessions.length || sessions.some((session) => session.wroteFiles)) return { sessions };
  if (changedSomething(stretch, options)) return { sessions };

  const mergeRequest = nearestMergeRequest({ ...stretch, sessions }, options);

  return mergeRequest ? { sessions, mergeRequest } : { sessions };
};

/** What the day's events say about one unnamed context beyond its notes. See {@link WorkFacts}. */
export const contextWorkFacts = (options: FactsOptions & { context: UnnamedContext }): WorkFacts => {
  const { context } = options;
  const repoPath = context.context.repoPath;

  return stretchFacts(
    repoPath ? { repoPath, windows: [{ from: context.from, to: context.to }], session: context.context.session } : null,
    options,
  );
};

/** What the day's events say about the bands of one stand-in beyond their notes. See {@link WorkFacts}. */
export const standInWorkFacts = (
  options: FactsOptions & {
    standIn: Pick<StandIn, 'id'> & Partial<Pick<StandIn, 'openedFor'>>;
    bands: readonly ({ standInId?: string } & TimeWindow)[];
  },
): WorkFacts => {
  const repoPath = options.standIn.openedFor;
  const windows = options.bands
    .filter((band) => band.standInId === options.standIn.id)
    .map(({ from, to }) => ({ from, to }));

  return stretchFacts(repoPath ? { repoPath, windows } : null, options);
};

/** {@link contextWorkFacts} for each of a day's unnamed contexts, by context id. */
export const contextWorkFactsOf = (
  options: FactsOptions & { contexts: readonly UnnamedContext[] },
): ReadonlyMap<string, WorkFacts> =>
  new Map(options.contexts.map((context) => [context.id, contextWorkFacts({ ...options, context })]));
