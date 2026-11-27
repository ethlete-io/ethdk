import { describe, expect, it } from 'vitest';

// @ts-expect-error TS7016: the skill script is plain .mjs shipped without declarations
import { formatStatus, limitStatus, parseRateLimitLine } from '../../content/skills/codex-subagent/codex-limit.mjs';

const line =
  '{"timestamp":"2026-11-26T23:05:10.437Z","ordinal":140,"type":"event_msg","payload":{"type":"token_count","info":null,"rate_limits":{"limit_id":"codex","limit_name":null,"primary":{"used_percent":100.0,"window_minutes":300,"resets_at":1795744510},"secondary":{"used_percent":28.0,"window_minutes":10080,"resets_at":1795843256},"credits":{"has_credits":false,"unlimited":false,"balance":null},"plan_type":"team"}}}';
const beforeReset = Date.parse('2026-11-27T00:35:00.000Z');
const afterReset = 1_795_744_511_000;

describe('codex-limit', () => {
  it('reads the windows out of a real rollout token_count line', () => {
    const sample = parseRateLimitLine(line);
    expect(sample?.primary.used_percent).toBe(100);
    expect(sample?.secondary.resets_at).toBe(1795843256);
  });

  it('ignores lines without codex rate limits', () => {
    expect(parseRateLimitLine('{"type":"event_msg"}')).toBeUndefined();
    expect(parseRateLimitLine('{"rate_limits": broken')).toBeUndefined();
    expect(parseRateLimitLine(line.replace('"limit_id":"codex"', '"limit_id":"other"'))).toBeUndefined();
  });

  it('is exhausted while the 5h window is full, with the week left', () => {
    const status = limitStatus(parseRateLimitLine(line), beforeReset);
    expect(status?.exhausted).toBe(true);
    expect(status?.fiveHour?.leftPercent).toBe(0);
    expect(status?.week?.leftPercent).toBe(72);
    expect(formatStatus(status as never, beforeReset)).toContain('verdict: exhausted');
  });

  it('counts a window past its reset as full again', () => {
    const status = limitStatus(parseRateLimitLine(line), afterReset);
    expect(status?.exhausted).toBe(false);
    expect(status?.fiveHour?.leftPercent).toBe(100);
    expect(formatStatus(status as never, afterReset)).toContain('verdict: ok');
  });
});
