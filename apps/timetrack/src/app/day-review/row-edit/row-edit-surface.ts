import { Appointment, injectSchedulerEditSurfaceOpener } from '@ethlete/components';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { ReviewedRow, syncsInState } from '@ethlete/timetrack';
import { injectDayReview } from '../day-review';
import { TimelineEntry, appointmentOf, rowEntryOf } from './row-appointment';

/**
 * The day's rows are edited on the scheduler's edit surface, not in a list beside it: an anchored
 * dialog over the band, with `RowEditSurfaceComponent` as its content. Register it with
 * `provideSchedulerEditSurface({ component: RowEditSurfaceComponent })`.
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

  const editSurface = injectSchedulerEditSurfaceOpener<TimelineEntry>();

  return {
    /** Opens the surface over the band that was pressed. */
    openRow: (options: {
      row: ReviewedRow;
      origin: HTMLElement;
      appointments: readonly Appointment<TimelineEntry>[];
    }) => {
      editSurface.openEdit({
        afterClosed: (result) => {
          if (result?.kind === 'save') editRow(options.row, result.appointment);
        },
        origin: options.origin,
        appointment: appointmentOf({ row: options.row }),
        appointments: options.appointments,
      });
    },

    /**
     * Opens the surface for a range drawn on empty grid, which is the ask for a row nothing observed.
     * The when field shows no duration: a hand-written row logs the span it was drawn over.
     *
     * `laneKey` is the column the range was drawn in, and the row is kept there. Leave it out where
     * the reviewer had no column in front of them, so the row lands beside the work nothing placed.
     */
    openDraft: (range: { from: Date; to: Date; laneKey?: string }) => {
      editSurface.openAdd({
        afterClosed: (result) => {
          if (result?.kind === 'save') addRow(result.appointment, range.laneKey);
        },
        appointment: { id: 'draft', parentId: null, title: '', start: range.from, end: range.to },
      });
    },
  };
});

export const injectRowEditSurface = /* @__PURE__ */ toInjectFn(ROW_EDIT_SURFACE_DEF);
