import { contextKey } from '../model/block';
import { UnnamedContext, suggestionFor } from '../model/attribution';
import { foldByKey } from './fold-by-key';
import { WorkGroup } from './merge';

/**
 * Folds the day's unattributed groups into the contexts behind them, widest first. A group carrying
 * no context at all — a meeting, a timer run — is left out: there is nothing to write a rule about,
 * and those are named on the rows themselves.
 */
export const unnamedContexts = (options: { unattributed: readonly WorkGroup[] }): UnnamedContext[] =>
  foldByKey({
    entries: options.unattributed.flatMap((group) => group.blocks),
    blockOf: (block) => block,
    keyOf: ({ context }) => (context.repoPath || context.appId ? contextKey(context) : undefined),
    open: ({ entry, key, span }) => ({
      id: key,
      context: entry.context,
      ...span,
      suggestion: suggestionFor(entry.context),
    }),
  });
