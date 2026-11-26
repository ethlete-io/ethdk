import { describe, expect, it } from 'vitest';
import { isNoVerdict, loadScaledMs, noVerdictLineOf, noVerdictOf } from './no-verdict';

describe('no verdict', () => {
  it('prints why a check could not run and asks for a retry, never a pass or a fail', () => {
    const result = noVerdictOf('the base did not draw');

    expect(isNoVerdict(result)).toBe(true);
    expect(isNoVerdict({ issues: [] })).toBe(false);
    expect(noVerdictLineOf('pages/sketches@all-states', result)).toBe(
      'pages/sketches@all-states: no verdict - the base did not draw, retry',
    );
  });

  it('stretches a timeout by the load over the cores, between once and eight times', () => {
    expect(loadScaledMs(120_000, { avg1: 6, cores: 12 })).toBe(120_000);
    expect(loadScaledMs(120_000, { avg1: 30, cores: 12 })).toBe(300_000);
    expect(loadScaledMs(120_000, { avg1: 200, cores: 12 })).toBe(960_000);
  });
});
