import { DEFAULT_GIT_FLOW_CONFIG, GitFlowConfig, parseBranch } from '@ethlete/agent-rules/git-flow';
import { CollectedEvent, MergeRequestActivityEvent } from '../model/event';
import { IssueActivity, issueKeyInText } from './attribute';
import { ReviewedMergeRequest } from './reviewed-merge-request';

const isMergeRequestActivity = (event: CollectedEvent): event is MergeRequestActivityEvent =>
  event.kind === 'merge-request-activity';

const detailOf = (event: MergeRequestActivityEvent) => {
  const mergeRequest = event.mergeRequestIid ? `!${event.mergeRequestIid}` : 'a merge request';
  const project = event.projectPath ? ` in ${event.projectPath}` : '';

  return `you ${event.action} ${mergeRequest}${project} on \`${event.branch}\``;
};

/**
 * The merge-request rung of the attribution ladder, read out of the day's own stored events.
 *
 * The issue comes from the merge request's source branch through the same grammar a local checkout is
 * read with, so reviewing `sub/feat/FIP-2177-…/FIP-2178-…` lands on the Task being reviewed. That is
 * the whole point of the collector: review time has no ticket of its own and no local trace either.
 *
 * A branch that names no issue falls back to the first issue key the merge request's title or
 * description quotes, which is the user's own wording too. A merge request that names one nowhere
 * produces nothing: guessing from a project or a summary is what the reasoning provider is for.
 */
export const mergeRequestActivity = (options: {
  events: readonly CollectedEvent[];
  config?: GitFlowConfig;
}): IssueActivity[] => {
  const config = options.config ?? DEFAULT_GIT_FLOW_CONFIG;

  return options.events.filter(isMergeRequestActivity).flatMap((event): IssueActivity | [] => {
    if (!event.branch) return [];

    const issueKey =
      parseBranch({ branch: event.branch, config }).issueKey ??
      issueKeyInText({ text: [event.title, event.description].filter(Boolean).join('\n'), config });

    if (!issueKey) return [];

    return {
      kind: 'merge-request',
      issueKey,
      at: event.at,
      branch: event.branch,
      detail: detailOf(event),
      summary: event.title,
    };
  });
};

/**
 * The day's merge requests whose changed directories a checkout here could read, joined with what the
 * user did on them. See `reviewedMergeRequestOver`.
 */
export const reviewedMergeRequests = (options: {
  events: readonly CollectedEvent[];
  config?: GitFlowConfig;
}): ReviewedMergeRequest[] => {
  const config = options.config ?? DEFAULT_GIT_FLOW_CONFIG;
  const referenceOf = (projectPath: string, iid: string) => `${projectPath}!${iid}`;
  const activity = new Map<string, MergeRequestActivityEvent[]>();

  for (const event of options.events) {
    if (!isMergeRequestActivity(event) || !event.projectPath || !event.mergeRequestIid) continue;

    const key = referenceOf(event.projectPath, event.mergeRequestIid);

    activity.set(key, [...(activity.get(key) ?? []), event]);
  }

  const reviewed = new Map<string, ReviewedMergeRequest>();

  for (const event of options.events) {
    if (event.kind !== 'merge-request-changes') continue;

    const reference = referenceOf(event.projectPath, event.mergeRequestIid);
    const key = `${event.repoPath}\u001f${reference}`;
    const known = reviewed.get(key);

    if (known) {
      reviewed.set(key, {
        ...known,
        directories: [...new Set([...known.directories, ...event.directories])].sort(),
      });
      continue;
    }

    const forge = activity.get(reference) ?? [];
    const title = forge.find((entry) => entry.title)?.title;
    const issueKey = forge
      .map(
        (entry) =>
          (entry.branch ? parseBranch({ branch: entry.branch, config }).issueKey : undefined) ??
          issueKeyInText({ text: [entry.title, entry.description].filter(Boolean).join('\n'), config }),
      )
      .find((found) => !!found);

    reviewed.set(key, {
      repoPath: event.repoPath,
      reference: `!${event.mergeRequestIid}`,
      projectPath: event.projectPath,
      branch: event.branch,
      ...(title ? { title } : {}),
      ...(issueKey ? { issueKey } : {}),
      directories: [...event.directories].sort(),
      activity: forge.map((entry) => ({ at: entry.at, action: entry.action })),
    });
  }

  return [...reviewed.values()];
};
