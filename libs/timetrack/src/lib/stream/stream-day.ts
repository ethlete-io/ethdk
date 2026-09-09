import { ActivityContext, streamKey } from '../model/block';
import { CallWindow } from '../model/call';
import { branchOf, repoRootOf } from '../model/context';
import {
  ActivityEvent,
  AgentPromptEvent,
  AgentUsageEvent,
  CollectedEvent,
  CollectedEventSource,
  TokenUsage,
  isActivityEvent,
  windowFocusDetail,
} from '../model/event';
import { Evidence } from '../model/evidence';
import { TimetrackProjectLink, matchProjectLink } from '../model/project-link';
import { TimeWindow, clipWindows, mergeWindows, subtractWindows, windowsMs } from '../model/time-window';
import { TimetrackCallRules } from '../settings/model';
import { classifyCalls } from './calls';
import { PresenceSample, presenceWindows } from './presence';

/** The key of the one line every application with no checkout folds into. */
export const OTHER_APPLICATIONS_KEY = 'other-applications';

/**
 * The sources the streams are built from. `calendar`, `gitlab` and `ingest` stay in the store, unread.
 *
 * `call` is read too, in a pass of its own, and it is deliberately not here: a call is presence and it
 * is never attribution, so it may not enter the loop that sets the sticky context or claims a stretch
 * for a checkout. Adding it here would book the microphone's hours to whatever repository was last in
 * front. See `classifyCalls`.
 */
const READ_SOURCES: readonly CollectedEventSource[] = ['window', 'idle', 'git', 'agent-session', 'editor'];

/**
 * The sources that say somebody was at the machine.
 *
 * An editor heartbeat is deliberately not one, and this list is what keeps it out. It only fires while
 * its own window has focus, so every minute it covers is a minute the window source already reported —
 * it can name the checkout that window holds and it can add no time. Counting it would only let the two
 * disagree, and the difference reads on screen as time nothing watched. `sessionize` counts a heartbeat
 * as presence; this deliberately does not.
 */
const PRESENCE_SOURCES: readonly CollectedEventSource[] = ['window', 'idle', 'git', 'agent-session'];

export type StreamDayOptions = {
  /**
   * The safety valve for a stretch nothing observed at all. It is deliberately generous, because the
   * collectors are edge-triggered — a focus event fires on a switch and a commit when you commit, so
   * ten quiet minutes inside one context are normal work, not absence.
   */
  maxUnobservedMs: number;
  /** How long a checkout keeps holding the focused window after its last event names it. */
  repoStickinessMs: number;
  /**
   * The silence that ends a stretch either side of an agent event, when a day is rebuilt from the
   * prompts the user typed. Shorter than `maxUnobservedMs`, because it is an idle rule rather than a
   * safety valve: waiting on an agent is being at the machine, and an hour of neither is not.
   */
  maxAgentGapMs: number;
  /**
   * The repository roots the host discovered. An agent session reports the directory it was started in,
   * which is often a subdirectory of a checkout, and without these each subdirectory becomes a stream.
   */
  repoRoots?: readonly string[];
  /**
   * The user's path-to-project links. A private one takes its checkout out of the day: no line, no
   * evidence, no spend and no branch name. Its window time folds into the other-applications line, so
   * presence still reconciles without the path being named.
   */
  links?: readonly TimetrackProjectLink[];
  /**
   * The application ids of the app reading the day. Its own window still holds the minutes it was in
   * front, so presence and the concurrency ratio still reconcile, but it names neither an application
   * nor an observation — a tool that lists itself as evidence reports on itself.
   */
  ownAppIds?: readonly string[];
  /**
   * The instant the window source has reported through, which is its last drain rather than its last
   * sample. Without it a day still being collected reports its own live tail as rebuilt.
   */
  windowsSeenThroughMs?: number;
  /** Which calls counted as work. Nothing configured leaves every call unclassified — see `classifyCalls`. */
  callRules?: TimetrackCallRules;
};

export const DEFAULT_STREAM_DAY_OPTIONS: StreamDayOptions = {
  maxUnobservedMs: 30 * 60_000,
  repoStickinessMs: 5 * 60_000,
  maxAgentGapMs: 15 * 60_000,
};

