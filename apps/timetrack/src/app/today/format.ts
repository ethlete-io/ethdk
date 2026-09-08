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
