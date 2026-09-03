import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { injectOverlayManager } from '../overlay';
import { expectAriaGrid, expectUniformCellsPerRow } from '../testing/aria-structure';
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

  it('ignores an open request for an appointment it does not know', () => {
    driver.openEditSurface('nope');

    expect(driver.host.selectedAppointmentId()).toBeNull();
    expect(driver.editSurface()).toHaveLength(0);
  });

  it('requires the default edit surface to be registered before opening an appointment', () => {
    const readOnlyDriver = schedulerTestDriver({ appointments: [testAppointment('a')], editSurface: false });

    expect(() => readOnlyDriver.openEditSurface('a')).toThrow('ET4505');

    readOnlyDriver.fixture.destroy();
  });

  it('renders the default badge adornments for a visible appointment', () => {
    const badge = driver.badges().find((candidate) => candidate.id === 'a');

    expect(badge).toBeDefined();
    expect(badge?.title).toBe('a');
    expect(badge?.timeRange).toBe('09:00–10:00');
  });

  it('places a visible appointment inside its month cell', () => {
    const cell = driver.cellFor(testAppointment('a').start);

    expect(cell).not.toBeNull();
    expect(cell?.querySelector('[title="a"]')).not.toBeNull();
  });

  it('opens the edit surface when a rendered appointment badge is clicked', () => {
    const button = driver.clickAppointment('a');

    expect(button).not.toBeNull();
    expect(driver.editSurface()).toHaveLength(1);
  });
});