/** What a set of turns spent. The five classes are kept apart because they are priced apart. */
export type StreamSpend = {
  usage: TokenUsage;
  turns: number;
  /** The models the turns ran on, first seen first. */
  models: string[];
};

/** One context's work across one local day. Several streams run at once, and each books its full time. */
export type Stream = {
  /** `streamKey` of the checkout, or `OTHER_APPLICATIONS_KEY`. */
  key: string;
  /** The checkout this stream is. The folded line has none. */
  repoPath?: string;
  /** The applications whose windows held focus in this stream, first seen first. */
  apps: string[];
  /** The branches the checkout was seen on, first seen first. A branch never splits a stream. */
  branches: string[];
  /**
   * How many agent runs the checkout held. Five consoles in one checkout are one stream, so this count
   * is what says so on the line — the blocks never sum to five and the evidence deduplicates by title.
   */
  agentSessions: number;
  /** Contiguous time, gaps kept: the union of what the focused window and the agents observed. */
  blocks: TimeWindow[];
  /** The earliest instant the stream covers, attended or not. */
  from: Date;
  /** The latest instant the stream covers. It disagrees with `engagedMs` exactly when there is a gap. */
  to: Date;
  engagedMs: number;
  /**
   * Agent time outside presence: the machine worked and nobody was at it. It counts in neither
   * `presenceMs` nor `engagedMs`, so a day never claims an hour a person was not there for. The turns
   * spent in it are still this stream's, because a token is spent at an instant and paid for either way.
   */
  unattendedMs: number;
  /** True when no focused window ever resolved here: an agent ran it and nobody looked. */
  neverFocused: boolean;
  /**
   * The part of `engagedMs` that no window and no idle transition observed, rebuilt from the prompts
   * the user typed and the commits they made. It is inside `engagedMs`, never beside it.
   */
  rebuiltMs: number;
  spend: StreamSpend;
  evidence: Evidence[];
  /** Observations past the cap, which the list does not hold. Zero on all but a very long day. */
  evidenceOmitted: number;
};

/** What a local day was worked on, for how long, and what the agents spent on it. */
export type StreamDay = {
  /** Wall-clock time at the machine, overlaps counted once. */
  presenceMs: number;
  /** Every stream's blocks summed, the folded line included. It may exceed `presenceMs`, and that is the point. */
  engagedMs: number;
  /** `engagedMs / presenceMs`. 1 is a serial day, 2.4 is a day that ran several agents, 0 is a day nothing observed. */
  concurrency: number;
  /** Ordered by when each stream started. */
  streams: Stream[];
  /** Every stream's unattended time summed. Outside both `presenceMs` and `engagedMs`. */
  unattendedMs: number;
  /**
   * The part of `presenceMs` that no window and no idle transition observed. It is presence the
   * prompts and commits of the day rebuilt, and it is inside `presenceMs` rather than beside it — a
   * day the collector never ran would otherwise report an empty one. See ADR 0006.
   */
  rebuiltMs: number;
  /** Every turn the day read, whichever stream took it. */
  spend: StreamSpend;
  /**
   * The part of `spend` that names no working directory at all, so nothing can carry it. A turn spent
   * while the user was away is not this: its checkout books it, and the stream reports the time as
   * unattended.
   */
  unattributedSpend: StreamSpend;
  /**
   * The checkout names a window claimed that two checkouts share. Neither could take the window, so
   * its time is in the other-applications line, and this is the only thing that says why.
   */
  ambiguousNames: string[];
  /**
   * Every call of the day, in order — the ones a rule made work and the ones nothing classified alike.
   *
   * The unclassified ones are here so the review can show them and the user can write the rule; under
   * default-deny they add no presence and propose nothing. A call is no `Stream`, because a stream is a
   * checkout and a call is not one, so a working call adds to `presenceMs` and to no `engagedMs`. On a
   * day of long calls `concurrency` therefore reads below 1, which is what an hour of presence that no
   * checkout booked should read as.
   */
  calls: CallWindow[];
};

