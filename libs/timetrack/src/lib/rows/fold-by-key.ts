import { ActivityBlock, blockDurationMs } from '../model/block';

type Spanned = { observedMs: number; from: Date; to: Date };

export const foldByKey = <TEntry, TFolded extends Spanned>(options: {
  entries: readonly TEntry[];
  blockOf: (entry: TEntry) => ActivityBlock;
  keyOf: (entry: TEntry) => string | undefined;
  open: (options: { entry: TEntry; key: string; span: Spanned }) => TFolded;
}): TFolded[] => {
  const found = new Map<string, TFolded>();

  for (const entry of options.entries) {
    const key = options.keyOf(entry);

    if (key === undefined) continue;

    const block = options.blockOf(entry);
    const observedMs = blockDurationMs(block);
    const existing = found.get(key);

    if (!existing) {
      found.set(key, options.open({ entry, key, span: { observedMs, from: block.from, to: block.to } }));
      continue;
    }

    existing.observedMs += observedMs;
    if (block.from < existing.from) existing.from = block.from;
    if (block.to > existing.to) existing.to = block.to;
  }

  return [...found.values()].sort((a, b) => b.observedMs - a.observedMs);
};
