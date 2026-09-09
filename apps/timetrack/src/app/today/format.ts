import { Stream, StreamSpend, formatDurationMs, formatTokenCount } from '@ethlete/timetrack';

/** What a stream is, for its line: the checkout's directory name, else the folded line's own name. */
export const formatStreamLabel = (stream: Stream) =>
  stream.repoPath?.split('/').filter(Boolean).pop() ?? 'Other applications';

/**
 * What a set of turns spent, as the two counts a day is read by: what was written, and what was read
 * back out of the cache. No turns reads as nothing at all rather than as two zeros.
 */
export const formatSpend = (spend: StreamSpend) => {
  const { turns, usage } = spend;

  if (!turns) return '';

  return `${turns} ${turns === 1 ? 'turn' : 'turns'} · ${formatTokenCount(usage.output)} out · ${formatTokenCount(
    usage.cacheRead,
  )} cached`;
};

/**
 * How many agent runs a checkout held. Blocks are intervals, so five consoles in one checkout extend
 * one block rather than sum to five, and this count is the only thing on the line that says five ran.
 */
export const formatAgentSessions = (stream: Stream) => {
  const { agentSessions } = stream;

  if (!agentSessions) return '';

  return `${agentSessions} agent ${agentSessions === 1 ? 'session' : 'sessions'}`;
};

/**
 * The branches on a stream's line: what the day observed, and otherwise the branch the reflog says the
 * checkout was on. A stream with no checkout at all never carries one.
 */
export const formatBranches = (options: { stream: Stream; headBranches: Record<string, string> }) => {
  const { stream, headBranches } = options;

  if (stream.branches.length) return stream.branches.join(' · ');

  return stream.repoPath ? (headBranches[stream.repoPath] ?? '') : '';
};

/** Under this a minute readout rounds to `0m`, so a labelled sliver would carry no number at all. */
const READABLE_MS = 30_000;

/**
 * Agent time nobody was at the machine for. Anything under a rounded minute reads as nothing at all,
 * so an ordinary day gains no extra number.
 */
export const formatUnattended = (ms: number) => (ms >= READABLE_MS ? `${formatDurationMs(ms)} unattended` : '');

/**
 * Presence nothing watched, rebuilt from what the day left behind. Anything under a rounded minute
 * reads as nothing at all, so an ordinary day gains no extra number.
 */
export const formatRebuilt = (ms: number) => (ms >= READABLE_MS ? `${formatDurationMs(ms)} rebuilt` : '');
