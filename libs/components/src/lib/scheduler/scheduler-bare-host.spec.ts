import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SchedulerDirective } from './headless';
import { SchedulerAgendaViewComponent } from './scheduler-agenda-view.component';
import { SchedulerMonthViewComponent } from './scheduler-month-view.component';
import { SchedulerTimeGridViewComponent } from './scheduler-time-grid-view.component';
import { Appointment, SchedulerView } from './scheduler.types';

@Component({
  template: `
    <div [appointments]="appointments" [focusedDate]="focusedDate" [view]="view()" etScheduler>
      @switch (view()) {
        @case ('month') {
          <et-scheduler-month-view />
        }
        @case ('agenda') {
          <et-scheduler-agenda-view />
        }
        @default {
          <et-scheduler-time-grid-view />
        }
      }
    </div>
  `,
  imports: [
    SchedulerDirective,
    SchedulerMonthViewComponent,
    SchedulerAgendaViewComponent,
    SchedulerTimeGridViewComponent,
  ],
})
class BareSchedulerHostComponent {
  view = signal<SchedulerView>('month');
  focusedDate = new Date(2026, 6, 15);
  appointments: Appointment[] = [
    {
      id: 'a',
      parentId: null,
      title: 'Standup',
      start: new Date(2026, 6, 15, 9),
      end: new Date(2026, 6, 15, 10),
    },
  ];
}

describe('default views inside a bare [etScheduler]', () => {
  it.each<SchedulerView>(['month', 'week', 'agenda'])('renders the title and time in the %s view', (view) => {
    TestBed.configureTestingModule({ imports: [BareSchedulerHostComponent] });
    const fixture = TestBed.createComponent(BareSchedulerHostComponent);

    fixture.componentInstance.view.set(view);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.et-scheduler-appointment-title')?.textContent).toBe('Standup');
    expect(element.querySelector('.et-scheduler-appointment-time-range')).not.toBeNull();

    fixture.destroy();
  });
});
