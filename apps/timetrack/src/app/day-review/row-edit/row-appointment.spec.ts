import { ReviewedRow } from '@ethlete/timetrack';
import { EXCLUDED_THEME, appointmentLabel, appointmentOf, sharedMsByRow } from './row-appointment';

const rowOf = (overrides: Partial<ReviewedRow>) =>
  ({
    id: 'row-1',
    from: new Date('2026-01-05T09:00:00Z'),
    to: new Date('2026-01-05T10:00:00Z'),
    durationMs: 3_600_000,
    description: '',
    confidence: 'weak',
    state: 'pending',
    evidence: [],
    ...overrides,
  }) as ReviewedRow;

describe('appointmentOf colour', () => {
  it('paints an unattended row with no key in the muted theme', () => {
    const row = rowOf({ unattended: true, withheldIssueKey: 'ABC-1' });

    expect(appointmentOf({ row }).colorToken).toBe(EXCLUDED_THEME);
  });

  it('paints an unattended row the user has named by its confidence', () => {
    const row = rowOf({ unattended: true, issueKey: 'ABC-1', confidence: 'likely' });

    expect(appointmentOf({ row }).colorToken).toBe('brand');
  });

  it('still paints an unnamed attended row as a weak guess', () => {
    expect(appointmentOf({ row: rowOf({}) }).colorToken).toBe('warning');
  });

  it('paints an edited weak row with an issue as certain', () => {
    const row = rowOf({ edited: true, issueKey: 'ABC-1', confidence: 'weak' });

    expect(appointmentOf({ row }).colorToken).toBe(
      appointmentOf({ row: rowOf({ issueKey: 'ABC-1', confidence: 'certain' }) }).colorToken,
    );
    expect(appointmentOf({ row }).colorToken).not.toBe('warning');
  });
});

describe('appointmentLabel of parallel sessions', () => {
  it("reads each session's share out of what the ticket books over the span", () => {
    const at = (minute: number) => new Date(Date.UTC(2026, 0, 5, 17, minute));
    const session = (id: string, durationMs: number) =>
      rowOf({ id, from: at(15), to: at(60), durationMs, issueKey: 'ABC-1', laneKey: 'repo:/a' });
    const rows = [session('a', 900_000), session('b', 1_800_000)];
    const shared = sharedMsByRow(rows);

    expect(rows.map((row) => appointmentLabel(appointmentOf({ row, sharedMs: shared.get(row.id) })))).toEqual([
      'ABC-1 · 15m of 45m',
      'ABC-1 · 30m of 45m',
    ]);
  });

  it('reads a row alone on its ticket without a share', () => {
    const row = rowOf({ issueKey: 'ABC-1', laneKey: 'repo:/a' });

    expect(sharedMsByRow([row]).size).toBe(0);
    expect(appointmentLabel(appointmentOf({ row }))).toBe('ABC-1 · 1h 0m');
  });
});

describe('a row the reviewer said not to log', () => {
  it('paints in the muted theme, named or not', () => {
    expect(appointmentOf({ row: rowOf({ state: 'rejected' }) }).colorToken).toBe(EXCLUDED_THEME);
    expect(appointmentOf({ row: rowOf({ state: 'rejected', issueKey: 'ABC-1' }) }).colorToken).toBe(EXCLUDED_THEME);
  });

  it('reads as not logged instead of not yet named', () => {
    expect(appointmentLabel(appointmentOf({ row: rowOf({ state: 'rejected' }) }))).toBe('Not logged · 1h 0m');
  });

  it('keeps its issue and says it is not logged', () => {
    const row = rowOf({ state: 'rejected', issueKey: 'ABC-1' });

    expect(appointmentLabel(appointmentOf({ row }))).toBe('ABC-1 · 1h 0m · not logged');
  });
});

describe('a band nobody was at here that a paired machine saw a person for', () => {
  it('reads as worked on that machine', () => {
    const row = rowOf({ unattended: true, workedOn: 'MacBook' });

    expect(appointmentLabel(appointmentOf({ row }))).toBe('Worked on MacBook · 1h 0m');
  });

  it('keeps the key the day withheld', () => {
    const row = rowOf({ unattended: true, workedOn: 'MacBook', withheldIssueKey: 'ABC-1' });

    expect(appointmentLabel(appointmentOf({ row }))).toBe('Worked on MacBook · ABC-1 · 1h 0m');
  });

  it('names the machine on a row the user named', () => {
    const row = rowOf({ unattended: true, workedOn: 'MacBook', issueKey: 'ABC-1' });

    expect(appointmentLabel(appointmentOf({ row }))).toBe('ABC-1 · 1h 0m · worked on MacBook');
  });
});
