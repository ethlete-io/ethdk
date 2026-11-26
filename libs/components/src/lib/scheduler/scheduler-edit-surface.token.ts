import { Appointment, AppointmentId } from './scheduler.types';

/** What an edit surface closes with: the saved draft, or every id to delete. */
export type SchedulerEditSurfaceResult<TExtra = unknown> =
  { kind: 'save'; appointment: Appointment<TExtra> } | { kind: 'delete'; ids: readonly AppointmentId[] };
