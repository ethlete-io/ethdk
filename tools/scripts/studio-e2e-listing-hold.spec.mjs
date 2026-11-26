import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listingHold } from './studio-e2e-listing-hold.mjs';

const gate = () => {
  const releases = [];

  return {
    wait: () => new Promise((done) => releases.push(done)),
    releaseAll: () => releases.splice(0).forEach((release) => release()),
  };
};

test('a passing case that ends while its held listing is pending fails', () => {
  const { wait } = gate();
  const hold = listingHold(14000, wait);

  hold.startJob();
  hold.startRun();
  void hold.hold();

  const result = hold.check({ ok: true, detail: 'kept 3 pictures' });

  assert.equal(result.ok, false);
  assert.match(
    result.detail,
    /^ended while a held listing was pending: its wait is shorter than the 14000 ms hold; wait longer or set holdListings: false \(kept 3 pictures\)$/,
  );
});

test('a case that waits past the hold passes', async () => {
  const { wait, releaseAll } = gate();
  const hold = listingHold(14000, wait);

  hold.startJob();
  hold.startRun();

  const held = hold.hold();

  releaseAll();
  await held;

  assert.deepEqual(hold.check({ ok: true, detail: 'ok' }), { ok: true, detail: 'ok' });
});

test('a listing still held from the previous case does not flag the next one', () => {
  const { wait } = gate();
  const hold = listingHold(14000, wait);

  hold.startJob();
  hold.startRun();
  void hold.hold();
  hold.startJob();

  assert.deepEqual(hold.check({ ok: true, detail: 'ok' }), { ok: true, detail: 'ok' });
});

test('a failing case keeps its own detail', () => {
  const { wait } = gate();
  const hold = listingHold(14000, wait);

  hold.startJob();
  hold.startRun();
  void hold.hold();

  assert.deepEqual(hold.check({ ok: false, detail: 'lost 1 picture' }), { ok: false, detail: 'lost 1 picture' });
});

test('a listing held since the page load, before the case ran, does not flag it', () => {
  const { wait } = gate();
  const hold = listingHold(14000, wait);

  hold.startJob();
  void hold.hold();
  hold.startRun();

  assert.deepEqual(hold.check({ ok: true, detail: 'ok' }), { ok: true, detail: 'ok' });
});
