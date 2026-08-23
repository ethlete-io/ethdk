import { schedulerEditSurfaceTestDriver, testAppointment } from '../testing/scheduler-driver';

describe('SchedulerEditSurfaceDirective', () => {
  let driver: ReturnType<typeof schedulerEditSurfaceTestDriver>;

  beforeEach(() => {
    driver = schedulerEditSurfaceTestDriver();
  });

  it('drafts a copy of the opened appointment', () => {
    expect(driver.control.draft()).toEqual(testAppointment('a'));
  });

  it('has no ancestors or children for a standalone appointment', () => {
    expect(driver.control.ancestors()).toEqual([]);
    expect(driver.control.children()).toEqual([]);
  });

  it('builds the ancestor chain root-first', () => {
    driver.host.appointments.set([
      testAppointment('a'),
      testAppointment('b', { parentId: 'a' }),
      testAppointment('c', { parentId: 'b' }),
    ]);
    driver.host.appointment.set(testAppointment('c', { parentId: 'b' }));
    driver.detectChanges();

    expect(driver.control.ancestors().map((candidate) => candidate.id)).toEqual(['a', 'b']);
  });

  it('lists the current appointment direct children', () => {
    driver.host.appointments.set([
      testAppointment('a'),
      testAppointment('a1', { parentId: 'a' }),
      testAppointment('a2', { parentId: 'a' }),
    ]);
    driver.host.appointment.set(testAppointment('a'));
    driver.detectChanges();

    expect(driver.control.children().map((node) => node.appointment.id)).toEqual(['a1', 'a2']);
  });

  it('navigates to another known appointment and resets the draft, discarding unsaved edits', () => {
    driver.host.appointments.set([testAppointment('a'), testAppointment('b')]);
    driver.host.appointment.set(testAppointment('a'));
    driver.detectChanges();

    driver.control.draft.update((draft) => ({ ...draft, title: 'edited' }));
    driver.control.navigateTo('b');
    driver.detectChanges();

    expect(driver.control.currentAppointmentId()).toBe('b');
    expect(driver.control.draft().title).toBe('b');
  });

  it('keeps unsaved draft edits when appointments is replaced with new object identities', () => {
    driver.host.appointments.set([testAppointment('a'), testAppointment('b')]);
    driver.host.appointment.set(testAppointment('a'));
    driver.detectChanges();

    driver.control.draft.update((draft) => ({ ...draft, title: 'typed by the user' }));

    driver.host.appointments.set([testAppointment('a'), testAppointment('b')]);
    driver.detectChanges();

    expect(driver.control.draft().title).toBe('typed by the user');
  });

  it('starts a blank child of the current appointment and navigates to it', () => {
    driver.host.appointments.set([testAppointment('a')]);
    driver.host.appointment.set(testAppointment('a'));
    driver.detectChanges();

    driver.control.startAddSubAppointment();
    driver.detectChanges();

    const draft = driver.control.draft();
    expect(draft.parentId).toBe('a');
    expect(draft.title).toBe('');
    expect(driver.control.currentAppointmentId()).toBe(draft.id);
  });

  it('emits save with the current draft on commit', () => {
    driver.control.draft.update((draft) => ({ ...draft, title: 'renamed' }));
    driver.control.commit();
    driver.detectChanges();

    expect(driver.host.saved()).toEqual({ ...testAppointment('a'), title: 'renamed' });
  });

  it('emits deleteAppointments with the appointment and every descendant', () => {
    driver.host.appointments.set([
      testAppointment('a'),
      testAppointment('a1', { parentId: 'a' }),
      testAppointment('a1a', { parentId: 'a1' }),
      testAppointment('a2', { parentId: 'a' }),
    ]);
    driver.host.appointment.set(testAppointment('a'));
    driver.detectChanges();

    driver.control.requestDelete();
    driver.detectChanges();

    expect(driver.host.deleted()).toEqual(['a', 'a1', 'a1a', 'a2']);
  });

  it('falls back to just the current id when it has no matching tree node', () => {
    driver.control.requestDelete();
    driver.detectChanges();

    expect(driver.host.deleted()).toEqual(['a']);
  });
});
