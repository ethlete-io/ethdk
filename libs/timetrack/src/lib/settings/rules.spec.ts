import { describe, expect, it } from 'vitest';
import { DEFAULT_EXCLUSION_RULES } from '../store/exclusion';
import { DEFAULT_TIMETRACK_SETTINGS, TimetrackSettings } from './model';
import { effectiveExclusionRules } from './rules';

const settingsWith = (patch: Partial<TimetrackSettings>): TimetrackSettings => ({
  ...DEFAULT_TIMETRACK_SETTINGS,
  ...patch,
});

describe('effectiveExclusionRules', () => {
  it('keeps the shipped defaults beside the user rules', () => {
    const rules = effectiveExclusionRules(settingsWith({ exclusionRules: [{ kind: 'app-id', appId: 'signal' }] }));

    expect(rules).toHaveLength(DEFAULT_EXCLUSION_RULES.length + 1);
    expect(rules).toContainEqual({ kind: 'app-id', appId: 'signal' });
  });

  it('drops the defaults only when they were turned off', () => {
    expect(
      effectiveExclusionRules(
        settingsWith({ keepDefaultExclusionRules: false, exclusionRules: [{ kind: 'app-id', appId: 'signal' }] }),
      ),
    ).toEqual([{ kind: 'app-id', appId: 'signal' }]);
  });

  it('folds a user rule that repeats a default into one', () => {
    const rules = effectiveExclusionRules(
      settingsWith({ exclusionRules: [{ kind: 'app-id', appId: 'ORG.KEEPASSXC.KEEPASSXC' }] }),
    );

    expect(rules).toHaveLength(DEFAULT_EXCLUSION_RULES.length);
  });
});
