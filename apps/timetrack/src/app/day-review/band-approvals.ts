import { computed } from '@angular/core';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { AUTO_MODE_CLIENT, AgentApproval, approvalRowIdsOf, formatDurationMs } from '@ethlete/timetrack';
import { injectApprovalQueue } from '../agent/approval-queue';
import { injectDayReview } from './day-review';
import { formatClockTime } from './format';

export type ApprovalLine = { label: string; value: string };

export const askerOf = (item: AgentApproval) => item.client ?? 'CLI';

/** The few words a band's inline chip says about the item it previews. */
export const approvalChipOf = (item: AgentApproval) => {
  const who = item.client === AUTO_MODE_CLIENT ? 'Auto' : askerOf(item);
  const { request } = item;

  switch (request.op) {
    case 'jira.create':
      return `${who} · File ${request.projectKey ?? 'a ticket'}`;
    case 'worklog.add':
      return `${who} · +${formatDurationMs(request.durationMs)} on ${request.issueKey}`;
    case 'autoMode.apply':
      return `${who} · Name ${request.issueKey}`;
    default:
      return `${who} · ${request.op}`;
  }
};

/** What an item changes, one field a line, for the edit surface of the row it previews on. */
export const approvalLinesOf = (item: AgentApproval): ApprovalLine[] => {
  const { request } = item;
  const asked = { label: 'Asked by', value: `${askerOf(item)} at ${formatClockTime(new Date(item.askedAtMs))}` };

  switch (request.op) {
    case 'jira.create':
      return [
        { label: 'New issue', value: request.summary },
        { label: 'Project', value: request.projectKey ?? 'the picked project' },
        ...(request.parentKey ? [{ label: 'Parent', value: request.parentKey }] : []),
        asked,
      ];
    case 'worklog.add': {
      const from = new Date(request.fromMs);
      const to = new Date(request.fromMs + request.durationMs);

      return [
        { label: 'Ticket', value: request.issueKey },
        { label: 'Span', value: `${formatClockTime(from)} – ${formatClockTime(to)}` },
        asked,
      ];
    }
    case 'autoMode.apply':
      return [{ label: 'Ticket', value: `${request.label} → ${request.issueKey}` }, asked];
    default:
      return [asked];
  }
};

export const approvalDescriptionOf = (item: AgentApproval) =>
  item.request.op === 'jira.create' || item.request.op === 'worklog.add' ? item.request.description : '';

/** The waiting approvals placed on the bands of the day in view, and those no band there previews. */
const BAND_APPROVALS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const queue = injectApprovalQueue();
  const store = injectDayReview();

  const placed = computed(() => {
    const day = store.dayKey();
    const rows = store.rows();
    const unattributed = store.deterministic()?.unattributed ?? [];
    const byRow = new Map<string, AgentApproval[]>();
    const unplaced: AgentApproval[] = [];

    for (const item of queue.waiting()) {
      const ids = approvalRowIdsOf({ item, day, rows, unattributed });

      if (!ids.length) unplaced.push(item);

      for (const id of ids) byRow.set(id, [...(byRow.get(id) ?? []), item]);
    }

    return { byRow, unplaced };
  });

  return {
    forRow: (rowId: string) => placed().byRow.get(rowId) ?? [],
    unplaced: computed(() => placed().unplaced),
  };
});

export const injectBandApprovals = /* @__PURE__ */ toInjectFn(BAND_APPROVALS_DEF);
