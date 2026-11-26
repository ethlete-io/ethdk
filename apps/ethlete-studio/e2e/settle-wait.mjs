export const settleLayout = async ({ read, wait, polls, quiet = 3, waitedFor }) => {
  let now = await read();
  let last = now.pending.length ? null : now.layout;
  let same = 0;
  let poll = 0;
  let before = now.layout;
  const started = Date.now();

  for (; poll < polls && same < quiet; poll++) {
    await wait();
    before = now.layout;
    now = await read();
    same = !now.pending.length && now.layout === last ? same + 1 : 0;
    last = now.pending.length ? null : now.layout;
  }

  if (now.pending.length) {
    const error = new Error(`not settled after ${waitedFor}: ${now.pending.join(', ')}`);
    error.settle = { polls: poll, ms: Date.now() - started, layout: now.layout, pending: now.pending };
    throw error;
  }

  return {
    polls: poll,
    ms: Date.now() - started,
    layout: now.layout,
    held: same >= quiet,
    moved: same >= quiet ? null : layoutMove(before, now.layout),
  };
};

const layoutMove = (before, after) => {
  const frames = (layout) => (layout ? layout.split(' ') : []);
  const [was, is] = [frames(before), frames(after)];
  const index = is.findIndex((box, i) => box !== was[i]);
  const zeroHeight = is.filter((box) => box.endsWith(',0')).length;
  const first =
    index === -1 ? 'no frame moved in the last poll' : `frame ${index} ${was[index] ?? 'none'} -> ${is[index]}`;

  return `${was.length} -> ${is.length} frames, ${zeroHeight} at height 0, ${first}`;
};
