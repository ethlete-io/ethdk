import { ActivityBlock, ActivityContext, blockDurationMs, contextKey } from '../model/block';
import { ActivityEvent, CollectedEvent, isActivityEvent } from '../model/event';
import { Evidence } from '../model/evidence';

export type WorkingHours = {
  /** Minutes since local midnight. */
  startMinute: number;
  endMinute: number;
};

export type SessionizeOptions = {
  /**
   * The safety valve for a stretch nothing observed at all. It is deliberately generous, because
   * the collectors are edge-triggered — a focus event fires on a switch and a commit when you
   * commit, so ten quiet minutes inside one context are normal work, not absence. Real idleness
   * arrives as a presence event from the idle notifier instead.
   */
  maxUnobservedMs: number;
  /** A block shorter than this is flapping — an alt-tab, not a context switch. */
  flapThresholdMs: number;
  /** How long a repo and branch keep labelling the context after their last event. */
  repoStickinessMs: number;
  /** When set, blocks are clipped to these local hours and anything outside is dropped. */
  workingHours?: WorkingHours;
  /**
   * The repository roots the host discovered. An agent session reports the directory it was started
   * in, which is often a subdirectory of a checkout, and without these each subdirectory becomes a
   * context of its own — the day fragments and a rule written for the repository matches none of it.
   */
  repoRoots?: readonly string[];
};

export const DEFAULT_SESSIONIZE_OPTIONS: SessionizeOptions = {
  maxUnobservedMs: 30 * 60_000,
  flapThresholdMs: 60_000,
  repoStickinessMs: 5 * 60_000,
};

type RepoState = { repoPath: string; branch?: string; at: Date };

/** What a window manager puts between the parts of a title. */
const TITLE_SEGMENTS = /\s[-–—|]\s/;

const evidenceFor = (event: ActivityEvent): Evidence | null => {
  switch (event.kind) {
    case 'window-focus':
      return { kind: 'window-title', at: event.at, detail: event.title };
    case 'git-checkout':
      return { kind: 'branch', at: event.at, detail: `branch \`${event.branch}\` checked out in ${event.repoPath}` };
    case 'git-commit':
      return {
        kind: 'commit',
        at: event.at,
        detail: `${event.sha.slice(0, 7)} ${event.subject}`,
        summary: event.subject,
      };
    case 'agent-session':
      return {
        kind: 'agent-session',
        at: event.at,
        detail: event.title ?? `agent session ${event.sessionId} in ${event.cwd}`,
        summary: event.title,
      };
    case 'editor-heartbeat':
      return {
        kind: 'editor',
        at: event.at,
        detail: `${event.editing ? 'edited' : 'read'} ${event.directory ?? event.repoPath ?? event.reporter}`,
      };
    default:
      return null;
  }
};

/**
 * The checkout a directory belongs to, or the directory itself when no known root contains it.
 *
 * Longest root wins, so a repository checked out inside another one keeps its own identity. Keeping
 * the directory when nothing matches is deliberate: an agent session run somewhere the discovery never
 * walked is still context, and dropping it would lose the branch it reported with it.
 */
const repoRootOf = (options: { path: string; roots: readonly string[] }) => {
  let found: string | undefined;

  for (const root of options.roots) {
    if (options.path !== root && !options.path.startsWith(`${root}/`)) continue;
    if (found && found.length >= root.length) continue;

    found = root;
  }

  return found ?? options.path;
};

/**
 * A branch name, or nothing for a detached checkout.
 *
 * A collector that asks git for the current branch is answered `HEAD` when none is checked out, and
 * git refuses `HEAD` as a branch name, so it never names one. The reader drops it rather than the
 * collectors alone, because events already in the store carry whatever they were written with.
 */
const branchOf = (branch: string | undefined) => (branch === 'HEAD' ? undefined : branch);

const repoStateFor = (event: ActivityEvent, roots: readonly string[]): RepoState | null => {
  switch (event.kind) {
    case 'git-checkout':
    case 'git-commit':
      return { repoPath: event.repoPath, branch: branchOf(event.branch), at: event.at };
    case 'agent-session':
      return { repoPath: repoRootOf({ path: event.cwd, roots }), branch: branchOf(event.gitBranch), at: event.at };
    case 'editor-heartbeat':
      return event.repoPath
        ? { repoPath: repoRootOf({ path: event.repoPath, roots }), branch: branchOf(event.branch), at: event.at }
        : null;
    default:
      return null;
  }
};

/**
 * Which repository a window title names, by the directory the checkout lives in.
 *
 * An editor puts the folder in its own title segment — `list.ts - fut-frontend - Visual Studio Code`
 * — and with several editor windows open on different checkouts that segment is the only thing saying
 * which of them has focus. Matching a whole segment rather than a substring is what keeps a page title
 * from claiming a repository whose name merely appears somewhere in it.
 */
const repoNamedIn = (options: { title: string; byName: Map<string, string> }) =>
  options.title
    .split(TITLE_SEGMENTS)
    .map((segment) => options.byName.get(segment.trim()))
    .find((repoPath) => !!repoPath);

