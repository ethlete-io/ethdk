import { AgentApproval, disputedTargetLabel } from '@ethlete/timetrack';
import { formatClockTime } from './format';

export type ApprovalLine = { label: string; value: string };

export const askerOf = (item: AgentApproval) => item.client ?? 'CLI';

/** The issue keys an item names, so their summaries can be read before its lines are drawn. */
export const approvalIssueKeysOf = (item: AgentApproval): string[] => {
  const { request } = item;

  switch (request.op) {
    case 'jira.create':
      return request.parentKey ? [request.parentKey] : [];
    case 'worklog.add':
    case 'autoMode.apply':
    case 'standIn.resolve':
      return [request.issueKey];
    default:
      return [];
  }
};

/** What an item changes, one field a line, for the edit surface of the row it previews on. */
export const approvalLinesOf = (
  item: AgentApproval,
  summaryOf: (issueKey: string) => string | undefined = () => undefined,
): ApprovalLine[] => {
  const { request } = item;
  const named = (issueKey: string) => `${issueKey} ${summaryOf(issueKey) ?? ''}`.trim();
  const asked = { label: 'Asked by', value: `${askerOf(item)} at ${formatClockTime(new Date(item.askedAtMs))}` };

  switch (request.op) {
    case 'jira.create':
      return [
        { label: 'New issue', value: request.summary },
        { label: 'Project', value: request.projectKey ?? 'the picked project' },
        ...(request.parentKey ? [{ label: 'Parent', value: named(request.parentKey) }] : []),
        asked,
      ];
    case 'worklog.add': {
      const from = new Date(request.fromMs);
      const to = new Date(request.fromMs + request.durationMs);

      return [
        { label: 'Ticket', value: named(request.issueKey) },
        { label: 'Span', value: `${formatClockTime(from)} – ${formatClockTime(to)}` },
        asked,
      ];
    }
    case 'autoMode.apply':
      return [
        {
          label: 'Ticket',
          value: `${request.label} → ${named(request.issueKey)}${request.done ? ' (done)' : ''}${request.parent ? ' (parent)' : ''}`,
        },
        asked,
      ];
    case 'standIn.resolve':
      return [
        {
          label: 'Ticket',
          value: `${request.name ?? request.id}: ${request.fromIssueKey ? `${request.fromIssueKey} → ` : ''}${`${request.issueKey} ${request.summary ?? summaryOf(request.issueKey) ?? ''}`.trim()}`,
        },
        asked,
      ];
    case 'autoMode.resolve':
      return [
        {
          label: 'Dispute',
          value:
            request.choice === 'keep'
              ? `Keep ${request.booked}`
              : `${request.booked} → ${disputedTargetLabel(request.other)}`,
        },
        { label: 'Why', value: request.reason },
        asked,
      ];
    case 'autoMode.hide':
      return [
        {
          label: 'Hide',
          value: `The rest of ${request.label || 'the call'} from ${formatClockTime(new Date(request.fromMs))}`,
        },
        asked,
      ];
    default:
      return [asked];
  }
};
