import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bareQueueLines, queueLines, rowOf, rowWithName } from './studio-queue.mjs';

const status = [
  '## Gerade in Arbeit',
  '',
  '### Warteschlange',
  '',
  'Der Builder nimmt den ersten offenen Eintrag.',
  '',
  '1. **ready und check (B588)** ⏳ eine Funktion - Builder',
  '2. **Plan-Dateien (B597)** ⏳ vier Produkte - Doc-Agent',
  '3. **B598** ⏳ ohne Namen - Builder',
  '',
  '### Einträge',
  '',
  '1. **B001** not in the queue',
  '| B588 | ready und check aus einer Funktion.      | ⏳ | 13 von 17 | Builder |',
].join('\n');

test('prints only the numbered rows of the queue section', () => {
  assert.deepEqual(queueLines(status), [
    '1. **ready und check (B588)** ⏳ eine Funktion - Builder',
    '2. **Plan-Dateien (B597)** ⏳ vier Produkte - Doc-Agent',
    '3. **B598** ⏳ ohne Namen - Builder',
  ]);
});

test('returns nothing when the queue heading is missing', () => {
  assert.deepEqual(queueLines('## Gerade in Arbeit\n\n1. **B588** x'), []);
});

test('finds the table row of one id', () => {
  assert.match(rowOf(status, 'B588'), /^\| B588 \| ready und check aus einer Funktion\./);
  assert.equal(rowOf(status, 'B58'), null);
});

test('appends the rest list of rows.md after the head, in order', () => {
  const rows = [
    '# Studio – Zeilen',
    '',
    '### Warteschlange, Rest',
    '',
    '4. **B160** ⏳ alt - Builder',
    '',
    '### Einträge',
  ];
  assert.deepEqual(
    queueLines(`${status}\n${rows.join('\n')}`).map((line) => line.match(/B\d+/)[0]),
    ['B588', 'B597', 'B598', 'B160'],
  );
});

test('lists queue lines that lack a short name', () => {
  assert.deepEqual(bareQueueLines(queueLines(status)), ['3. **B598** ⏳ ohne Namen - Builder']);
});

test('puts the short name of a row before its number', () => {
  assert.equal(
    rowWithName('| B588 | Auto-Weg-Modus | text | ⏳ |'),
    'Auto-Weg-Modus (B588): | B588 | Auto-Weg-Modus | text | ⏳ |',
  );
  assert.equal(rowWithName('| B588 | | text | ⏳ |'), '| B588 | | text | ⏳ |');
});
