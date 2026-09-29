import { ReviewedRow } from '@ethlete/timetrack';
import { EXCLUDED_THEME, appointmentOf } from './row-appointment';

const rowOf = (overrides: Partial<ReviewedRow>) =>
  ({
    id: 'row-1',
    from: new Date('2026-01-05T09:00:00Z'),
    to: new Date('2026-01-05T10:00:00Z'),
    durationMs: 3_600_000,
    description: '',
    confidence: 'weak',
    state: 'pending',
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
});
