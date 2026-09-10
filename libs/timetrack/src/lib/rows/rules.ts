import { blockDurationMs, contextKey } from '../model/block';
import { UnnamedContext, suggestionFor } from '../model/attribution';
import { WorkGroup } from './merge';

/**
 * Folds the day's unattributed groups into the contexts behind them, widest first. A group carrying
 * no context at all — a meeting, a timer run — is left out: there is nothing to write a rule about,
 * and those are named on the rows themselves.
 */
export const unnamedContexts = (options: { unattributed: readonly WorkGroup[] }): UnnamedContext[] => {
  const found = new Map<string, UnnamedContext>();

  for (const group of options.unattributed) {
    for (const block of group.blocks) {
      const { context } = block;

      if (!context.repoPath && !context.appId) continue;

      const id = contextKey(context);
      const existing = found.get(id);
      const observedMs = blockDurationMs(block);

      if (!existing) {
        found.set(id, { id, context, observedMs, from: block.from, to: block.to, suggestion: suggestionFor(context) });
        continue;
      }

      existing.observedMs += observedMs;
      if (block.from < existing.from) existing.from = block.from;
      if (block.to > existing.to) existing.to = block.to;
    }
  }

  return [...found.values()].sort((a, b) => b.observedMs - a.observedMs);
};
