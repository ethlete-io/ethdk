import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Appointment } from '../scheduler.types';
import { SchedulerEditSurfaceDirective } from './scheduler-edit-surface.directive';

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
class SchedulerEditSurfaceTestHostComponent {
  appointment = signal<Appointment>(appointment('a'));
  appointments = signal<Appointment[]>([]);
  saved = signal<Appointment | null>(null);
  deleted = signal<readonly string[] | null>(null);
}

const appointment = (id: string, parentId: string | null = null): Appointment => ({
  id,
  parentId,
  title: id,
  start: new Date(2026, 6, 15, 9),
  end: new Date(2026, 6, 15, 10),
});

describe('SchedulerEditSurfaceDirective', () => {
  let fixture: ComponentFixture<SchedulerEditSurfaceTestHostComponent>;
  let host: SchedulerEditSurfaceTestHostComponent;
  let directive: SchedulerEditSurfaceDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SchedulerEditSurfaceTestHostComponent] });
    fixture = TestBed.createComponent(SchedulerEditSurfaceTestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    directive = fixture.debugElement.children[0].injector.get(SchedulerEditSurfaceDirective);
  });

  it('drafts a copy of the opened appointment', () => {
    expect(directive.draft()).toEqual(appointment('a'));
  });

  it('has no ancestors or children for a standalone appointment', () => {
    expect(directive.ancestors()).toEqual([]);
    expect(directive.children()).toEqual([]);
  });

  it('builds the ancestor chain root-first', () => {
    host.appointments.set([appointment('a'), appointment('b', 'a'), appointment('c', 'b')]);
    host.appointment.set(appointment('c', 'b'));
    fixture.detectChanges();

    expect(directive.ancestors().map((candidate) => candidate.id)).toEqual(['a', 'b']);
  });

  it('lists the current appointment direct children', () => {
    host.appointments.set([appointment('a'), appointment('a1', 'a'), appointment('a2', 'a')]);
    host.appointment.set(appointment('a'));
    fixture.detectChanges();

    expect(directive.children().map((node) => node.appointment.id)).toEqual(['a1', 'a2']);
  });

  it('navigates to another known appointment and resets the draft, discarding unsaved edits', () => {
    host.appointments.set([appointment('a'), appointment('b')]);
    host.appointment.set(appointment('a'));
    fixture.detectChanges();

    directive.draft.update((draft) => ({ ...draft, title: 'edited' }));
    directive.navigateTo('b');
    fixture.detectChanges();

    expect(directive.currentAppointmentId()).toBe('b');
    expect(directive.draft().title).toBe('b');
  });

  it('keeps unsaved draft edits when appointments is replaced with new object identities', () => {
    host.appointments.set([appointment('a'), appointment('b')]);
    host.appointment.set(appointment('a'));
    fixture.detectChanges();

    directive.draft.update((draft) => ({ ...draft, title: 'typed by the user' }));

    host.appointments.set([appointment('a'), appointment('b')]);
    fixture.detectChanges();

    expect(directive.draft().title).toBe('typed by the user');
  });

  it('starts a blank child of the current appointment and navigates to it', () => {
    host.appointments.set([appointment('a')]);
    host.appointment.set(appointment('a'));
    fixture.detectChanges();

    directive.startAddSubAppointment();
    fixture.detectChanges();

    const draft = directive.draft();
    expect(draft.parentId).toBe('a');
    expect(draft.title).toBe('');
    expect(directive.currentAppointmentId()).toBe(draft.id);
  });

  it('emits save with the current draft on commit', () => {
    directive.draft.update((draft) => ({ ...draft, title: 'renamed' }));
    directive.commit();
    fixture.detectChanges();

    expect(host.saved()).toEqual({ ...appointment('a'), title: 'renamed' });
  });

  it('emits deleteAppointments with the appointment and every descendant', () => {
    host.appointments.set([appointment('a'), appointment('a1', 'a'), appointment('a1a', 'a1'), appointment('a2', 'a')]);
    host.appointment.set(appointment('a'));
    fixture.detectChanges();

    directive.requestDelete();
    fixture.detectChanges();

    expect(host.deleted()).toEqual(['a', 'a1', 'a1a', 'a2']);
  });

  it('falls back to just the current id when it has no matching tree node', () => {
    directive.requestDelete();
    fixture.detectChanges();

    expect(host.deleted()).toEqual(['a']);
  });
});
