import { describe, expect, it } from 'vitest';

import { formatCodex, latestCodexSample } from '../../content/mods/plugins/usage-line/hooks/codex';
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

const rolloutLine =
  '{"timestamp":"2026-11-26T23:05:10.437Z","ordinal":140,"type":"event_msg","payload":{"type":"token_count","info":null,"rate_limits":{"limit_id":"codex","limit_name":null,"primary":{"used_percent":100.0,"window_minutes":300,"resets_at":1795744510},"secondary":{"used_percent":28.0,"window_minutes":10080,"resets_at":1795843256},"credits":{"has_credits":false,"unlimited":false,"balance":null},"plan_type":"team"}}}';
const hhmm = (seconds: number) => {
  const date = new Date(seconds * 1000);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

describe('usage-line codex limit', () => {
  const text = `{"type":"other"}\n${rolloutLine}\nbroken {"rate_limits"\n`;

  it('marks an exhausted 5h window with its reset time and shows the week left', () => {
    const now = Date.parse('2026-11-27T00:35:00.000Z');
    expect(formatCodex(latestCodexSample(text), now)).toBe(`⛔ codex 5h 0% (${hhmm(1795744510)}) · wk 72%`);
  });

  it('counts a window past its reset as full again', () => {
    expect(formatCodex(latestCodexSample(text), 1_795_744_511_000)).toBe('codex 5h 100% · wk 72%');
  });

  it('shows nothing without a sample', () => {
    expect(formatCodex(latestCodexSample('{}'), 0)).toBeUndefined();
  });
});
