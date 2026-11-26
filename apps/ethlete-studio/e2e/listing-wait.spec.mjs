import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listingWait } from './probe-helpers.mjs';

const state = (patch) => ({ holdActive: true, requested: 1, outstanding: 0, pendingMarker: false, ...patch });

test('a page with a pending marker is not answered', () => {
  assert.equal(listingWait(state({ holdActive: false, pendingMarker: true })).done, false);
  assert.equal(listingWait(state({ pendingMarker: true })).done, false);
});

test('without a hold, no pending marker is answered', () => {
  assert.equal(listingWait(state({ holdActive: false, requested: 0 })).done, true);
});

test('a hold with no listing requested is not answered', () => {
  const result = listingWait(state({ requested: 0 }));

  assert.equal(result.done, false);
  assert.match(result.reason, /no listing was requested/);
});

test('a hold with a request still held is not answered', () => {
  const result = listingWait(state({ outstanding: 2 }));

  assert.equal(result.done, false);
  assert.match(result.reason, /2 held listing request/);
});

test('a hold whose request was answered is answered', () => {
  assert.equal(listingWait(state({})).done, true);
});
