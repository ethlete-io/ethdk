import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SchedulerDirective } from './headless';
import { SchedulerAgendaViewComponent } from './scheduler-agenda-view.component';
import { Appointment } from './scheduler.types';

@Component({
  template: `
    <div
      [appointments]="appointments()"
      [agendaDays]="agendaDays()"
      [focusedDate]="focusedDate"
      view="agenda"
      etScheduler
    >
      <et-scheduler-agenda-view />
    </div>
  `,
  imports: [SchedulerDirective, SchedulerAgendaViewComponent],
})
class AgendaViewTestHostComponent {
  appointments = signal<Appointment[]>([]);
  agendaDays = signal<number | null>(null);
  focusedDate = new Date(2026, 6, 15);
}

const appointment = (id: string, day: Date): Appointment => ({
  id,
  parentId: null,
  title: id,
  start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9),
  end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10),
});

describe('SchedulerAgendaViewComponent', () => {
  let fixture: ComponentFixture<AgendaViewTestHostComponent>;
  let host: AgendaViewTestHostComponent;

  const monthHeadings = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.et-scheduler-agenda-view-month')).map((heading) =>
      (heading as HTMLElement).textContent?.trim(),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AgendaViewTestHostComponent] });
    fixture = TestBed.createComponent(AgendaViewTestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders a section per day that has appointments', () => {
    host.appointments.set([appointment('a', new Date(2026, 6, 15)), appointment('b', new Date(2026, 6, 16))]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.et-scheduler-agenda-view-day')).toHaveLength(2);
  });

  it('heads a month the list crosses into, but not the one it starts in', () => {
    host.agendaDays.set(60);
    host.appointments.set([
      appointment('july', new Date(2026, 6, 20)),
      appointment('august', new Date(2026, 7, 3)),
      appointment('august-again', new Date(2026, 7, 10)),
      appointment('september', new Date(2026, 8, 1)),
    ]);
    fixture.detectChanges();

    expect(monthHeadings()).toEqual(['August 2026', 'September 2026']);
  });
});
