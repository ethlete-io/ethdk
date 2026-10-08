import { inject, inputBinding } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { injectReportError } from '../internals/report-error';
import { take, tap } from 'rxjs';
import {
  createOverlayOpener,
  createOverlaySingleSlot,
  OverlayOpenerOpenConfig,
  OverlayRef,
  OverlaySingleSlot,
} from '../overlay';
import { SCHEDULER_EDIT_SURFACE, SchedulerEditSurfaceResult } from './scheduler-edit-surface.token';
import { SCHEDULER_ERROR_CODES } from './scheduler-errors';
import { Appointment } from './scheduler.types';

export type SchedulerEditSurfaceOpenConfig<TExtra = unknown> = OverlayOpenerOpenConfig<
  SchedulerEditSurfaceResult<TExtra>
> & {
  /** The appointment to edit - a blank one with an `id` already assigned to add one. */
  appointment: Appointment<TExtra>;
  /** Every appointment the surface can navigate to. A function is read reactively while the surface is open. */
  appointments?: readonly Appointment<TExtra>[] | (() => readonly Appointment<TExtra>[]);
};

export type SchedulerEditSurfaceOpener<TExtra = unknown> = {
  /** Whether `provideSchedulerEditSurface()` is in scope, so the open calls open anything. */
  readonly available: boolean;
  /**
   * Opens the surface anchored to `origin` above `md`, full screen below it. Replaces a surface this
   * opener has open. Returns `null` without a registered surface, or while the open one is still
   * deciding whether to close.
   */
  openEdit: (
    config: SchedulerEditSurfaceOpenConfig<TExtra>,
  ) => OverlayRef<object, SchedulerEditSurfaceResult<TExtra>> | null;
  /** Like `openEdit`, as a centered dialog above `md` - for an appointment with nothing to anchor to. */
  openAdd: (
    config: SchedulerEditSurfaceOpenConfig<TExtra>,
  ) => OverlayRef<object, SchedulerEditSurfaceResult<TExtra>> | null;
  /** Closes the surface this opener has open, without a result. */
  close: () => void;
};

/**
 * Opens the edit surface registered with `provideSchedulerEditSurface()`, one at a time. What
 * `<et-scheduler>` opens its surface with; use it to open the same surface from a bare
 * `[etScheduler]` or from UI of your own.
 */
export const injectSchedulerEditSurfaceOpener = <TExtra = unknown>(): SchedulerEditSurfaceOpener<TExtra> => {
  const registration = inject(SCHEDULER_EDIT_SURFACE, { optional: true });
  const reportError = injectReportError();

  if (!registration) {
    const unavailable = () => {
      if (ngDevMode) {
        reportError(
          new RuntimeError(
            SCHEDULER_ERROR_CODES.EDIT_SURFACE_NOT_REGISTERED,
            '[Scheduler] An edit surface was requested without a registered one. Add provideSchedulerEditSurface() to a parent injector.',
          ),
        );
      }

      return null;
    };

    return { available: false, openEdit: unavailable, openAdd: unavailable, close: () => undefined };
  }

  const innerSlot = createOverlaySingleSlot();
  let current: OverlayRef | null = null;

  const slot: OverlaySingleSlot = {
    open: (openFn) =>
      innerSlot.open(() => {
        const ref = openFn();

        current = ref;
        ref
          ?.afterClosed()
          .pipe(
            take(1),
            tap(() => {
              if (current === ref) current = null;
            }),
          )
          .subscribe();

        return ref;
      }),
  };

  const editOpener = createOverlayOpener(registration.editOverlay, { single: slot });
  const addOpener = createOverlayOpener(registration.addOverlay, { single: slot });

  const toOpenConfig = ({ appointment, appointments = [], ...config }: SchedulerEditSurfaceOpenConfig<TExtra>) => {
    const readAppointments = typeof appointments === 'function' ? appointments : () => appointments;

    return {
      ...config,
      bindings: [
        inputBinding('appointment', () => appointment),
        inputBinding('appointments', readAppointments),
        ...(config.bindings ?? []),
      ],
    } as OverlayOpenerOpenConfig<SchedulerEditSurfaceResult>;
  };

  return {
    available: true,
    openEdit: (config) =>
      editOpener.open(toOpenConfig(config)) as OverlayRef<object, SchedulerEditSurfaceResult<TExtra>> | null,
    openAdd: (config) =>
      addOpener.open(toOpenConfig(config)) as OverlayRef<object, SchedulerEditSurfaceResult<TExtra>> | null,
    close: () => current?.close(),
  };
};
