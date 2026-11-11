import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  archiveFindings,
  archiveSections,
  orphanFindings,
  doneFindingNumbers,
  main,
  splitFindings,
  writeArchive,
} from './archive-findings.mjs';
import { parseStatusRows } from './studio-status.mjs';

const status = `| ID | Was | Stand | Wo |
| -- | -- | -- | -- |
| B1 | one (Bef. 10) | ✅ | |
| B2 | two (Bef. 11/12) | ✅ | |
| B3 | three (Bef. 12) | ⏳ | |
| B4 | range (Bef. 20-21) | ✅ | |
`;

const plan = `# Plan

10\\. Tom (2026-10-31): first finding
continues here.

11\\. Tom (2026-11-02): second
body.

12\\. Tom (2026-11-02): shared with an open row.

13\\. Tom (2026-11-03): not referenced.

20\\. Tom (2026-11-03): range start.

21\\. Tom (2026-11-03): range end.

1. A decision list item.

Prose after.
`;

test('parses rows with ranges and slashes', () => {
  const rows = parseStatusRows(status);
  assert.deepEqual(
    rows.map((r) => [r.id, r.done]),
    [
      ['B1', true],
      ['B2', true],
      ['B3', false],
      ['B4', true],
    ],
  );
  assert.deepEqual([...doneFindingNumbers(rows)].sort(), [10, 11, 20, 21]);
});

test('a finding runs to its blank line, and list items are no findings', () => {
  const blocks = splitFindings(plan);
  assert.deepEqual(
    blocks.map((b) => b.number),
    [10, 11, 12, 13, 20, 21],
  );
  assert.deepEqual(blocks[0].lines, ['10\\. Tom (2026-10-31): first finding', 'continues here.']);
});

test('reads a prettier-formatted plan', () => {
  const formatted = readFileSync(
    join(import.meta.dirname, 'fixtures/studio-findings/ok/plans/ethlete-studio/design-to-code.md'),
    'utf8',
  );
  assert.deepEqual(
    splitFindings(formatted).map((b) => b.number),
    [157, 159, 160],
  );
});

test('moves done findings, keeps open ones and the order', () => {
  const { plan: rest, moved } = archiveFindings(plan, status);
  assert.deepEqual(
    moved.map((m) => [m.number, m.month]),
    [
      [10, '2026-10'],
      [11, '2026-11'],
      [20, '2026-11'],
      [21, '2026-11'],
    ],
  );
  assert.match(rest, /12\\\. Tom/);
  assert.match(rest, /13\\\. Tom/);
  assert.match(rest, /Prose after\./);
  assert.match(rest, /1\. A decision/);
  assert.doesNotMatch(rest, /first finding|continues here|range start/);
});

test('appends to an existing month file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'archive-'));
  writeArchive(dir, [{ number: 1, month: '2026-11', text: '1\\. a' }]);
  writeArchive(dir, [{ number: 2, month: '2026-11', text: '2\\. b' }]);
  assert.equal(readFileSync(join(dir, 'findings-2026-11.md'), 'utf8'), '# Findings 2026-11\n\n1\\. a\n\n2\\. b\n');
});

test('lists dated findings that no row cites', () => {
  assert.deepEqual(
    orphanFindings(plan, status),
    [
      { number: 12, title: 'Tom (2026-11-02): shared with an open row.', date: '2026-11-02' },
      { number: 13, title: 'Tom (2026-11-03): not referenced.', date: '2026-11-03' },
    ].filter((o) => o.number !== 12),
  );
});

const decisionPlan = `# Plan

### Old decisions (Tom, 2026-10-31)

Old body.

### Cited by row (Tom, 2026-10-31)

Cited body.

### Cited by adr (Tom, 2026-10-31)

Adr body.

### Holds open (Tom, 2026-10-31)

13\\. Tom (2026-10-31): open finding.

### Fresh decisions (Tom, 2026-11-06)

Fresh body.

## Next
`;

