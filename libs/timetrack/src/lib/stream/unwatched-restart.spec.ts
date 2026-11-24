import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { mergeWindows } from '../model/time-window';
import { streamDay } from './stream-day';
import captured from './unwatched-restart.fixture.json';

const APP = '/home/human/dev/app-a';
const FIRST_PROMPT = new Date('2026-11-24T08:31:00Z');
const LAST_PROMPT = new Date('2026-11-24T10:03:00Z');
const RESTART = new Date('2026-11-24T10:21:21.297Z');

const events = captured.events.map((event) => ({ ...event, at: new Date(event.at) }) as unknown as CollectedEvent);

const rowsOf = (now?: Date) => {
  const day = streamDay({ events, options: { repoRoots: [APP], minBreakMs: 15 * 60_000, now } });

  return [...day.rows.proposals, ...day.rows.unnamed].map((row) => ({
    from: row.from,
    to: row.to,
    unattended: 'unattended' in row && !!row.unattended,
  }));
};

describe('prompts typed while the app was down, captured 2026-11-24', () => {
  describe.each([
    ['the settled day', undefined],
    ['the live day after the restart', new Date('2026-11-24T10:30:00Z')],
  ])('%s', (_, now) => {
    const rows = rowsOf(now);

    it('books the prompted stretch as attended work', () => {
      const attended = mergeWindows(rows.filter((row) => !row.unattended));

      expect(attended.some((window) => window.from <= FIRST_PROMPT && window.to >= LAST_PROMPT)).toBe(true);
      expect(rows.some((row) => row.unattended && row.from < LAST_PROMPT && row.to > FIRST_PROMPT)).toBe(false);
    });

    it('keeps the night before the first prompt unattended', () => {
      const night = new Date('2026-11-24T03:00:00Z');

      expect(rows.some((row) => row.unattended && row.from <= night && row.to > night)).toBe(true);
      expect(rows.every((row) => row.to <= RESTART)).toBe(true);
    });
  });
});
