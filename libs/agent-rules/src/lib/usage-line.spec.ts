import { describe, expect, it } from 'vitest';

import { formatUsage, statusTextOf } from '../../content/mods/plugins/usage-line/hooks/format';

const resetsAt = '2026-11-27T00:40:00.000Z';
const local = new Date(resetsAt);
const clock = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;

describe('usage-line formatting', () => {
  it('shows the reset time of the 5 hour window when known', () => {
    expect(
      formatUsage([
        { kind: 'five_hour', percentUsed: 36, resetsAt },
        { kind: 'seven_day', percentUsed: 42 },
      ]),
    ).toBe(`5h 36% bis ${clock} · Woche 42%`);
  });

  it('omits the reset time when unknown and marks a missing window', () => {
    expect(formatUsage([{ kind: 'five_hour', percentUsed: 7.5 }])).toBe('5h 7.5% · Woche ?%');
    expect(formatUsage([{ kind: 'five_hour', percentUsed: 7, resetsAt: 'nope' }])).toBe('5h 7% · Woche ?%');
  });

  it('shows nothing without a subscription window', () => {
    expect(formatUsage([])).toBeUndefined();
  });

  it('draws the usage as the plain status line text, after a command line when one exists', () => {
    expect(statusTextOf(null, '5h 7% · Woche 9%')).toBe('5h 7% · Woche 9%');
    expect(statusTextOf('main', '5h 7% · Woche 9%')).toBe('main · 5h 7% · Woche 9%');
    expect(statusTextOf('main', null)).toBe('main');
  });
});
