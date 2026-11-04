import assert from 'node:assert/strict';
import { test } from 'node:test';
import { literalsOf, removedLiterals, staleSpecHits } from './studio-label-specs.mjs';

test('splits template literals around placeholders and drops short ones', () => {
  assert.deepEqual(literalsOf("a: (f: string) => `Kommentar zu ${f} danach`, b: 'ja'"), ['Kommentar zu', 'danach']);
});

test('keeps only removed texts that no longer exist in the file', () => {
  const diff = [
    '--- a/x',
    "-    staleGo: 'Go ist veraltet',",
    "-    noGo: 'Noch kein Go',",
    "+    staleGo: 'Go ist alt',",
  ].join('\n');
  assert.deepEqual(removedLiterals(diff, "noGo: 'Noch kein Go'"), ['Go ist veraltet']);
});

test('reports every spec line that asserts a removed text', () => {
  const hits = staleSpecHits(['Go ist veraltet'], () => ['a.spec.ts:3:expect(x).toBe("Go ist veraltet")']);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].literal, 'Go ist veraltet');
});
