import { inputBinding } from '@angular/core';
import {
  Appointment,
  SCHEDULER_ADD_SURFACE_OVERLAY,
  SCHEDULER_EDIT_SURFACE_OVERLAY,
  createOverlayOpener,
  createOverlaySingleSlot,
} from '@ethlete/components';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { ReviewedRow, syncsInState } from '@ethlete/timetrack';
import { injectDayReview } from '../day-review';
import { EditDurationDirective } from './edit-duration.component';
import { EditEvidenceDirective } from './edit-evidence.component';
import { EditIssueDirective } from './edit-issue.component';
import { EditMeetingDirective } from './edit-meeting.component';
import { EditStandInWaitingDirective } from './edit-stand-in-waiting.component';
import { EditStandInDirective } from './edit-stand-in.component';
import { EditDisputedDirective } from './edit-disputed.component';
import { EditUnattendedDirective } from './edit-unattended.component';
import { EditStateDirective } from './edit-state.component';
import { RowActionsDirective } from './row-actions.directive';
import { appointmentOf, rowEntryOf } from './row-appointment';

const DISABLED = { enabled: false } as const;

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

  const editRow = (row: ReviewedRow, appointment: Appointment) => {
    const entry = rowEntryOf(appointment);
    const issueKey = appointment.title.trim().toUpperCase();
    const description = appointment.description ?? '';

    if (issueKey !== (row.issueKey ?? '')) store.setIssue(row, issueKey);
    if (description !== row.description) store.setDescription(row, description);
    if (entry && entry.willSync !== syncsInState(row.state)) {
      store.setState(row, entry.willSync ? 'accepted' : 'rejected');
    }
    if (appointment.start.getTime() !== row.from.getTime() || appointment.end.getTime() !== row.to.getTime()) {
      store.rescheduleRow({ row, from: appointment.start, to: appointment.end });
    }
  };

  const addRow = (appointment: Appointment, laneKey?: string) => {
    const issueKey = appointment.title.trim().toUpperCase();

    if (!issueKey || appointment.end <= appointment.start) return;

    store.addRow({
      issueKey,
      description: appointment.description ?? '',
      from: appointment.start,
      to: appointment.end,
      laneKey,
    });
  };

  const surfaceSlot = createOverlaySingleSlot();
  const rowOpener = createOverlayOpener(SCHEDULER_EDIT_SURFACE_OVERLAY, { single: surfaceSlot });
  const draftOpener = createOverlayOpener(SCHEDULER_ADD_SURFACE_OVERLAY, { single: surfaceSlot });

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
      rowOpener.open({
        afterClosed: (result) => {
          if (result?.kind === 'save') editRow(options.row, result.appointment);
        },
        origin: options.origin,
        bindings: surfaceBindings(appointmentOf({ row: options.row }), options.appointments),
        directives: [
          EditStandInWaitingDirective,
          EditUnattendedDirective,
          EditDisputedDirective,
          EditIssueDirective,
          EditStandInDirective,
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
     *
     * `laneKey` is the column the range was drawn in, and the row is kept there. Leave it out where
     * the reviewer had no column in front of them, so the row lands beside the work nothing placed.
     */
    openDraft: (range: { from: Date; to: Date; laneKey?: string }) => {
      draftOpener.open({
        afterClosed: (result) => {
          if (result?.kind === 'save') addRow(result.appointment, range.laneKey);
        },
        bindings: surfaceBindings({ id: 'draft', parentId: null, title: '', start: range.from, end: range.to }, []),
        directives: [EditIssueDirective, EditMeetingDirective],
      });
    },
  };
});

export const injectRowEditSurface = /* @__PURE__ */ toInjectFn(ROW_EDIT_SURFACE_DEF);
