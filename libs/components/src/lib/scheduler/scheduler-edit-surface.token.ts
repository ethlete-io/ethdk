import { InjectionToken } from '@angular/core';
import { OverlayDefinition } from '../overlay';
import { Appointment, AppointmentId } from './scheduler.types';

export type SchedulerEditSurfaceResult =
  { kind: 'save'; appointment: Appointment } | { kind: 'delete'; ids: readonly AppointmentId[] };

export type SchedulerEditSurfaceRegistration = {
  editOverlay: OverlayDefinition<object, SchedulerEditSurfaceResult>;
  addOverlay: OverlayDefinition<object, SchedulerEditSurfaceResult>;
};

export const SCHEDULER_EDIT_SURFACE = new InjectionToken<SchedulerEditSurfaceRegistration>('SchedulerEditSurface');
