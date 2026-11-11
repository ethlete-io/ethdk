import assert from 'node:assert/strict';
import { test } from 'node:test';
import { noMatchLineOf } from './case-filter.mjs';

test('a filter that matches no case names the closest case names first', () => {
  const line = noMatchLineOf({
    flag: '--case',
    only: 'sketch merge view',
    names: ['tab focus shows the ring', 'a sketch merged while its view is open', 'a sketch discarded'],
  });

  assert.equal(
    line,
    '--case "sketch merge view" matches no case; closest names:\n  a sketch merged while its view is open\n  a sketch discarded\n  tab focus shows the ring',
  );
});
