import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Appointment } from '../scheduler.types';
import { SchedulerAgendaDirective } from './scheduler-agenda.directive';
import { SchedulerDirective } from './scheduler.directive';

@Component({
  template: `
    <div
      [focusedDate]="focusedDate()"
      [appointments]="appointments()"
      [view]="view()"
      [agendaDays]="agendaDays()"
      [firstDayOfWeek]="1"
      etScheduler
    >
      <div #agenda="etSchedulerAgenda" etSchedulerAgenda></div>
    </div>
  `,
  imports: [SchedulerDirective, SchedulerAgendaDirective],
})
class SchedulerAgendaTestHostComponent {
  appointments = signal<Appointment[]>([]);
  agendaDays = signal<number | null>(null);
  focusedDate = signal(new Date(2026, 6, 15));
  view = signal<'agenda'>('agenda');
}

const appointment = (id: string, start: Date, end: Date): Appointment => ({
  id,
  parentId: null,
  title: id,
  start,
  end,
});

describe('SchedulerAgendaDirective', () => {
  let fixture: ComponentFixture<SchedulerAgendaTestHostComponent>;
  let host: SchedulerAgendaTestHostComponent;
  let directive: SchedulerAgendaDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SchedulerAgendaTestHostComponent] });
    fixture = TestBed.createComponent(SchedulerAgendaTestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    directive = fixture.debugElement.children[0].children[0].injector.get(SchedulerAgendaDirective);
  });

  it('lays out a Monday-starting week as seven days', () => {
    const days = directive.days();

    expect(days).toHaveLength(7);
    expect(days[0]?.date).toEqual(new Date(2026, 6, 13));
    expect(days[6]?.date).toEqual(new Date(2026, 6, 19));
  });

  it('grows with agendaDays, starting at the focused date', () => {
    host.agendaDays.set(45);
    fixture.detectChanges();

    const days = directive.days();

    expect(days).toHaveLength(45);
    expect(days[0]?.date).toEqual(new Date(2026, 6, 15));
    expect(days[44]?.date).toEqual(new Date(2026, 7, 28));
  });

  it('re-lays-out when the input signal changes', () => {
    host.appointments.set([appointment('a', new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 10))]);
    fixture.detectChanges();

    const day = directive.days().find((d) => d.date.getTime() === new Date(2026, 6, 15).getTime());

    expect(day?.nodes.map((node) => node.appointment.id)).toEqual(['a']);
  });
});
