import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import captured from './agent-work-before-first-presence.fixture.json';
import { streamDay } from './stream-day';

const SDK = '/home/human/dev/ethlete-sdk';
const CLIENT = '/home/human/dev/client-app';
const FIRST_PRESENCE = new Date('2026-11-21T00:20:01.196Z');
const CLIENT_COMMIT = new Date('2026-11-21T00:07:23.000Z');
const SDK_COMMIT = new Date('2026-11-20T23:01:10.000Z');

const events = captured.events.map((event) => ({ ...event, at: new Date(event.at) }) as unknown as CollectedEvent);

const rows = (() => {
  const day = streamDay({ events, options: { repoRoots: [SDK, CLIENT] } });

  return [...day.rows.proposals, ...day.rows.unnamed].map((row) => ({
    from: row.from,
    to: row.to,
    laneKey: row.laneKey,
    unattended: 'unattended' in row && !!row.unattended,
    commits: row.evidence.flatMap((entry) => (entry.kind === 'commit' ? [entry.at.getTime()] : [])),
  }));
})();

const holding = (at: Date) => rows.filter((row) => row.commits.includes(at.getTime()));

describe('a day whose first hours only agents worked, captured 2026-11-21', () => {
  it('draws unattended rows for the agent work before the first presence', () => {
    const before = rows.filter((row) => row.from < FIRST_PRESENCE);

    expect(before.length).toBeGreaterThan(0);
    expect(before.filter((row) => row.to <= FIRST_PRESENCE).every((row) => row.unattended)).toBe(true);
    expect(new Set(before.map((row) => row.laneKey))).toEqual(new Set([`repo:${SDK}`, `repo:${CLIENT}`]));
  });

  it('attaches the night commits to those rows, not to the first attended one', () => {
    expect(holding(SDK_COMMIT).length).toBeGreaterThan(0);
    expect(holding(CLIENT_COMMIT).length).toBeGreaterThan(0);
    expect(
      rows
        .filter((row) => row.commits.some((at) => at < FIRST_PRESENCE.getTime()))
        .every((row) => row.unattended && row.from < FIRST_PRESENCE),
    ).toBe(true);
  });
});
