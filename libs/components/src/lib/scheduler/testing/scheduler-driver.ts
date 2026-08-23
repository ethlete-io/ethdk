import { Component, inject, InjectionToken, Provider, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createControlDriver, mountControl } from '../../testing/control-driver';
import { hostDirective, query, queryAll, textOf, tick } from '../../testing/driver-core';
import { SchedulerEditSurfaceDirective } from '../headless/scheduler-edit-surface.directive';
import { SchedulerComponent } from '../scheduler.component';
import { Appointment, AppointmentId, SchedulerView } from '../scheduler.types';

/** An appointment whose `title` equals its `id`, so a DOM lookup keyed on either agrees with the other. */
export const testAppointment = (id: AppointmentId, overrides: Partial<Appointment> = {}): Appointment => ({
  id,
  parentId: null,
  title: id,
  start: new Date(2026, 6, 15, 9),
  end: new Date(2026, 6, 15, 10),
  ...overrides,
});

export type SchedulerTestDriverOptions = {
  appointments?: readonly Appointment[];
  view?: SchedulerView;
  selectedAppointmentId?: AppointmentId | null;
  focusedDate?: Date;
  providers?: Provider[];
};

const SCHEDULER_TEST_OPTIONS = new InjectionToken<SchedulerTestDriverOptions>('SCHEDULER_TEST_OPTIONS');

@Component({
  template: `
    <et-scheduler
      [(selectedAppointmentId)]="selectedAppointmentId"
      [appointments]="appointments()"
      [view]="view()"
      [focusedDate]="focusedDate()"
    />
  `,
  imports: [SchedulerComponent],
})
class SchedulerTestHost {
  private options = inject(SCHEDULER_TEST_OPTIONS);

  public readonly appointments = signal(this.options.appointments ?? []);
  public readonly view = signal(this.options.view ?? 'month');
  public readonly selectedAppointmentId = signal(this.options.selectedAppointmentId ?? null);
  public readonly focusedDate = signal(this.options.focusedDate ?? testAppointment('_').start);
}

/**
 * Mounts `<et-scheduler>` and adds the vocabulary its specs need on top of a plain fixture: the
 * rendered badge per appointment (`badges`), a view's cell for a date (`cellFor`), clicking a
 * rendered appointment by id (`clickAppointment`), and the edit surface(s) currently open
 * (`editSurface`).
 */
export const schedulerTestDriver = (options: SchedulerTestDriverOptions = {}) => {
  TestBed.resetTestingModule();

  const fixture = mountControl(SchedulerTestHost, [
    ...(options.providers ?? []),
    { provide: SCHEDULER_TEST_OPTIONS, useValue: options },
  ]);

  const host = fixture.componentInstance;
  const scheduler = () => hostDirective(fixture, SchedulerComponent);

  return {
    fixture,
    host,
    scheduler,
    detectChanges: () => fixture.detectChanges(),

    query: <E extends Element = HTMLElement>(selector: string) => query<E>(fixture, selector),
    queryAll: <E extends Element = HTMLElement>(selector: string) => queryAll<E>(fixture, selector),

    /** The imperative `selectAppointment` path - selecting without opening the edit surface. */
    selectAppointment: (id: AppointmentId | null) => {
      scheduler().selectAppointment(id);
      fixture.detectChanges();
    },

    openEditSurface: (id: AppointmentId) => {
      scheduler().openEditSurface(id);
      fixture.detectChanges();
    },

    badges: () =>
      queryAll(fixture, '.et-scheduler-appointment, .et-scheduler-time-grid-block').map((element) => ({
        element,
        id: element.getAttribute('title'),
        title: textOf(element.querySelector('.et-scheduler-appointment-title')),
        timeRange: textOf(element.querySelector('.et-scheduler-appointment-time-range')),
        location: textOf(element.querySelector('.et-scheduler-appointment-location-text')),
        chainCount: textOf(element.querySelector('.et-scheduler-appointment-chain-count')),
      })),

    /**
     * The month cell for `date`, or the time grid's day column when the view is `week` - never an
     * outside-month cell, since those can carry the same day-of-month number as a cell actually in
     * the displayed month.
     */
    cellFor: (date: Date) => {
      if (host.view() === 'week') {
        const headerDates = queryAll(fixture, '.et-scheduler-time-grid-header-date');
        const index = headerDates.findIndex((element) => textOf(element) === String(date.getDate()));

        return index === -1 ? null : (queryAll(fixture, '.et-scheduler-time-grid-day')[index] ?? null);
      }

      return (
        queryAll(fixture, '.et-scheduler-month-view-cell').find(
          (cell) =>
            !cell.hasAttribute('data-outside-month') &&
            textOf(cell.querySelector('.et-scheduler-month-view-cell-date')) === String(date.getDate()),
        ) ?? null
      );
    },

    /** Clicks the rendered badge/block for `id` - present in every view via `[attr.title]`. */
    clickAppointment: (id: AppointmentId) => {
      const element = query(
        fixture,
        `.et-scheduler-appointment[title="${id}"], .et-scheduler-time-grid-block[title="${id}"]`,
      );

      element?.click();
      tick();

      return element;
    },

    /** The edit surface(s) currently rendered - a portal into the document, not the fixture. */
    editSurface: () => Array.from(document.querySelectorAll<HTMLElement>('et-scheduler-edit-surface')),
  };
};

export type SchedulerEditSurfaceTestDriverOptions = {
  appointment?: Appointment;
  appointments?: readonly Appointment[];
};

const SCHEDULER_EDIT_SURFACE_TEST_OPTIONS = new InjectionToken<SchedulerEditSurfaceTestDriverOptions>(
  'SCHEDULER_EDIT_SURFACE_TEST_OPTIONS',
);

@Component({
  template: `
    <div
      #surface="etSchedulerEditSurface"
      [appointment]="appointment()"
      [appointments]="appointments()"
      (save)="saved.set($event)"
      (deleteAppointments)="deleted.set($event)"
      etSchedulerEditSurface
    ></div>
  `,
  imports: [SchedulerEditSurfaceDirective],
})
class SchedulerEditSurfaceTestHost {
  private options = inject(SCHEDULER_EDIT_SURFACE_TEST_OPTIONS);

  public readonly appointment = signal(this.options.appointment ?? testAppointment('a'));
  public readonly appointments = signal(this.options.appointments ?? []);
  public readonly saved = signal<Appointment | null>(null);
  public readonly deleted = signal<readonly AppointmentId[] | null>(null);
}

/** Mounts a bare `etSchedulerEditSurface` host and hands back the directive plus its `save`/`deleteAppointments` signals. */
export const schedulerEditSurfaceTestDriver = (options: SchedulerEditSurfaceTestDriverOptions = {}) => {
  TestBed.resetTestingModule();

  const fixture = mountControl(SchedulerEditSurfaceTestHost, [
    { provide: SCHEDULER_EDIT_SURFACE_TEST_OPTIONS, useValue: options },
  ]);

  return createControlDriver(fixture, SchedulerEditSurfaceDirective);
};
