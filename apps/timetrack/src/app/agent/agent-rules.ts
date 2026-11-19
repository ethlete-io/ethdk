import { AgentApiAttributionRule, AttributionRule, issueKeyOf, standInIdOf } from '@ethlete/timetrack';

export const toApiAttributionRule = (rule: AttributionRule): AgentApiAttributionRule => ({
  id: rule.id,
  repoPath: rule.repoPath,
  branch: rule.branch,
  appId: rule.appId,
  day: rule.day,
  issueKey: issueKeyOf(rule),
  standInId: standInIdOf(rule),
  donates: rule.target.kind === 'donate',
  createdAtMs: rule.createdAt.getTime(),
});
