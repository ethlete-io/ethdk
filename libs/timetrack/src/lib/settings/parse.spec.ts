import { describe, expect, it } from 'vitest';
import { DEFAULT_DAY_TARGET_MS, MAX_DAY_TARGET_MS, MIN_DAY_TARGET_MS } from './model';
import { parseTimetrackSettings } from './parse';

describe('parseTimetrackSettings', () => {
  it('reads a document the app wrote', () => {
    const settings = parseTimetrackSettings({
      dayTargetMs: 7 * 60 * 60_000,
      jira: { host: 'ethlete.atlassian.net', email: 'trb@braune-digital.com' },
      exclusionRules: [{ kind: 'title-pattern', pattern: 'therapy' }],
      keepDefaultExclusionRules: false,
      gitScanRoots: ['/home/tom/dev'],
    });

    expect(settings).toEqual({
      dayTargetMs: 7 * 60 * 60_000,
      jira: { host: 'ethlete.atlassian.net', email: 'trb@braune-digital.com' },
      exclusionRules: [{ kind: 'title-pattern', pattern: 'therapy' }],
      keepDefaultExclusionRules: false,
      gitScanRoots: ['/home/tom/dev'],
    });
  });

  it('falls back to the defaults for anything it cannot make sense of', () => {
    expect(parseTimetrackSettings(null)).toEqual({
      dayTargetMs: DEFAULT_DAY_TARGET_MS,
      jira: { host: '', email: '' },
      exclusionRules: [],
      keepDefaultExclusionRules: true,
      gitScanRoots: [],
    });
    expect(parseTimetrackSettings({ dayTargetMs: 'eight hours' }).dayTargetMs).toBe(DEFAULT_DAY_TARGET_MS);
  });

  it('clamps a day target nobody could work', () => {
    expect(parseTimetrackSettings({ dayTargetMs: 0 }).dayTargetMs).toBe(MIN_DAY_TARGET_MS);
    expect(parseTimetrackSettings({ dayTargetMs: 40 * 60 * 60_000 }).dayTargetMs).toBe(MAX_DAY_TARGET_MS);
  });

  it('drops a rule with no value but keeps one whose pattern does not compile', () => {
    const settings = parseTimetrackSettings({
      exclusionRules: [
        { kind: 'app-id', appId: '' },
        { kind: 'app-id' },
        { kind: 'nonsense', appId: 'firefox' },
        { kind: 'title-pattern', pattern: '(' },
      ],
    });

    expect(settings.exclusionRules).toEqual([{ kind: 'title-pattern', pattern: '(' }]);
  });

  it('trims and de-duplicates the scan roots', () => {
    expect(parseTimetrackSettings({ gitScanRoots: [' /home/tom/dev ', '/home/tom/dev', '', 7] }).gitScanRoots).toEqual([
      '/home/tom/dev',
    ]);
  });

  it('keeps the shipped rules unless the document says otherwise', () => {
    expect(parseTimetrackSettings({}).keepDefaultExclusionRules).toBe(true);
    expect(parseTimetrackSettings({ keepDefaultExclusionRules: false }).keepDefaultExclusionRules).toBe(false);
  });
});
