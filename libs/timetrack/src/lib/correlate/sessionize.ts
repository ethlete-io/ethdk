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
};

export const DEFAULT_SESSIONIZE_OPTIONS: SessionizeOptions = {
  maxUnobservedMs: 30 * 60_000,
  flapThresholdMs: 60_000,
  repoStickinessMs: 5 * 60_000,
};

type RepoState = { repoPath: string; branch?: string; at: Date };

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
    default:
      return null;
  }
};

const repoStateFor = (event: ActivityEvent): RepoState | null => {
  switch (event.kind) {
    case 'git-checkout':
    case 'git-commit':
      return { repoPath: event.repoPath, branch: event.branch, at: event.at };
    case 'agent-session':
      return { repoPath: event.cwd, branch: event.gitBranch, at: event.at };
    default:
      return null;
  }
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

  const blocks: ActivityBlock[] = [];
  let current: ActivityBlock | null = null;
  let appId: string | undefined;
  let repo: RepoState | null = null;

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
    const sampleRepo = repoStateFor(sample);
    if (sampleRepo) repo = sampleRepo;
    if (repo && sample.at.getTime() - repo.at.getTime() > config.repoStickinessMs) repo = null;

    const context: ActivityContext = { appId, repoPath: repo?.repoPath, branch: repo?.branch };

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
