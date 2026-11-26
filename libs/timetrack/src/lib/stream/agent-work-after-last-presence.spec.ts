import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import captured from './agent-work-after-last-presence.fixture.json';
import { streamDay } from './stream-day';

const SDK = '/home/human/dev/ethlete-sdk';
const CLIENT = '/home/human/dev/client-app';
const LAST_PRESENCE = new Date('2026-10-22T21:22:04.702Z');

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

describe('a day whose last hour only agents worked, captured 2026-10-22', () => {
  it('draws unattended rows for the agent work after the last presence', () => {
    const after = rows.filter((row) => row.to > LAST_PRESENCE);

    expect(after.some((row) => row.laneKey === `repo:${SDK}`)).toBe(true);
    expect(after.every((row) => row.unattended)).toBe(true);
  });

  it('attaches the late commits to those rows, not to the last attended one', () => {
    const late = rows.filter((row) => row.commits.some((at) => at > LAST_PRESENCE.getTime()));

    expect(late.length).toBeGreaterThan(0);
    expect(late.every((row) => row.unattended && row.to > LAST_PRESENCE)).toBe(true);
  });
});
