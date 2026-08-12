import { DEFAULT_EXCLUSION_RULES, TimetrackExclusionRule } from '../store/exclusion';
import { TimetrackSettings } from './model';

const keyOf = (rule: TimetrackExclusionRule) =>
  rule.kind === 'app-id' ? `app-id:${rule.appId.toLowerCase()}` : `title-pattern:${rule.pattern}`;

/**
 * The rules collection actually runs with: the shipped defaults unless they were turned off, plus the
 * user's own. A user rule that repeats a default is folded into one, so an exclusion is never reported
 * twice for the same reason.
 */
export const effectiveExclusionRules = (settings: TimetrackSettings): TimetrackExclusionRule[] => {
  const all = [...(settings.keepDefaultExclusionRules ? DEFAULT_EXCLUSION_RULES : []), ...settings.exclusionRules];
  const seen = new Set<string>();

  return all.filter((rule) => {
    const key = keyOf(rule);

    if (seen.has(key)) return false;

    seen.add(key);

    return true;
  });
};
