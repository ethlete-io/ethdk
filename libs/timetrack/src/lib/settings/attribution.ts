import { GitFlowConfig, resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { AttributionRule } from '../correlate/rules';
import { TimetrackSettings } from './model';

/**
 * The branch grammar the pipeline reads a day with. Only the project keys come from settings: the rest
 * of the grammar belongs to the repositories being watched, not to this machine, and a user who has to
 * describe a branch shape before the app collects anything would never get past the settings screen.
 *
 * Setting the keys is what makes a false key impossible. Without them anything shaped like one counts,
 * so a repository that names a branch `chore/angular-22` logs time against issue ANGULAR-22.
 */
export const gitFlowConfigFor = (settings: TimetrackSettings): GitFlowConfig =>
  resolveGitFlowConfig({ keyPrefixes: settings.issueKeyPrefixes });

/**
 * What makes two rules the same statement. A rule about a context replaces the rule that was there
 * rather than sitting beside it: two rules naming one context with two issues would leave which one
 * wins to their creation order, and the user would have no way to see which had.
 */
const targetOf = (rule: Pick<AttributionRule, 'repoPath' | 'branch' | 'appId'>) =>
  rule.repoPath ? `repo:${rule.repoPath}@${rule.branch ?? ''}` : `app:${rule.appId ?? ''}`;

/** Puts a rule into the settings, replacing whatever named the same context before. */
export const withAttributionRule = (options: {
  settings: TimetrackSettings;
  rule: AttributionRule;
}): TimetrackSettings => {
  const { settings, rule } = options;
  const target = targetOf(rule);

  return {
    ...settings,
    attributionRules: [...settings.attributionRules.filter((entry) => targetOf(entry) !== target), rule],
  };
};

export const withoutAttributionRule = (options: { settings: TimetrackSettings; id: string }): TimetrackSettings => ({
  ...options.settings,
  attributionRules: options.settings.attributionRules.filter((entry) => entry.id !== options.id),
});