/**
 * Indexes the window's repositories by their directory name.
 *
 * A name two of them share is dropped rather than resolved: guessing which `api` an editor is showing
 * would attribute one project's time to another, and no attribution is the better failure.
 */
const reposByName = (samples: ActivityEvent[], roots: readonly string[]) => {
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

const addEvidence = (into: Evidence[], evidence: Evidence | null) => {
  if (!evidence) return;
  if (into.some((entry) => entry.kind === evidence.kind && entry.detail === evidence.detail)) return;
  into.push(evidence);
};

const clampToWorkingHours = (block: ActivityBlock, hours: WorkingHours): ActivityBlock | null => {
  const dayStart = new Date(block.from);
  dayStart.setHours(0, hours.startMinute, 0, 0);
  const dayEnd = new Date(block.from);
  dayEnd.setHours(0, hours.endMinute, 0, 0);

  const from = block.from < dayStart ? dayStart : block.from;
  const to = block.to > dayEnd ? dayEnd : block.to;

  return from < to ? { ...block, from, to } : null;
};

/**
 * Absorbs flapping into the block before it, then merges neighbours that ended up in the same
 * context — which is what makes an alt-tab to Slack and back one coding block rather than three.
 * Only genuinely contiguous neighbours merge, so a block that ended at an idle stays separate from
 * the one that resumes the same work an hour later.
 */
const collapse = (blocks: ActivityBlock[], flapThresholdMs: number) => {
  const kept: ActivityBlock[] = [];

  for (const block of blocks) {
    const previous = kept[kept.length - 1];

    if (blockDurationMs(block) < flapThresholdMs) {
      if (!previous) continue;
      previous.to = block.to;
      for (const evidence of block.evidence) addEvidence(previous.evidence, evidence);
      continue;
    }

    const contiguous = previous?.to.getTime() === block.from.getTime();

    if (previous && contiguous && contextKey(previous.context) === contextKey(block.context)) {
      previous.to = block.to;
      for (const evidence of block.evidence) addEvidence(previous.evidence, evidence);
      continue;
    }

    kept.push(block);
  }

  return kept;
};

/**
 * Turns raw observations into contiguous same-context blocks. A block ends where the context
 * changes, where presence ends, or where the samples simply stop — and in that last case it ends
 * at its final sample rather than being stretched to the next one, because nothing observed the
 * time in between.
 */
export const sessionize = (options: {
  events: CollectedEvent[];
  options?: Partial<SessionizeOptions>;
}): ActivityBlock[] => {
  const config = { ...DEFAULT_SESSIONIZE_OPTIONS, ...options.options };
  const samples = options.events
    .filter(isActivityEvent)
    .slice()
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const roots = config.repoRoots ?? [];
  const byName = reposByName(samples, roots);
  const blocks: ActivityBlock[] = [];
  /** The branch last seen in each repository, and when that repository was last observed at all. */
  const repos = new Map<string, { branch?: string; at: Date }>();
  let current: ActivityBlock | null = null;
  let appId: string | undefined;
  let repoPath: string | undefined;

  const close = (at: Date) => {
    if (!current) return;
    if (at > current.to) current.to = at;
    blocks.push(current);
    current = null;
  };

  for (const sample of samples) {
    if (sample.source === 'idle') {
      if (sample.kind === 'idle-start' || sample.kind === 'lock') close(sample.at);
      continue;
    }

    if (current && sample.at.getTime() - current.to.getTime() >= config.maxUnobservedMs) close(current.to);

    if (sample.kind === 'window-focus') appId = sample.appId;

    const observed = repoStateFor(sample, roots);
    const focused = sample.kind === 'window-focus' ? repoNamedIn({ title: sample.title, byName }) : undefined;
    const moved = observed?.repoPath ?? focused;

    if (moved) {
      // A branch is only ever learned from git or an agent session. Focusing an editor window says
      // which checkout is in front of you, not what is checked out in it, so it keeps the branch the
      // repository was last seen on rather than clearing it.
      repos.set(moved, { branch: observed?.branch ?? repos.get(moved)?.branch, at: sample.at });
      repoPath = moved;
    }

    const seen = repoPath ? repos.get(repoPath) : undefined;

    if (repoPath && (!seen || sample.at.getTime() - seen.at.getTime() > config.repoStickinessMs)) {
      repoPath = undefined;
    }

    const context: ActivityContext = { appId, repoPath, branch: repoPath ? repos.get(repoPath)?.branch : undefined };

    if (current && contextKey(current.context) === contextKey(context)) {
      current.to = sample.at;
      addEvidence(current.evidence, evidenceFor(sample));
      continue;
    }

    close(sample.at);
    current = { from: sample.at, to: sample.at, context, evidence: [] };
    addEvidence(current.evidence, evidenceFor(sample));
  }

  if (current) close(current.to);

  const collapsed = collapse(blocks, config.flapThresholdMs);
  const hours = config.workingHours;

  return hours
    ? collapsed.map((block) => clampToWorkingHours(block, hours)).filter((block): block is ActivityBlock => !!block)
    : collapsed;
};
