export const shardShareOf = (queue, shard, keyOf) => {
  const own = queue.filter((job) => job.ownShard);
  const rest = queue.filter((job) => !job.ownShard);

  if (shard.count === 1) return queue;

  const ownShards = own.length < shard.count ? own.length : Math.min(own.length, 1);
  const firstOwn = shard.count - ownShards + 1;

  if (ownShards && shard.index >= firstOwn) return ownShards === own.length ? [own[shard.index - firstOwn]] : own;

  const count = shard.count - ownShards;
  const slot = Object.fromEntries(
    Object.values(Object.groupBy(rest, (job) => job.page)).flatMap((jobs) => jobs.map((job, at) => [keyOf(job), at])),
  );

  return rest
    .toSorted((a, b) => slot[keyOf(a)] - slot[keyOf(b)])
    .filter((_, at) => Math.min(at % (2 * count), 2 * count - 1 - (at % (2 * count))) === shard.index - 1);
};