type StreamDraft = {
  key: string;
  repoPath?: string;
  apps: string[];
  branches: string[];
  sessions: Set<string>;
  focus: TimeWindow[];
  agent: TimeWindow[];
  /** The stretches this context claimed where nothing observed the day. Clipped to the rebuilt part. */
  rebuilt: TimeWindow[];
  evidence: Evidence[];
  evidenceKeys: Set<string>;
  evidenceOmitted: number;
};

/**
 * One thing that happened at an instant, and where. A rebuilt stretch is tiled by these: each claims
 * the minutes up to the next one, so a stretch nothing watched still has one owner per minute. A
 * `state` of `null` names no checkout, and the folded line takes it.
 */
type Mark = { at: Date; state: RepoState | null };

type RepoState = { repoPath: string; branch?: string };

/** What a window manager puts between the parts of a title. */
const TITLE_SEGMENTS = /\s[-–—|]\s/;

const emptySpend = (): StreamSpend => ({
  usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, thinking: 0 },
  turns: 0,
  models: [],
});

const addSpend = (into: StreamSpend, turn: AgentUsageEvent) => {
  into.usage.input += turn.usage.input;
  into.usage.output += turn.usage.output;
  into.usage.cacheWrite += turn.usage.cacheWrite;
  into.usage.cacheRead += turn.usage.cacheRead;
  into.usage.thinking += turn.usage.thinking;
  into.turns++;

  if (!into.models.includes(turn.model)) into.models.push(turn.model);
};

/** A stream's rebuilt time, said once. A prompt carries no text, so the instant is the whole of it. */
const promptEvidence = (prompt: AgentPromptEvent): Evidence => ({
  kind: 'prompt',
  at: prompt.at,
  detail: 'prompts you typed here',
});

const evidenceFor = (sample: ActivityEvent): Evidence | null => {
  switch (sample.kind) {
    case 'window-focus':
      return { kind: 'window-title', at: sample.at, detail: windowFocusDetail(sample) };
    case 'editor-heartbeat':
      return {
        kind: 'editor',
        at: sample.at,
        detail: `${sample.editing ? 'edited' : 'read'} ${sample.directory ?? sample.repoPath ?? sample.reporter}`,
      };
    case 'git-checkout':
      return {
        kind: 'branch',
        at: sample.at,
        detail: `branch \`${sample.branch}\` checked out in ${sample.repoPath}`,
      };
    case 'git-commit':
      return {
        kind: 'commit',
        at: sample.at,
        detail: `${sample.sha.slice(0, 7)} ${sample.subject}`,
        summary: sample.subject,
      };
    case 'agent-session':
      return {
        kind: 'agent-session',
        at: sample.at,
        detail: sample.title ?? `agent session ${sample.sessionId} in ${sample.cwd}`,
        summary: sample.title,
      };
    default:
      return null;
  }
};

const MAX_EVIDENCE_PER_STREAM = 500;

/**
 * The focused window, still where the last sample left it.
 *
 * The window source reports a change, so a stretch in which the focus does not move carries no sample
 * at all, and the last sample of the day ends the part of it the machine watched. The agents mark the
 * minutes after it, and without this those minutes read as time no window watched — a `rebuilt` number
 * that appears while one window holds the focus and vanishes at the next switch.
 *
 * It is only added while the source is fresh: a gap wider than `maxUnobservedMs` is the safety valve's
 * to judge, and a day whose last sample is hours old gets nothing.
 */
const stillFocused = (options: {
  observed: readonly ActivityEvent[];
  throughMs?: number;
  maxUnobservedMs: number;
}): ActivityEvent | null => {
  const last = options.observed.filter((sample) => sample.source === 'window' || sample.source === 'idle').at(-1);
  const throughMs = options.throughMs;

  if (!last || last.kind !== 'window-focus' || throughMs === undefined) return null;
  if (throughMs <= last.at.getTime() || throughMs - last.at.getTime() > options.maxUnobservedMs) return null;

  return { ...last, at: new Date(throughMs) };
};

