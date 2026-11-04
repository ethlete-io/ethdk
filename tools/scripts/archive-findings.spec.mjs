import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  archiveFindings,
  orphanFindings,
  doneFindingNumbers,
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
