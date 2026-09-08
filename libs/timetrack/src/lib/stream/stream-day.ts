import { ActivityContext, streamKey } from '../model/block';
import { branchOf, repoRootOf } from '../model/context';
import {
  ActivityEvent,
  AgentUsageEvent,
  CollectedEvent,
  CollectedEventSource,
  TokenUsage,
  isActivityEvent,
} from '../model/event';
import { Evidence } from '../model/evidence';
import { TimeWindow } from '../model/time-window';
import { presenceWindows } from './presence';
import { clipWindows, mergeWindows, subtractWindows, windowsMs } from './windows';

/** The key of the one line every application with no checkout folds into. */
export const OTHER_APPLICATIONS_KEY = 'other-applications';

/** The sources a day is read from. `editor`, `calendar`, `gitlab` and `ingest` stay in the store, unread. */
const READ_SOURCES: readonly CollectedEventSource[] = ['window', 'idle', 'git', 'agent-session'];

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
   * The repository roots the host discovered. An agent session reports the directory it was started in,
   * which is often a subdirectory of a checkout, and without these each subdirectory becomes a stream.
   */
  repoRoots?: readonly string[];
};

export const DEFAULT_STREAM_DAY_OPTIONS: StreamDayOptions = {
  maxUnobservedMs: 30 * 60_000,
  repoStickinessMs: 5 * 60_000,
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
  spend: StreamSpend;
  evidence: Evidence[];
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
  /** Every turn the day read, whichever stream took it. */
  spend: StreamSpend;
  /**
   * The part of `spend` that names no working directory at all, so nothing can carry it. A turn spent
   * while the user was away is not this: its checkout books it, and the stream reports the time as
   * unattended.
   */
  unattributedSpend: StreamSpend;
};

type StreamDraft = {
  key: string;
  repoPath?: string;
  apps: string[];
  branches: string[];
  sessions: Set<string>;
  focus: TimeWindow[];
  agent: TimeWindow[];
  evidence: Evidence[];
};

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

const evidenceFor = (sample: ActivityEvent): Evidence | null => {
  switch (sample.kind) {
    case 'window-focus':
      return { kind: 'window-title', at: sample.at, detail: sample.title };
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

const addEvidence = (into: Evidence[], evidence: Evidence | null) => {
  if (!evidence) return;
  if (into.some((entry) => entry.kind === evidence.kind && entry.detail === evidence.detail)) return;

  into.push(evidence);
};

const repoStateFor = (sample: ActivityEvent, roots: readonly string[]): RepoState | null => {
  switch (sample.kind) {
    case 'git-checkout':
    case 'git-commit':
      return { repoPath: sample.repoPath, branch: branchOf(sample.branch) };
    case 'agent-session':
      return { repoPath: repoRootOf({ path: sample.cwd, roots }), branch: branchOf(sample.gitBranch) };
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

/**
 * Indexes the checkouts by their directory name.
 *
 * A name two of them share is dropped rather than resolved: guessing which `api` an editor is showing
 * would attribute one project's time to another, and no attribution is the better failure.
 */
const reposByName = (samples: readonly ActivityEvent[], roots: readonly string[]) => {
  const byName = new Map<string, string>();
  const ambiguous = new Set<string>();

  for (const sample of samples) {
    const repoPath = repoStateFor(sample, roots)?.repoPath;
    const name = repoPath?.split('/').filter(Boolean).pop();

    if (!repoPath || !name) continue;
    if (byName.get(name) !== undefined && byName.get(name) !== repoPath) ambiguous.add(name);

    byName.set(name, repoPath);
  }

  for (const name of ambiguous) byName.delete(name);

  return byName;
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
    evidence: [],
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
  roots: readonly string[];
}): Stream[] => {
  const drafts = new Map<string, { stream: Stream; sessions: Set<string> }>();

  for (const turn of options.turns) {
    if (!turn.cwd) continue;

    const repoPath = repoRootOf({ path: turn.cwd, roots: options.roots });
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
          spend: emptySpend(),
          evidence: [],
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
  const samples = options.events
    .filter(isActivityEvent)
    .filter((sample) => READ_SOURCES.includes(sample.source))
    .slice()
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const presence = presenceWindows({ samples, maxUnobservedMs: config.maxUnobservedMs });
  const byName = reposByName(samples, roots);
  const drafts = new Map<string, StreamDraft>();
  /** The branch each checkout was last seen on. Learned from git and from an agent session alike. */
  const branches = new Map<string, string | undefined>();
  const lastAgentSample = new Map<string, Date>();
  let sticky: { repoPath: string; at: Date } | undefined;
  let focused: string | undefined;
  let appId: string | undefined;

  samples.forEach((sample, index) => {
    if (sample.kind === 'window-focus') {
      appId = sample.appId;
      focused = repoNamedIn({ title: sample.title, byName });
    }

    const observed = repoStateFor(sample, roots);

    // A branch is only ever learned from git or an agent session. Focusing a window says which
    // checkout is in front of you, not what is checked out in it.
    if (observed) branches.set(observed.repoPath, observed.branch ?? branches.get(observed.repoPath));

    // An agent session does not make its checkout sticky. It has a stream of its own now, and letting
    // it hold the sticky would hand it every minute the user spent in an unrelated window.
    const named = sample.kind === 'window-focus' ? focused : sample.source === 'git' ? observed?.repoPath : undefined;

    if (named) sticky = { repoPath: named, at: sample.at };
    if (sticky && sample.at.getTime() - sticky.at.getTime() > config.repoStickinessMs) sticky = undefined;

    const holder = focused ?? sticky?.repoPath;
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

    const evidence = evidenceFor(sample);
    const of = observed ? { repoPath: observed.repoPath, branch: observed.branch } : context;

    addEvidence(draftFor(drafts, of).evidence, evidence);
  });

  const streams: Stream[] = [];

  for (const draft of drafts.values()) {
    const focus = clipWindows({ windows: draft.focus, within: presence });
    const agent = mergeWindows(draft.agent);
    const blocks = mergeWindows([...focus, ...clipWindows({ windows: agent, within: presence })]);
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
      spend: emptySpend(),
      evidence: draft.evidence.slice().sort((a, b) => a.at.getTime() - b.at.getTime()),
    });
  }

  const turns = options.events.filter((event): event is AgentUsageEvent => event.source === 'agent-usage');

  streams.push(...spendOnlyStreams({ turns, streams, roots }));
  streams.sort((a, b) => a.from.getTime() - b.from.getTime() || a.key.localeCompare(b.key));

  const spend = emptySpend();
  const unattributedSpend = emptySpend();

  for (const turn of turns) {
    const key = streamKey({ repoPath: repoRootOf({ path: turn.cwd, roots }) });
    const stream = streams.find((candidate) => candidate.key === key);

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
    streams,
    spend,
    unattributedSpend,
  };
};