const addEvidence = (draft: StreamDraft, evidence: Evidence | null) => {
  if (!evidence) return;

  const key = `${evidence.kind}\u0000${evidence.detail}`;

  if (draft.evidenceKeys.has(key)) return;

  draft.evidenceKeys.add(key);

  if (draft.evidence.length >= MAX_EVIDENCE_PER_STREAM) {
    draft.evidenceOmitted++;

    return;
  }

  draft.evidence.push(evidence);
};

const repoStateFor = (sample: ActivityEvent, roots: readonly string[]): RepoState | null => {
  switch (sample.kind) {
    case 'git-checkout':
    case 'git-commit':
      return { repoPath: sample.repoPath, branch: branchOf(sample.branch) };
    case 'agent-session':
      return { repoPath: repoRootOf({ path: sample.cwd, roots }), branch: branchOf(sample.gitBranch) };
    case 'editor-heartbeat':
      return sample.repoPath
        ? { repoPath: repoRootOf({ path: sample.repoPath, roots }), branch: branchOf(sample.branch) }
        : null;
    default:
      return null;
  }
};

/**
 * Which checkout a window title names, by the directory the checkout lives in.
 *
 * Matching a whole title segment rather than a substring is what keeps a page title from claiming a
 * checkout whose name merely appears somewhere in it.
 */
const repoNamedIn = (options: { title: string; byName: Map<string, string> }) =>
  options.title
    .split(TITLE_SEGMENTS)
    .map((segment) => options.byName.get(segment.trim()))
    .find((repoPath) => !!repoPath);

/** Which dropped name a window title claims, so the day can say why the window resolved to nothing. */
const ambiguousNamedIn = (options: { title: string; ambiguous: ReadonlySet<string> }) =>
  options.title
    .split(TITLE_SEGMENTS)
    .map((segment) => segment.trim())
    .find((segment) => options.ambiguous.has(segment));

/**
 * Indexes the checkouts by their directory name.
 *
 * Every discovered root counts, not only the checkouts the day holds an event for: an editor open on
 * a repository you neither committed in nor ran an agent in would otherwise resolve to nothing, and
 * the sticky would hand its hours to whichever other checkout an event named last.
 *
 * A name two of them share is dropped rather than resolved: guessing which `api` an editor is showing
 * would attribute one project's time to another, and no attribution is the better failure.
 */
const reposByName = (samples: readonly ActivityEvent[], roots: readonly string[]) => {
  const byName = new Map<string, string>();
  const ambiguous = new Set<string>();
  const paths = [...roots, ...samples.map((sample) => repoStateFor(sample, roots)?.repoPath)];

  for (const repoPath of paths) {
    const name = repoPath?.split('/').filter(Boolean).pop();

    if (!repoPath || !name) continue;
    if (byName.get(name) !== undefined && byName.get(name) !== repoPath) ambiguous.add(name);

    byName.set(name, repoPath);
  }

  for (const name of ambiguous) byName.delete(name);

  return { byName, ambiguous };
};

/** Whether a link takes a checkout out of the day. A path no link covers is work until the user says so. */
const isPrivate = (options: { repoPath: string; links: readonly TimetrackProjectLink[] }) =>
  matchProjectLink({ context: { repoPath: options.repoPath }, links: options.links })?.target.kind === 'private';

/**
 * The directory names of the private checkouts, so a window title that names one can be recognised.
 *
 * Both sources are needed: a link may name a root that covers checkouts it does not name itself, and a
 * checkout the day saw no git event for is known only from the link.
 */
const privateNames = (options: {
  samples: readonly ActivityEvent[];
  roots: readonly string[];
  links: readonly TimetrackProjectLink[];
}) => {
  const paths = options.samples
    .map((sample) => repoStateFor(sample, options.roots)?.repoPath)
    .concat(options.links.filter((link) => link.target.kind === 'private').map((link) => link.path));

  const byName = new Map<string, string>();

  for (const path of paths) {
    const name = path?.split('/').filter(Boolean).pop();

    if (!path || !name) continue;
    if (isPrivate({ repoPath: path, links: options.links })) byName.set(name, path);
  }

  return byName;
};

