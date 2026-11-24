export const shardShareOf = (queue, shard, keyOf, weights = {}) => {
  const own = queue.filter((job) => job.ownShard);
  const rest = queue.filter((job) => !job.ownShard);

  if (shard.count === 1) return queue;

  const ownShards = own.length < shard.count ? own.length : Math.min(own.length, 1);
  const firstOwn = shard.count - ownShards + 1;

  if (ownShards && shard.index >= firstOwn) return ownShards === own.length ? [own[shard.index - firstOwn]] : own;

  const count = shard.count - ownShards;
  const known = rest.map((job) => weights[keyOf(job)]).filter((weight) => weight !== undefined);
  const fallback = known.length ? known.toSorted((a, b) => a - b)[known.length >> 1] : 1;
  const weightOf = (job) => weights[keyOf(job)] ?? fallback;
  const loads = Array.from({ length: count }, () => 0);
  const shardOf = new Map();

  for (const job of rest.toSorted((a, b) => weightOf(b) - weightOf(a) || (keyOf(a) < keyOf(b) ? -1 : 1))) {
    const lightest = loads.indexOf(Math.min(...loads));

    loads[lightest] += weightOf(job);
    shardOf.set(job, lightest);
  }

  return rest.filter((job) => shardOf.get(job) === shard.index - 1);
};
