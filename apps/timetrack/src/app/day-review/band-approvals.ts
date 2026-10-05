import { computed, signal } from '@angular/core';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  AUTO_MODE_CLIENT,
  AgentApproval,
  approvalRowIdsOf,
  autoModeTargetOf,
  disputedTargetLabel,
  formatDurationMs,
  localDayKey,
} from '@ethlete/timetrack';
import { injectApprovalQueue } from '../agent/approval-queue';
import { injectTimetrackSettings } from '../settings/settings';
import { injectDayReview } from './day-review';

export { askerOf, approvalIssueKeysOf, approvalLinesOf } from './approval-lines';
export type { ApprovalLine } from './approval-lines';
import { askerOf } from './approval-lines';

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
      return `${who} · Name ${request.issueKey}${request.done ? ' (done)' : ''}${request.parent ? ' (parent)' : ''}`;
    case 'standIn.resolve':
      return `${who} · Resolve to ${request.issueKey}`;
    case 'autoMode.resolve':
      return `${who} · ${request.choice === 'keep' ? `Keep ${request.booked}` : `Use ${disputedTargetLabel(request.other)}`}`;
    case 'autoMode.hide':
      return `${who} · Hide, off topic`;
    default:
      return `${who} · ${request.op}`;
  }
};

/** A `worklog.add` no row of the day holds yet, drawn where the row it adds would land. */
export type ApprovalPreview = { item: AgentApproval; from: Date; to: Date };

export const approvalDescriptionOf = (item: AgentApproval) =>
  item.request.op === 'jira.create' || item.request.op === 'worklog.add' ? item.request.description : '';

/**
 * The waiting approvals placed on the bands of the day in view, the `worklog.add`s that land on it on
 * no band yet, and those the day in view shows nowhere.
 */
const BAND_APPROVALS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const queue = injectApprovalQueue();
  const store = injectDayReview();
  const settings = injectTimetrackSettings();

  const placed = computed(() => {
    const day = store.dayKey();
    const rows = store.rows();
    const unattributed = store.deterministic()?.unattributed ?? [];
    const byRow = new Map<string, AgentApproval[]>();
    const previews: ApprovalPreview[] = [];
    const unplaced: AgentApproval[] = [];
    const first = new Map<string, string>();

    for (const item of queue.waiting()) {
      const { request } = item;
      const ids = approvalRowIdsOf({ item, day, rows, unattributed, standIns: settings.settings().standIns });

      const earliest = rows
        .filter((row) => ids.includes(row.id))
        .sort((a, b) => a.from.getTime() - b.from.getTime())[0];

      if (earliest) first.set(item.id, earliest.id);

      for (const id of ids) byRow.set(id, [...(byRow.get(id) ?? []), item]);

      if (ids.length) continue;

      if (request.op === 'worklog.add' && localDayKey(new Date(request.fromMs), store.boundary()) === day) {
        previews.push({ item, from: new Date(request.fromMs), to: new Date(request.fromMs + request.durationMs) });
      } else {
        unplaced.push(item);
      }
    }

    return { byRow, previews, unplaced, first };
  });

  const revealing = signal<{ itemId: string; day: string } | null>(null);

  const dayOf = (item: AgentApproval) => {
    const { request } = item;

    switch (request.op) {
      case 'autoMode.apply':
      case 'autoMode.hide':
      case 'autoMode.resolve':
        return request.day;
      case 'worklog.add':
        return localDayKey(new Date(request.fromMs), store.boundary());
      case 'jira.create': {
        const target = autoModeTargetOf(item.target);

        return target?.subject.kind === 'context' ? target.day : null;
      }
      default:
        return null;
    }
  };

  return {
    /** The earliest band of the day in view the item previews on, or null when it touches none. */
    firstRowOf: (itemId: string) => placed().first.get(itemId) ?? null,
    /** The day other than the one in view whose bands the item is for, or null. */
    otherDayOf: (item: AgentApproval) => {
      const day = dayOf(item);

      return day && day !== store.dayKey() ? day : null;
    },
    revealing: revealing.asReadonly(),
    /** Opens the item's band once the day in view draws it. Call it after the day is set. */
    reveal: (itemId: string) => revealing.set({ itemId, day: store.dayKey() }),
    revealed: () => revealing.set(null),
    forRow: (rowId: string) => placed().byRow.get(rowId) ?? [],
    previews: computed(() => placed().previews),
    unplaced: computed(() => placed().unplaced),
  };
});

export const injectBandApprovals = /* @__PURE__ */ toInjectFn(BAND_APPROVALS_DEF);
