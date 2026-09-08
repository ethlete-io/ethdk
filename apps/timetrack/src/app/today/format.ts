import { Stream, StreamSpend, formatTokenCount } from '@ethlete/timetrack';

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