/**
 * The checkouts the day can name: the roots the host discovered, and whatever a git event reported. A
 * path the user linked counts too, because a link is a statement that the path is a project of theirs
 * whether or not the git scan walked it.
 *
 * A prompt and a turn are kept for a checkout no link covers, so they are the marks that can name a
 * directory which is no checkout at all — a scratch folder under `~/Downloads`, or the home directory a
 * console was opened in. Their minutes are presence and stay in the day, but they must not invent a
 * stream named after a directory, which is also what put the parent directory of a private checkout on
 * the screen.
 */
const checkoutNamer = (options: {
  samples: readonly ActivityEvent[];
  roots: readonly string[];
  links: readonly TimetrackProjectLink[];
}) => {
  const known = new Set(options.roots);

  for (const sample of options.samples) {
    if (sample.kind === 'git-commit' || sample.kind === 'git-checkout') known.add(sample.repoPath);
    // A reporter names the checkout it found with git, so it names one as well as a git event does —
    // and it is the only source for a repository the user only ever opens in an editor.
    if (sample.kind === 'editor-heartbeat' && sample.repoPath) known.add(sample.repoPath);
  }

  return (path: string | undefined) => {
    if (!path) return undefined;

    const repoPath = repoRootOf({ path, roots: options.roots });

    return known.has(repoPath) || matchProjectLink({ context: { repoPath }, links: options.links })
      ? repoPath
      : undefined;
  };
};

/** A checkout is a stream of its own. Everything else folds into one line, or presence never reconciles. */
const draftKeyOf = (context: ActivityContext) => (context.repoPath ? streamKey(context) : OTHER_APPLICATIONS_KEY);

const draftFor = (drafts: Map<string, StreamDraft>, context: ActivityContext) => {
  const key = draftKeyOf(context);
  const found = drafts.get(key);

  if (found) {
    if (context.appId && !found.apps.includes(context.appId)) found.apps.push(context.appId);
    if (context.branch && !found.branches.includes(context.branch)) found.branches.push(context.branch);

    return found;
  }

  const draft: StreamDraft = {
    key,
    repoPath: context.repoPath,
    apps: context.appId ? [context.appId] : [],
    branches: context.branch ? [context.branch] : [],
    sessions: new Set(),
    focus: [],
    agent: [],
    rebuilt: [],
    evidence: [],
    evidenceKeys: new Set(),
    evidenceOmitted: 0,
  };

  drafts.set(key, draft);

  return draft;
};

/**
 * A stream for a checkout the day has turns for and no samples of.
 *
 * The spend backfill reads a log the session collector never saw, so a replayed day carries an agent's
 * turns without the samples that would have drawn its blocks. Without this the whole of such a day's
 * spend reports as belonging to no checkout at all. The line carries no time, because a turn is an
 * instant and inventing a duration for it is the bug the presence rule exists to prevent.
 */
const spendOnlyStreams = (options: {
  turns: readonly AgentUsageEvent[];
  streams: readonly Stream[];
  checkoutOf: (path: string | undefined) => string | undefined;
}): Stream[] => {
  const drafts = new Map<string, { stream: Stream; sessions: Set<string> }>();

  for (const turn of options.turns) {
    const repoPath = options.checkoutOf(turn.cwd);

    if (!repoPath) continue;

    const key = streamKey({ repoPath });

    if (options.streams.some((stream) => stream.key === key)) continue;

    const branch = branchOf(turn.gitBranch);
    const found = drafts.get(key);

    if (!found) {
      drafts.set(key, {
        stream: {
          key,
          repoPath,
          apps: [],
          branches: branch ? [branch] : [],
          agentSessions: 1,
          blocks: [],
          from: turn.at,
          to: turn.at,
          engagedMs: 0,
          unattendedMs: 0,
          neverFocused: true,
          rebuiltMs: 0,
          spend: emptySpend(),
          evidence: [],
          evidenceOmitted: 0,
        },
        sessions: new Set([turn.sessionId]),
      });

      continue;
    }

    found.sessions.add(turn.sessionId);
    found.stream.agentSessions = found.sessions.size;

    if (branch && !found.stream.branches.includes(branch)) found.stream.branches.push(branch);
    if (turn.at < found.stream.from) found.stream.from = turn.at;
    if (turn.at > found.stream.to) found.stream.to = turn.at;
  }

  return [...drafts.values()].map((draft) => draft.stream);
};

