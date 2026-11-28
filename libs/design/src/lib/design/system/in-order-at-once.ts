/** Runs `run` over `items` with at most `limit` running at once, and returns the results in the order of `items`. */
export const inOrderAtOnce = async <TItem, TResult>(options: {
  items: readonly TItem[];
  limit: number;
  run: (item: TItem, index: number) => Promise<TResult>;
}): Promise<TResult[]> => {
  const { items, limit, run } = options;
  const results: TResult[] = new Array(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next++;

      results[index] = await run(items[index] as TItem, index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
};
