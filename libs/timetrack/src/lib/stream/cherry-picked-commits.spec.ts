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

  it('keeps a row for a change whose main checkout copy a worktree copy tied with on author time', () => {
    expect(committed).toContain('fix(app): Change 9');
  });

  it('keeps every change in a row that a row holds when no copy is recognised as one', () => {
    const unrecognised = events.map((event) =>
      event.kind === 'git-commit'
        ? { ...event, subject: `${event.subject}#${event.repoPath}#${event.sha}`, patchId: undefined }
        : event,
    );
    const everyCopy = streamDay({ events: unrecognised, options: { repoRoots: [SDK, CLIENT] } });
    const held = [...everyCopy.rows.proposals, ...everyCopy.rows.unnamed].flatMap((row) =>
      row.evidence.flatMap((entry) => (entry.kind === 'commit' ? [entry.detail.slice(8).split('#')[0]] : [])),
    );

    expect(held).toEqual(expect.arrayContaining(['fix(app): Change 17', 'fix(app): Change 19', 'fix(app): Change 20']));
    expect(new Set(committed)).toEqual(new Set(held));
  });
});
