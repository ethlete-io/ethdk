import assert from 'node:assert/strict';
import { test } from 'node:test';
import { settleLayout } from './settle-wait.mjs';

const settle = (reads, polls = 40) => {
  let at = 0;

  return settleLayout({
    read: async () => reads[Math.min(at++, reads.length - 1)],
    wait: async () => undefined,
    polls,
    waitedFor: '10 s',
  });
};

test('a layout that holds still for three polls settles', async () => {
  await settle([{ pending: [], layout: 'a' }]);
});

test('a row still unsized at the end of the wait throws and names it', async () => {
  await assert.rejects(settle([{ pending: ['row elements/shell-main unsized'], layout: '' }]), {
    message: 'not settled after 10 s: row elements/shell-main unsized',
  });
});

test('a row that gets its size before the end settles', async () => {
  await settle([...Array(5).fill({ pending: ['row a unsized'], layout: '' }), { pending: [], layout: 'a' }]);
});

test('a layout that still moves at the end does not throw', async () => {
  let at = 0;

  await settleLayout({
    read: async () => ({ pending: [], layout: String(at++) }),
    wait: async () => undefined,
    polls: 10,
    waitedFor: '10 s',
  });
});

test('a layout already still settles after three waits, each read seeing the same layout', async () => {
  let waits = 0;
  let reads = 0;

  await settleLayout({
    read: async () => (reads++, { pending: [], layout: 'a' }),
    wait: async () => waits++,
    polls: 40,
    waitedFor: '10 s',
  });

  assert.deepEqual({ waits, reads }, { waits: 3, reads: 4 });
});

test('a layout that moves once holds still for three more waits before it settles', async () => {
  const layouts = ['a', 'b', 'b', 'b', 'b'];
  let waits = 0;
  let at = 0;

  await settleLayout({
    read: async () => ({ pending: [], layout: layouts[Math.min(at++, layouts.length - 1)] }),
    wait: async () => waits++,
    polls: 40,
    waitedFor: '10 s',
  });

  assert.equal(waits, 4);
});

test('reports the polls a held layout needed', async () => {
  assert.deepEqual(await settle([{ pending: [], layout: '0,0,10,10' }]), { polls: 3, held: true, moved: null });
});

test('names the frame that moved in the last poll of a layout that never held', async () => {
  const reads = Array.from({ length: 5 }, (_, i) => ({ pending: [], layout: `0,0,10,10 0,${i},10,0` }));

  assert.deepEqual(await settle(reads, 4), {
    polls: 4,
    held: false,
    moved: '2 -> 2 frames, 1 at height 0, frame 1 0,3,10,0 -> 0,4,10,0',
  });
});
