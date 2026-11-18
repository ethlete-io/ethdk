import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queueLines, rowOf } from './studio-queue.mjs';

const status = [
  '## Gerade in Arbeit',
  '',
  '### Warteschlange',
  '',
  'Der Builder nimmt den ersten offenen Eintrag.',
  '',
  '1. **B588** ⏳ ready und check - Builder',
  '2. **B597** ⏳ Plan-Dateien - Doc-Agent',
  '',
  '### Einträge',
  '',
  '1. **B001** not in the queue',
  '| B588 | ready und check aus einer Funktion.      | ⏳ | 13 von 17 | Builder |',
].join('\n');

test('prints only the numbered rows of the queue section', () => {
  assert.deepEqual(queueLines(status), [
    '1. **B588** ⏳ ready und check - Builder',
    '2. **B597** ⏳ Plan-Dateien - Doc-Agent',
  ]);
});

test('returns nothing when the queue heading is missing', () => {
  assert.deepEqual(queueLines('## Gerade in Arbeit\n\n1. **B588** x'), []);
});

test('finds the table row of one id', () => {
  assert.match(rowOf(status, 'B588'), /^\| B588 \| ready und check aus einer Funktion\./);
  assert.equal(rowOf(status, 'B58'), null);
});
