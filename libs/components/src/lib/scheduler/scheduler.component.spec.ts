import { ErrorHandler, getDebugNode } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { de } from 'date-fns/locale';
import { provideDateLocale } from '../forms/date-time/date-time-formats';
import { injectOverlayManager } from '../overlay';
import { expectAriaGrid, expectUniformCellsPerRow } from '../testing/aria-structure';
import { SchedulerEditSurfaceComponent } from './scheduler-edit-surface.component';
import { schedulerTestDriver, testAppointment } from './testing/scheduler-driver';

describe('SchedulerComponent', () => {
  let driver: ReturnType<typeof schedulerTestDriver>;

  beforeEach(() => {
    driver = schedulerTestDriver({ appointments: [testAppointment('a'), testAppointment('b')] });
  });

  afterEach(() => {
    for (const overlay of TestBed.runInInjectionContext(() => injectOverlayManager()).openOverlays()) {
      overlay.close();
    }

    driver.fixture.destroy();
  });

  it('opens the edit surface once for a selected appointment', () => {
    driver.host.selectedAppointmentId.set('a');
    driver.detectChanges();

    expect(driver.editSurface()).toHaveLength(1);
  });

  it('does not stack a second surface when appointments is replaced with new object identities', () => {
    driver.host.selectedAppointmentId.set('a');
    driver.detectChanges();

    driver.host.appointments.set([testAppointment('a'), testAppointment('b')]);
    driver.detectChanges();

    expect(driver.editSurface()).toHaveLength(1);
  });

  it('selects an appointment without opening the edit surface', () => {
    driver.selectAppointment('a');

    expect(driver.host.selectedAppointmentId()).toBe('a');
    expect(driver.editSurface()).toHaveLength(0);
  });

  it('opens the edit surface for an appointment selected without one', () => {
    driver.selectAppointment('a');
    driver.openEditSurface('a');

    expect(driver.editSurface()).toHaveLength(1);
  });

  it('keeps the same time grid when switching between week and day', () => {
    driver.host.view.set('week');
    driver.detectChanges();
    const weekGrid = driver.query('et-scheduler-time-grid-view');

    driver.host.view.set('day');
    driver.detectChanges();

    expect(driver.query('et-scheduler-time-grid-view')).toBe(weekGrid);
  });

  describe('edit surface actions', () => {
    const surface = () => getDebugNode(driver.editSurface()[0])?.componentInstance as SchedulerEditSurfaceComponent;
    const actionIcons = () =>
      surface()
        .appointmentActions()
        .map((action) => action.icon);

    it('offers adding a sub-appointment and deleting for a saved appointment', () => {
      driver.openEditSurface('a');

      expect(actionIcons()).toEqual(['et-plus', 'et-trash']);
    });

    it('offers neither for an added appointment nobody saved', () => {
      driver.scheduler().addAppointment();
      driver.detectChanges();

      expect(actionIcons()).toEqual([]);
    });

    it('offers neither for a sub-appointment nobody saved', () => {
      driver.openEditSurface('a');
      surface().surface.startAddSubAppointment();
      driver.detectChanges();

      expect(actionIcons()).toEqual([]);
    });
  });

  it('exposes the month view as a grid that owns its rows', () => {
    const view = driver.query('et-scheduler-month-view');

    expect(view).not.toBeNull();
    expectAriaGrid(view!);
    expectUniformCellsPerRow(view!);
  });

  it('exposes the time grid as a grid whose day cells sit in a row', () => {
    driver.host.view.set('week');
    driver.detectChanges();

    const view = driver.query('et-scheduler-time-grid-view');

    expect(view).not.toBeNull();
    expectAriaGrid(view!);
  });

  it('gives each hour of the time grid its own row owning one slot per day', () => {
    driver.host.view.set('week');
    driver.detectChanges();

    const view = driver.query('et-scheduler-time-grid-view')!;
    const body = view.querySelector('.et-scheduler-time-grid-body')!;
    const rows = [...body.querySelectorAll(':scope > [role="row"]')];

    expect(body.getAttribute('role')).toBe('rowgroup');
    expect(rows).toHaveLength(24);

    for (const row of rows) {
      const owned = row.getAttribute('aria-owns')!.split(' ');

      expect(owned).toHaveLength(7);

      for (const id of owned) {
        expect(view.querySelector(`#${id}`)?.getAttribute('role')).toBe('gridcell');
      }
    }

    expect(new Set(rows.flatMap((row) => row.getAttribute('aria-owns')!.split(' '))).size).toBe(168);
    expectAriaGrid(view);
  });

  it('formats times and the day header in the locale, so a 24-hour locale shows 24-hour times', () => {
    driver = schedulerTestDriver({
      view: 'day',
      appointments: [testAppointment('a')],
      providers: [provideDateLocale(de)],
    });

    expect(driver.badges()[0]?.timeRange).toBe('09:00–10:00');
    expect(driver.query('.et-scheduler-header-label')?.textContent?.trim()).toBe('Mittwoch, 15. Juli 2026');
  });

  it('names each grid view after the period the header shows', () => {
    const headerLabel = () => driver.query('.et-scheduler-header-label')?.textContent?.trim();

    expect(headerLabel()).toBeTruthy();
    expect(driver.query('et-scheduler-month-view')?.getAttribute('aria-label')).toBe(headerLabel());

    driver.host.view.set('week');
    driver.detectChanges();

    expect(driver.query('et-scheduler-time-grid-view')?.getAttribute('aria-label')).toBe(headerLabel());

    driver.host.view.set('day');
    driver.detectChanges();

    expect(driver.query('et-scheduler-time-grid-view')?.getAttribute('aria-label')).toBe(headerLabel());
  });

  it('opens the edit surface on a click on an appointment selectAppointment() highlighted', () => {
    driver.selectAppointment('a');
    driver.clickAppointment('a');

    expect(driver.editSurface()).toHaveLength(1);
  });

  it('keeps the selection and the close handle of a surface that opened while another one closes', () => {
    driver.clickAppointment('a');
    driver.clickAppointment('b');
    driver.detectChanges();

    const [first] = TestBed.runInInjectionContext(() => injectOverlayManager()).openOverlays();

    first?.close();
    driver.detectChanges();

    expect(driver.host.selectedAppointmentId()).toBe('b');

    driver.scheduler().closeEditSurface();
    driver.detectChanges();

    expect(driver.host.selectedAppointmentId()).toBeNull();
  });

  it('ignores an open request for an appointment it does not know', () => {
    driver.openEditSurface('nope');

    expect(driver.host.selectedAppointmentId()).toBeNull();
    expect(driver.editSurface()).toHaveLength(0);
  });

  it('reports an open request while no default edit surface is registered', () => {
    const readOnlyDriver = schedulerTestDriver({ appointments: [testAppointment('a')], editSurface: false });
    const handleError = vi.spyOn(TestBed.inject(ErrorHandler), 'handleError').mockImplementation(() => undefined);

    expect(() => readOnlyDriver.openEditSurface('a')).not.toThrow();
    expect(String(handleError.mock.calls[0]?.[0])).toContain('ET4505');
    expect(readOnlyDriver.editSurface()).toHaveLength(0);

    readOnlyDriver.fixture.destroy();
  });

  it('renders the default badge adornments for a visible appointment', () => {
    const badge = driver.badges().find((candidate) => candidate.id === 'a');

    expect(badge).toBeDefined();
    expect(badge?.title).toBe('a');
    expect(badge?.timeRange).toBe('9:00 AM–10:00 AM');
  });

  it('places a visible appointment inside its month cell', () => {
    const cell = driver.cellFor(testAppointment('a').start);

    expect(cell).not.toBeNull();
    expect(cell?.querySelector('[title="a"]')).not.toBeNull();
  });

  it('announces the full date of a month day cell, not the bare day number', () => {
    const cell = driver.cellFor(testAppointment('a').start);

    expect(cell?.querySelector('.et-scheduler-month-view-cell-date')?.getAttribute('aria-hidden')).toBe('true');
    expect(cell?.querySelector('.et-scheduler-month-view-cell-label')?.textContent?.trim()).toBe(
      'Wednesday, July 15th, 2026',
    );
  });

  it('marks only the month cell of today with aria-current="date"', () => {
    driver.host.focusedDate.set(new Date());
    driver.detectChanges();

    const current = driver.queryAll('.et-scheduler-month-view-cell[aria-current]');

    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute('aria-current')).toBe('date');
    expect(current[0]?.hasAttribute('data-today')).toBe(true);
  });

  it('opens the edit surface when a rendered appointment badge is clicked', () => {
    const button = driver.clickAppointment('a');

    expect(button).not.toBeNull();
    expect(driver.editSurface()).toHaveLength(1);
  });

  it('shades the time outside business hours in the week view', () => {
    const businessDriver = schedulerTestDriver({
      view: 'week',
      businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }],
    });

    const shadesPerDay = businessDriver
      .queryAll('.et-scheduler-time-grid-day')
      .map((day) => day.querySelectorAll('.et-scheduler-time-grid-non-business').length);

    expect(shadesPerDay).toEqual([2, 2, 2, 2, 2, 1, 1]);
    expect(
      businessDriver
        .query('.et-scheduler-time-grid-non-business')
        ?.style.getPropertyValue('--_et-scheduler-time-grid-block-span'),
    ).toBe('37.5');

    businessDriver.fixture.destroy();
  });

  it('shades nothing without business hours', () => {
    const plainDriver = schedulerTestDriver({ view: 'week' });

    expect(plainDriver.queryAll('.et-scheduler-time-grid-non-business')).toHaveLength(0);

    plainDriver.fixture.destroy();
  });

  it('draws the now line on today and drops it when the now indicator is turned off', () => {
    const nowDriver = schedulerTestDriver({ view: 'day', focusedDate: new Date() });

    expect(nowDriver.queryAll('.et-scheduler-time-grid-now')).toHaveLength(1);

    nowDriver.host.nowIndicator.set(false);
    nowDriver.detectChanges();

    expect(nowDriver.queryAll('.et-scheduler-time-grid-now')).toHaveLength(0);

    nowDriver.fixture.destroy();
  });
});
