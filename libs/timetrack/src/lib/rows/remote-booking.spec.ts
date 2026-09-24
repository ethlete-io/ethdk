import { describe, expect, it } from 'vitest';
import { bookedSpanMs, remoteBookingOnGrid, unbookedRemoteByRow } from './remote-booking';

const MINUTE = 60_000;
const at = (minute: number) => new Date(2026, 8, 24, 0, minute);
const span = (from: number, to: number) => ({ from: at(from), to: at(to) });
const row = (id: string, from: number, to: number, extra: { laneKey?: string; issueKey?: string } = {}) => ({
  id,
  ...span(from, to),
  ...extra,
});

const REMOTE = { drawn: [span(600, 780)], booked: [{ ...span(600, 660), laneKey: 'repo:/phone' }] };

const bookedMs = (rows: ReturnType<typeof row>[], remote = REMOTE) => {
  const unbooked = unbookedRemoteByRow({ rows, remote });

  return rows.map((entry, index) => bookedSpanMs(entry, unbooked[index]) / MINUTE);
};

describe('unbookedRemoteByRow', () => {
  it('books the allowance only on the row in the lane of the prompt that bought it', () => {
    const rows = [
      row('desk', 600, 780, { laneKey: 'repo:/desk', issueKey: 'ET-1' }),
      row('phone', 600, 780, { laneKey: 'repo:/phone', issueKey: 'ET-2' }),
    ];

    expect(bookedMs(rows)).toEqual([0, 60]);
  });

  it('leaves the allowance unbooked where the lane of its prompt holds no row over it', () => {
    const rows = [
      row('desk', 600, 780, { laneKey: 'repo:/desk', issueKey: 'ET-1' }),
      row('phone', 630, 780, { laneKey: 'repo:/phone', issueKey: 'ET-2' }),
    ];

    expect(bookedMs(rows)).toEqual([0, 30]);
  });

  it('books it on one row when no row is in that lane: a named one, then the lowest lane key', () => {
    const rows = [
      row('unnamed', 600, 780, { laneKey: 'repo:/a' }),
      row('later-lane', 600, 780, { laneKey: 'repo:/c', issueKey: 'ET-3' }),
      row('first-lane', 600, 780, { laneKey: 'repo:/b', issueKey: 'ET-4' }),
    ];
    const remote = { ...REMOTE, booked: [{ ...span(600, 660), laneKey: 'repo:/gone' }] };

    expect(bookedMs(rows, remote)).toEqual([0, 0, 60]);
  });
});

describe('remoteBookingOnGrid', () => {
  it('never lets rounding book more than the cap', () => {
    const remote = remoteBookingOnGrid({
      drawn: [span(600, 780)],
      booked: [span(607, 623), span(637, 653), span(667, 683)],
      maxBookedMs: 60 * MINUTE,
    });

    expect(remote.booked.reduce((sum, part) => sum + part.to.getTime() - part.from.getTime(), 0)).toBe(60 * MINUTE);
  });
});
