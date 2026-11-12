export const shardShareOf = (queue, shard, keyOf) => {
  const own = queue.filter((job) => job.ownShard);
  const rest = queue.filter((job) => !job.ownShard);

  if (shard.count === 1) return queue;
  if (own.length && shard.index === shard.count) return own;

  const count = own.length ? shard.count - 1 : shard.count;
  const slot = Object.fromEntries(
    Object.values(Object.groupBy(rest, (job) => job.page)).flatMap((jobs) => jobs.map((job, at) => [keyOf(job), at])),
  );

  return rest
    .toSorted((a, b) => slot[keyOf(a)] - slot[keyOf(b)])
    .filter((_, at) => Math.min(at % (2 * count), 2 * count - 1 - (at % (2 * count))) === shard.index - 1);
};
