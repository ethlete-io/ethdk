import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import captured from './cherry-picked-commits.fixture.json';
import { streamDay } from './stream-day';

const SDK = '/home/human/dev/ethlete-sdk';
const CLIENT = '/home/human/dev/client-app';

const events = captured.events.map((event) => ({ ...event, at: new Date(event.at) }) as unknown as CollectedEvent);

const committed = (() => {
  const day = streamDay({ events, options: { repoRoots: [SDK, CLIENT] } });

  return [...day.rows.proposals, ...day.rows.unnamed].flatMap((row) =>
    row.evidence.flatMap((entry) => (entry.kind === 'commit' ? [entry.detail.slice(8)] : [])),
  );
})();

describe('a day of cherry-picks between worktrees, captured 2026-11-21', () => {
  it('books each change once, however many shas carry it', () => {
    expect(committed.length).toBeGreaterThan(0);
    expect(committed.filter((subject, index) => committed.indexOf(subject) !== index)).toEqual([]);
  });
});
