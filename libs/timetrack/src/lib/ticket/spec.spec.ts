import { describe, expect, it } from 'vitest';
import { readTicketWritingSpec, touchedDirectories } from './spec';

const metadata = JSON.stringify({
  id: '20260819_bracket-challenge',
  title: 'Bracket Challenge — Vorhersage-Spiel auf einem Weiterkommen-Graph',
  type: 'feature',
  assignee: 'Nils Ziermann',
  tags: ['bracket', 'prediction'],
  jira_epic: 'FIFAGG-12573',
});

const index = [
  '# Track: Bracket Challenge',
  '',
  '- **ID:** `20260819_bracket-challenge`',
  '',
  '## Kurzfassung',
  '',
  'Vorhersage-Spiel auf einem Wettbewerb.',
  '',
  '## Stand',
  '',
  'Phase 6 von 7.',
].join('\n');

describe('readTicketWritingSpec', () => {
  it('reads the title, the type, the tags and the epic the spec already names', () => {
    expect(readTicketWritingSpec({ metadata })).toMatchObject({
      title: 'Bracket Challenge — Vorhersage-Spiel auf einem Weiterkommen-Graph',
      type: 'feature',
      tags: ['bracket', 'prediction'],
      epicKey: 'FIFAGG-12573',
    });
  });

  it('never carries the assignee, whose name has no place in a payload that leaves the machine', () => {
    expect(JSON.stringify(readTicketWritingSpec({ metadata, index }))).not.toContain('Nils');
  });

  it('takes the first section of the index as the intent', () => {
    expect(readTicketWritingSpec({ metadata, index })?.intent).toBe('Vorhersage-Spiel auf einem Wettbewerb.');
  });

  it('takes the first section whatever the heading is called', () => {
    const renamed = index.replace('## Kurzfassung', '## Kurzbeschreibung');

    expect(readTicketWritingSpec({ metadata, index: renamed })?.intent).toBe('Vorhersage-Spiel auf einem Wettbewerb.');
  });

  it('caps an intent longer than a spec header should ever be', () => {
    const long = ['## Kurzfassung', '', 'x'.repeat(4000)].join('\n');

    expect(readTicketWritingSpec({ metadata, index: long })?.intent).toHaveLength(1200);
  });

  it('answers no intent for an index that has no section', () => {
    expect(readTicketWritingSpec({ metadata, index: '# Track\n\nNothing else.' })?.intent).toBeUndefined();
  });

  it('answers null for metadata that is not JSON', () => {
    expect(readTicketWritingSpec({ metadata: 'not json' })).toBeNull();
  });

  it('answers null for metadata that names no title', () => {
    expect(readTicketWritingSpec({ metadata: JSON.stringify({ type: 'feature' }) })).toBeNull();
  });
});

describe('touchedDirectories', () => {
  it('puts the directory the commits touched most first', () => {
    const ranked = touchedDirectories([
      'context/tracks/bracket/spec.md',
      'context/tracks/bracket/plan.md',
      'context/tracks/reward/spec.md',
    ]);

    expect(ranked[0]).toBe('context/tracks/bracket');
  });

  it('offers every parent as well, so a caller can climb to the one that holds a spec', () => {
    expect(touchedDirectories(['a/b/c/spec.md'])).toEqual(['a/b/c', 'a/b', 'a']);
  });

  it('drops a path that climbs out of the checkout', () => {
    expect(touchedDirectories(['../elsewhere/secret.md'])).toEqual([]);
  });

  it('answers nothing for a file at the root of the checkout', () => {
    expect(touchedDirectories(['README.md'])).toEqual([]);
  });
});
