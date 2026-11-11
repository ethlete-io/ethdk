import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markBuilt } from './mark-built-findings.mjs';

const commits = {
  aaaaaaa1: { date: '2026-11-02', subject: 'fix(repo): Something' },
  bbbbbbb2: { date: '2026-11-02', subject: 'docs(repo): Notes' },
  ccccccc3: { date: '2026-10-01', subject: 'fix(repo): Too early' },
};
const lookup = (sha) => commits[sha] ?? null;

test('marks only a finding whose fix phrase names a proven fix commit', () => {
  const plan = `10\\. Tom (2026-11-01): proven.
Fixed in \`aaaaaaa1\`.

11\\. Tom (2026-11-01): docs commit only. Fixed in bbbbbbb2.

12\\. Tom (2026-11-01): unknown sha. Fixed in ddddddd4.

13\\. Tom (2026-11-01): context sha aaaaaaa1 only.

14\\. Tom (2026-11-01): before the finding. Fixed in ccccccc3.

15\\. Tom (2026-11-01): already. Built in aaaaaaa1.
`;
  const { plan: out, marked } = markBuilt(plan, lookup);
  assert.deepEqual(marked, [{ number: 10, sha: 'aaaaaaa1' }]);
  assert.ok(out.includes('Fixed in `aaaaaaa1`. Built in aaaaaaa1.'));
  assert.equal(out.split('Built in').length, 3);
});
