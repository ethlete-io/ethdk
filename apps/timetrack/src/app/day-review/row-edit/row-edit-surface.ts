import { inputBinding, signal } from '@angular/core';
import {
  Appointment,
  SCHEDULER_ADD_SURFACE_OVERLAY,
  SCHEDULER_EDIT_SURFACE_OVERLAY,
  SchedulerEditSurfaceResult,
  createOverlayOpener,
} from '@ethlete/components';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { ReviewedRow, syncsInState } from '@ethlete/timetrack';
import { injectDayReview } from '../day-review';
import { EditDurationDirective } from './edit-duration.component';
import { EditEvidenceDirective } from './edit-evidence.component';
import { EditIssueDirective } from './edit-issue.component';
import { EditMeetingDirective } from './edit-meeting.component';
import { EditStateDirective } from './edit-state.component';
import { RowActionsDirective } from './row-actions.directive';
import { appointmentOf, rowEntryOf } from './row-appointment';

const DISABLED = { enabled: false } as const;

/** What the surface was opened for: a band of the day, or a range drawn on empty grid. */
type Pending = { kind: 'row'; row: ReviewedRow } | { kind: 'draft' };

/**
 * The day's rows are edited on the scheduler's own edit surface, not in a list beside it.
 *
 * The surface brings the anchored dialog, the story breadcrumb, the action menu and save/cancel; what
 * this adds is the four things a worklog has and an appointment does not — the issue, the rounded
 * duration, whether a sync writes the row, and the evidence behind it. Each is a field the surface
 * stamps, reached through the open call's `directives` because the surface has no template of ours.
 *
 * The built-in title, location and colour fields are switched off: the issue field writes the title
 * itself, and neither a place nor a colour is something a worklog carries.
 */
const ROW_EDIT_SURFACE_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const store = injectDayReview();

  /** What the open surface is editing, so its result knows whether to change a row or add one. */
  const pending = signal<Pending | null>(null);

  const editRow = (row: ReviewedRow, appointment: Appointment) => {
    const entry = rowEntryOf(appointment);
    const issueKey = appointment.title.trim().toUpperCase();
    const description = appointment.description ?? '';

    if (issueKey !== (row.issueKey ?? '')) store.setIssue(row, issueKey);
    if (description !== row.description) store.setDescription(row, description);
    if (entry && entry.durationMs !== row.durationMs) store.setDuration(row, entry.durationMs);
    if (entry && entry.willSync !== syncsInState(row.state)) {
      store.setState(row, entry.willSync ? 'accepted' : 'rejected');
    }
    if (appointment.start.getTime() !== row.from.getTime() || appointment.end.getTime() !== row.to.getTime()) {
      store.rescheduleRow({ row, from: appointment.start, to: appointment.end });
    }
  };

  const addRow = (appointment: Appointment) => {
    const issueKey = appointment.title.trim().toUpperCase();

    if (!issueKey || appointment.end <= appointment.start) return;

    store.addRow({
      issueKey,
      description: appointment.description ?? '',
      from: appointment.start,
      to: appointment.end,
    });
  };

  const applyResult = (result: SchedulerEditSurfaceResult | null) => {
    const open = pending();

    pending.set(null);

    if (!open || result?.kind !== 'save') return;

    if (open.kind === 'row') editRow(open.row, result.appointment);
    else addRow(result.appointment);
  };

  const rowOpener = createOverlayOpener(SCHEDULER_EDIT_SURFACE_OVERLAY, { afterClosed: applyResult });
  const draftOpener = createOverlayOpener(SCHEDULER_ADD_SURFACE_OVERLAY, { afterClosed: applyResult });

  /** The appointment under edit, and every built-in the surface bundles that a worklog cannot use. */
  const surfaceBindings = (appointment: Appointment, appointments: readonly Appointment[]) => [
    inputBinding('appointment', () => appointment),
    inputBinding('appointments', () => appointments),
    inputBinding('etSchedulerEditTitle', () => DISABLED),
    inputBinding('etSchedulerEditLocation', () => DISABLED),
    inputBinding('etSchedulerEditColor', () => DISABLED),
    inputBinding('etSchedulerActionAddSubAppointment', () => DISABLED),
    inputBinding('etSchedulerActionDelete', () => DISABLED),
  ];

  return {
    /** Opens the surface over the band that was pressed. */
    openRow: (options: { row: ReviewedRow; origin: HTMLElement; appointments: readonly Appointment[] }) => {
      pending.set({ kind: 'row', row: options.row });

      rowOpener.open({
        origin: options.origin,
        bindings: surfaceBindings(appointmentOf({ row: options.row }), options.appointments),
        directives: [
          EditIssueDirective,
          EditStateDirective,
          EditDurationDirective,
          EditEvidenceDirective,
          RowActionsDirective,
        ],
      });
    },

    /**
     * Opens the surface for a range drawn on empty grid, which is the ask for a row nothing observed.
     * There is no duration field: a hand-written row logs the span it was drawn over.
     */
    openDraft: (range: { from: Date; to: Date }) => {
      pending.set({ kind: 'draft' });

      draftOpener.open({
        bindings: surfaceBindings({ id: 'draft', parentId: null, title: '', start: range.from, end: range.to }, []),
        directives: [EditIssueDirective, EditMeetingDirective],
      });
    },
  };
});

export const injectRowEditSurface = /* @__PURE__ */ toInjectFn(ROW_EDIT_SURFACE_DEF);