test('archives old dated decision sections and keeps cited, open and fresh ones', () => {
  const statusText = `${status}| B9 | open work (Cited by row) | ⏳ | |\n`;
  const { plan: rest, moved } = archiveSections(decisionPlan, statusText, 'see Cited by adr', {
    today: new Date('2026-11-07'),
    days: 5,
  });
  assert.deepEqual(
    moved.map((m) => m.month),
    ['2026-10'],
  );
  assert.match(moved[0].text, /^### Old decisions[\s\S]*Old body\.$/);
  assert.match(
    rest,
    /Archived: Old decisions \(2026-10-31\), see \[findings-2026-10\]\(archive\/findings-2026-10\.md\)\./,
  );
  assert.doesNotMatch(rest, /Old body/);
  for (const kept of ['Cited body', 'Adr body', 'open finding', 'Fresh body', '## Next'])
    assert.match(rest, new RegExp(kept));
});

test('an old orphan finding with a built line leaves with its trailing notes; a new or unbuilt one stays', () => {
  const orphanPlan = `# Plan

30\\. Tom (2026-10-01): old built orphan.

Built (2026-10-02): the fix.

31\\. Tom (2026-10-01): old orphan, not built.

32\\. Tom (2026-11-10): new built orphan.
As built: today.

## Next
`;
  const { plan: rest, moved } = archiveFindings(orphanPlan, status, { today: new Date('2026-11-10'), days: 5 });
  assert.deepEqual(
    moved.map((m) => m.number),
    [30],
  );
  assert.equal(moved[0].text, '30\\. Tom (2026-10-01): old built orphan.\n\nBuilt (2026-10-02): the fix.');
  assert.ok(!rest.includes('old built orphan') && !rest.includes('Built (2026-10-02)'));
  assert.ok(rest.includes('31\\.') && rest.includes('32\\.') && rest.includes('## Next'));
});

test('moves a young finding whose own As built line names it, unless STATUS names it', () => {
  const young = `# Plan

30\\. Builder (2026-11-10): built today.

As built (Linux builder, 30): done.

31\\. Builder (2026-11-10): open, an As built of another finding follows.

As built (Linux builder, 719 step): other.

32\\. Builder (2026-11-10): built, but STATUS prose names it.

As built (Linux builder, 32): done.
`;
  const prose = `${status}\n**Werkzeug-Rückstand**: 32, 650.\n`;
  const { plan: rest, moved } = archiveFindings(young, prose, { today: new Date('2026-11-10') });
  assert.deepEqual(
    moved.map((m) => m.number),
    [30],
  );
  assert.match(rest, /31\\\. Builder/);
  assert.match(rest, /32\\\. Builder/);
});

const oldDonePlan = () => {
  const root = mkdtempSync(join(tmpdir(), 'archive-cli-'));
  const studio = join(root, 'plans/ethlete-studio');
  mkdirSync(join(studio, 'archive'), { recursive: true });
  writeFileSync(
    join(studio, 'design-to-code.md'),
    '# Plan\n\n## Findings\n\n1\\. Builder (2020-01-01): an old finding.\n\nBuilt 1 as abc.\n',
  );
  writeFileSync(join(studio, 'STATUS.md'), '# Status\n');
  writeFileSync(join(studio, 'archive/findings-2020-01.md'), '# Findings 2020-01\n');
  const files = ['design-to-code.md', 'archive/findings-2020-01.md'].map((name) => join(studio, name));

  return { root, snapshot: () => files.map((file) => readFileSync(file, 'utf8')) };
};

for (const [argv, code] of [
  [['--help'], 0],
  [['--bogus'], 2],
  [['--dry-run'], 0],
]) {
  test(`${argv.join(' ')} prints and leaves both files byte-identical`, () => {
    const { root, snapshot } = oldDonePlan();
    const before = snapshot();
    const lines = [];
    assert.equal(main(argv, { root, log: (line) => lines.push(line) }), code);
    assert.deepEqual(snapshot(), before);
    assert.ok(lines.length > 0);
  });
}

test('a plain run moves the old done finding', () => {
  const { root, snapshot } = oldDonePlan();
  const before = snapshot();
  const lines = [];
  assert.equal(main([], { root, log: (line) => lines.push(line) }), 0);
  assert.notDeepEqual(snapshot(), before);
  assert.match(lines.at(-1), /^moved [1-9]/);
});

test('an old finding with no STATUS row and a built marker in its text leaves; a pushed sha counts, an unpushed one does not', () => {
  const markerPlan = `# Plan

40\\. Tom (2026-10-01): old. As built in the note.

41\\. Tom (2026-10-01): old. Built in bbbbbbb2.

42\\. Tom (2026-10-01): old, open.

43\\. Tom (2026-10-01): old. Built in aaaaaaa1.
`;
  const { plan: rest, moved } = archiveFindings(markerPlan, status, {
    today: new Date('2026-11-10'),
    days: 5,
    isPushed: (sha) => sha === 'aaaaaaa1',
  });
  assert.deepEqual(
    moved.map((m) => m.number),
    [40, 43],
  );
  assert.ok(rest.includes('41\\.') && rest.includes('42\\.') && !rest.includes('40\\.'));
});

test('a context sha or loose built prose moves nothing; only the Built in marker does', () => {
  const contextPlan = `# Plan

50\\. Tom (2026-10-01): old, cites context aaaaaaa1 and was not built in aaaaaaa1 yet.

51\\. Tom (2026-10-01): old, fixed in aaaaaaa1.

52\\. Tom (2026-10-01): old. Built in aaaaaaa1.
`;
  const { moved } = archiveFindings(contextPlan, status, {
    today: new Date('2026-11-10'),
    days: 5,
    isPushed: () => true,
  });
  assert.deepEqual(
    moved.map((m) => m.number),
    [52],
  );
});
