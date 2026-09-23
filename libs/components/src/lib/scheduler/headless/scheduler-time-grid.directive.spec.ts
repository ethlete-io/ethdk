import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Appointment, SchedulerBusinessHours } from '../scheduler.types';
import { SchedulerDirective } from './scheduler.directive';
import { SchedulerTimeGridDirective } from './scheduler-time-grid.directive';

@Component({
  template: `
    <div
      [focusedDate]="focusedDate()"
      [appointments]="appointments()"
      [view]="view()"
      [businessHours]="businessHours()"
      [nowIndicator]="nowIndicator()"
      [firstDayOfWeek]="1"
      etScheduler
    >
      <div #grid="etSchedulerTimeGrid" etSchedulerTimeGrid></div>
    </div>
  `,
  imports: [SchedulerDirective, SchedulerTimeGridDirective],
})
class SchedulerTimeGridTestHostComponent {
  appointments = signal<Appointment[]>([]);
  focusedDate = signal(new Date(2026, 6, 15));
  view = signal<'week' | 'day'>('week');
  businessHours = signal<SchedulerBusinessHours[] | null>(null);
  nowIndicator = signal(true);
}

const appointment = (id: string, start: Date, end: Date): Appointment => ({
  id,
  parentId: null,
  title: id,
  start,
  end,
});

describe('SchedulerTimeGridDirective', () => {
  let fixture: ComponentFixture<SchedulerTimeGridTestHostComponent>;
  let host: SchedulerTimeGridTestHostComponent;
  let directive: SchedulerTimeGridDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SchedulerTimeGridTestHostComponent] });
    fixture = TestBed.createComponent(SchedulerTimeGridTestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    directive = fixture.debugElement.children[0]!.children[0]!.injector.get(SchedulerTimeGridDirective);
  });

  it('lays out a Monday-starting week as seven day columns', () => {
    const days = directive.days();

    expect(days).toHaveLength(7);
    expect(days[0]?.date).toEqual(new Date(2026, 6, 13));
    expect(days[6]?.date).toEqual(new Date(2026, 6, 19));
  });

  it('narrows to a single day column in the day view', () => {
    host.view.set('day');
    fixture.detectChanges();

    const days = directive.days();

    expect(days).toHaveLength(1);
    expect(days[0]?.date).toEqual(new Date(2026, 6, 15));
  });

  it('places the clock on the column of the day it falls in', () => {
    const now = new Date();

    host.focusedDate.set(now);
    host.view.set('day');
    fixture.detectChanges();

    const currentTime = directive.currentTime();
    const offsetMinutes = ((currentTime?.offset ?? 0) / 100) * 24 * 60;
    const minutes = now.getHours() * 60 + now.getMinutes();

    expect(currentTime?.dayIndex).toBe(0);
    expect(Math.abs(offsetMinutes - minutes)).toBeLessThan(1);
  });

  it('places no clock while the now indicator is off', () => {
    host.focusedDate.set(new Date());
    host.nowIndicator.set(false);
    fixture.detectChanges();

    expect(directive.currentTime()).toBeNull();
  });

  it('places no clock on a week today is not in', () => {
    expect(directive.currentTime()).toBeNull();
  });

  it('marks no time as outside business hours while none are set', () => {
    expect(directive.nonBusinessTime()).toEqual([[], [], [], [], [], [], []]);
  });

  it('closes each visible day outside its business hours', () => {
    host.businessHours.set([{ daysOfWeek: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }]);
    fixture.detectChanges();

    const [monday, , , , , saturday] = directive.nonBusinessTime();

    expect(monday).toEqual([
      { offset: 0, span: 37.5 },
      { offset: (17 / 24) * 100, span: (7 / 24) * 100 },
    ]);
    expect(saturday).toEqual([{ offset: 0, span: 100 }]);
  });

  it('re-lays-out when the input signal changes', () => {
    host.appointments.set([appointment('a', new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 10))]);
    fixture.detectChanges();

    const day = directive.days().find((d) => d.date.getTime() === new Date(2026, 6, 15).getTime());

    expect(day?.blocks.map((block) => block.node.appointment.id)).toEqual(['a']);
  });
});