/**
 * What a local day was worked on, for how long, and what the agents spent on it.
 *
 * Pure: it reads no clock and no network, so replaying a stored day gives the same answer it did on the
 * day itself. It attributes nothing to an issue, rounds nothing and merges nothing — one line is one
 * context, so where a line is wrong, exactly one thing can be wrong with it.
 *
 * The focused window is exclusive: its time goes to the checkout its title names, else to the one
 * checkout an event named inside `repoStickinessMs`, else to the folded line. An agent session is not,
 * so a checkout an agent ran in books its time whether or not a window ever showed it.
 */
export const streamDay = (options: {
  events: readonly CollectedEvent[];
  options?: Partial<StreamDayOptions>;
}): StreamDay => {
  const config = { ...DEFAULT_STREAM_DAY_OPTIONS, ...options.options };
  const roots = config.repoRoots ?? [];
  const links = config.links ?? [];
  const ownAppIds = new Set((config.ownAppIds ?? []).map((id) => id.toLowerCase()));
  const observed = options.events
    .filter(isActivityEvent)
    .filter((sample) => READ_SOURCES.includes(sample.source))
    // A heartbeat naming no checkout has no job here: it is not presence, and the directory it carries
    // is an absolute path outside every project rather than something a line can be named after.
    .filter((sample) => sample.kind !== 'editor-heartbeat' || !!sample.repoPath)
    .slice()
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const tail = stillFocused({
    observed,
    throughMs: config.windowsSeenThroughMs,
    maxUnobservedMs: config.maxUnobservedMs,
  });

  if (tail) observed.push(tail);

  const secluded = privateNames({ samples: observed, roots, links });
  const samples = observed.filter((sample) => {
    const repoPath = repoStateFor(sample, roots)?.repoPath;

    return !repoPath || !isPrivate({ repoPath, links });
  });

  const prompts = options.events
    .filter((event): event is AgentPromptEvent => event.source === 'agent-prompt')
    .filter((prompt) => !isPrivate({ repoPath: repoRootOf({ path: prompt.cwd, roots }), links }))
    .slice()
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const turns = options.events
    .filter((event): event is AgentUsageEvent => event.source === 'agent-usage')
    .filter((turn) => !turn.cwd || !isPrivate({ repoPath: repoRootOf({ path: turn.cwd, roots }), links }));

  const rebuildSamples: PresenceSample[] = [
    ...observed.filter((sample) => PRESENCE_SOURCES.includes(sample.source)),
    ...prompts,
    ...turns,
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const calls = classifyCalls({
    events: options.events,
    rules: config.callRules ?? { countsAsWork: [], neverCountsAsWork: [] },
    // Where a call nothing has ended yet is cut: the later of what the sources have reported through
    // and the last thing the day saw. A call with neither has no known duration and reads as none.
    until: new Date(Math.max(config.windowsSeenThroughMs ?? 0, ...options.events.map((event) => +event.at))),
  });

  // A call is a stretch rather than a point, so it is unioned in rather than sampled: two edges an hour
  // apart would otherwise be split by `maxUnobservedMs` into two instants with an absence between them.
  const heldMicrophone = calls.filter((call) => call.countsAsWork).map(({ from, to }) => ({ from, to }));

  const presence = mergeWindows([
    ...presenceWindows({
      samples: rebuildSamples,
      maxUnobservedMs: config.maxUnobservedMs,
      maxAgentGapMs: config.maxAgentGapMs,
    }),
    ...heldMicrophone,
  ]);

  // What the machine itself watched. Everything presence holds beyond it was rebuilt, and the two are
  // disjoint, so each minute of presence has exactly one owner and the ratio keeps its meaning.
  //
  // A working call belongs here and not only in `presence`: the microphone observed those minutes, so
  // they were watched rather than reconstructed. An hour spent listening produces no input at all, and
  // this is what stops it reading as a rebuilt hour.
  const seen = mergeWindows([
    ...presenceWindows({
      samples: observed.filter((sample) => sample.source === 'window' || sample.source === 'idle'),
      maxUnobservedMs: config.maxUnobservedMs,
    }),
    ...heldMicrophone,
  ]);

  const rebuilt = subtractWindows({ windows: presence, without: seen });
  const checkoutOf = checkoutNamer({ samples, roots, links });
  const { byName, ambiguous } = reposByName(samples, roots);
  const claimedAmbiguously = new Set<string>();
  const drafts = new Map<string, StreamDraft>();
  /** The branch each checkout was last seen on. Learned from git and from an agent session alike. */
  const branches = new Map<string, string | undefined>();
  const lastAgentSample = new Map<string, Date>();
  const marks: Mark[] = [];
  let sticky: { repoPath: string; at: Date; appId?: string } | undefined;
  let focused: string | undefined;
  let appId: string | undefined;

  samples.forEach((sample, index) => {
    // A window on a private checkout must not fall through to the sticky, or the last client repository
    // would be billed for the time. It folds into the other-applications line and names nothing.
    const secludedWindow = sample.kind === 'window-focus' && !!repoNamedIn({ title: sample.title, byName: secluded });
    const ownWindow = sample.kind === 'window-focus' && ownAppIds.has(sample.appId.toLowerCase());

    if (sample.kind === 'window-focus') {
      appId = ownWindow ? undefined : sample.appId;
      focused = secludedWindow || ownWindow ? undefined : repoNamedIn({ title: sample.title, byName });

      if (secludedWindow) sticky = undefined;

      if (!focused && !secludedWindow && !ownWindow) {
        const claimed = ambiguousNamedIn({ title: sample.title, ambiguous });

        if (claimed) claimedAmbiguously.add(claimed);
      }
    }

    const observed = repoStateFor(sample, roots);

    // A branch is only ever learned from git, an agent session or an editor. Focusing a window says
    // which checkout is in front of you, not what is checked out in it.
    if (observed) branches.set(observed.repoPath, observed.branch ?? branches.get(observed.repoPath));

    // A window title and an editor heartbeat may set the sticky. A commit and an agent session may not:
    // they label a stream, and neither is a reason to hand the following minutes to the checkout they
    // name — which is what put a Figma tab and a merge-request page on the checkout somebody had just
    // committed in. A heartbeat is the opposite case. It only fires while its own window has focus, so
    // it says which checkout that window holds, which is what a title reading `Visual Studio Code`
    // cannot say when two editor windows are open on different repositories.
    if (focused && sample.kind === 'window-focus') sticky = { repoPath: focused, at: sample.at, appId };
    if (sample.kind === 'editor-heartbeat' && observed) sticky = { repoPath: observed.repoPath, at: sample.at, appId };
    if (sticky && sample.at.getTime() - sticky.at.getTime() > config.repoStickinessMs) sticky = undefined;

    // The sticky passes only inside the application that set it: an editor whose title stops naming the
    // checkout is plainly still that checkout, and a browser or a chat window is plainly not. Without
    // this, every page opened within the stickiness of an editor was booked to the editor's checkout.
    const holder = focused ?? (sticky?.appId === appId ? sticky?.repoPath : undefined);
    const context: ActivityContext = holder ? { repoPath: holder, branch: branches.get(holder), appId } : { appId };
    const next = samples[index + 1];

    // Every stretch between two samples belongs to whichever context held the focused window, so the
    // focus time of every stream sums to presence exactly and the concurrency ratio has one meaning.
    if (next) draftFor(drafts, context).focus.push({ from: sample.at, to: next.at });

    if (sample.kind === 'agent-session') {
      const cwd = repoRootOf({ path: sample.cwd, roots });
      const draft = draftFor(drafts, { repoPath: cwd, branch: branchOf(sample.gitBranch) });
      const last = lastAgentSample.get(cwd);

      draft.sessions.add(sample.sessionId);

      if (last && sample.at.getTime() - last.getTime() < config.maxUnobservedMs) {
        draft.agent.push({ from: last, to: sample.at });
      }

      lastAgentSample.set(cwd, sample.at);
    }

    const of = observed ? { repoPath: observed.repoPath, branch: observed.branch } : context;

    addEvidence(draftFor(drafts, of), secludedWindow || ownWindow ? null : evidenceFor(sample));
    marks.push({
      at: sample.at,
      state: observed ?? (holder ? { repoPath: holder, branch: branches.get(holder) } : null),
    });
  });

  for (const prompt of prompts) {
    const repoPath = checkoutOf(prompt.cwd);
    const state = repoPath ? { repoPath, branch: branchOf(prompt.gitBranch) } : null;

    addEvidence(draftFor(drafts, state ?? {}), promptEvidence(prompt));
    marks.push({ at: prompt.at, state });
  }

  for (const turn of turns) {
    const repoPath = checkoutOf(turn.cwd);

    marks.push({ at: turn.at, state: repoPath ? { repoPath, branch: branchOf(turn.gitBranch) } : null });
  }

  marks.sort((a, b) => a.at.getTime() - b.at.getTime());

  // Each mark claims the stretch up to the next one, the way the focused window claims one on an
  // observed day. A mark that names no checkout claims it for the folded line, so every minute of
  // presence has an owner and the ratio still reconciles.
  marks.forEach((mark, index) => {
    const next = marks[index + 1];

    if (!next) return;

    draftFor(drafts, mark.state ?? {}).rebuilt.push({ from: mark.at, to: next.at });
  });

  const streams: Stream[] = [];

  for (const draft of drafts.values()) {
    const focus = clipWindows({ windows: draft.focus, within: seen });
    const agent = mergeWindows(draft.agent);
    const claimed = clipWindows({ windows: draft.rebuilt, within: rebuilt });
    const blocks = mergeWindows([...focus, ...claimed, ...clipWindows({ windows: agent, within: presence })]);
    const unattended = subtractWindows({ windows: agent, without: presence });
    const span = mergeWindows([...blocks, ...unattended]);

    const first = span[0];
    const last = span[span.length - 1];

    if (!first || !last) continue;

    streams.push({
      key: draft.key,
      repoPath: draft.repoPath,
      apps: draft.apps,
      branches: draft.branches,
      agentSessions: draft.sessions.size,
      blocks,
      from: first.from,
      to: last.to,
      engagedMs: windowsMs(blocks),
      unattendedMs: windowsMs(unattended),
      neverFocused: !focus.length,
      rebuiltMs: windowsMs(clipWindows({ windows: blocks, within: rebuilt })),
      spend: emptySpend(),
      evidence: draft.evidence.slice().sort((a, b) => a.at.getTime() - b.at.getTime()),
      evidenceOmitted: draft.evidenceOmitted,
    });
  }

  streams.push(...spendOnlyStreams({ turns, streams, checkoutOf }));
  streams.sort((a, b) => a.from.getTime() - b.from.getTime() || a.key.localeCompare(b.key));

  const spend = emptySpend();
  const unattributedSpend = emptySpend();

  for (const turn of turns) {
    const repoPath = checkoutOf(turn.cwd);
    const key = repoPath ? streamKey({ repoPath }) : OTHER_APPLICATIONS_KEY;
    // `turn.cwd` is tested apart from `repoPath`: a turn that names a directory is carried by the line
    // holding that directory's minutes, the folded one included. One that names none is carried by
    // nothing, which is what `unattributedSpend` reports.
    const stream = turn.cwd ? streams.find((candidate) => candidate.key === key) : undefined;

    addSpend(stream ? stream.spend : unattributedSpend, turn);
    addSpend(spend, turn);
  }

  const presenceMs = windowsMs(presence);
  const engagedMs = streams.reduce((sum, stream) => sum + stream.engagedMs, 0);

  return {
    presenceMs,
    engagedMs,
    concurrency: presenceMs ? engagedMs / presenceMs : 0,
    unattendedMs: streams.reduce((sum, stream) => sum + stream.unattendedMs, 0),
    rebuiltMs: windowsMs(rebuilt),
    streams,
    spend,
    unattributedSpend,
    ambiguousNames: [...claimedAmbiguously],
    calls,
  };
};
