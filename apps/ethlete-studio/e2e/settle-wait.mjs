export const settleLayout = async ({ read, wait, polls, quiet = 3, waitedFor }) => {
  let last = null;
  let same = 0;
  let now = { pending: [], layout: '' };

  for (let poll = 0; poll < polls && same < quiet; poll++) {
    await wait();
    now = await read();
    same = !now.pending.length && now.layout === last ? same + 1 : 0;
    last = now.pending.length ? null : now.layout;
  }

  if (now.pending.length) throw new Error(`not settled after ${waitedFor}: ${now.pending.join(', ')}`);
};
