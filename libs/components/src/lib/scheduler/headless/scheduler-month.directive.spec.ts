import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Appointment } from '../scheduler.types';
import { SchedulerDirective } from './scheduler.directive';
import { SchedulerMonthDirective } from './scheduler-month.directive';

@Component({
  template: `
    <div [focusedDate]="focusedDate()" [appointments]="appointments()" [firstDayOfWeek]="1" etScheduler>
      <div #month="etSchedulerMonth" [maxVisiblePerCell]="maxVisiblePerCell()" etSchedulerMonth></div>
    </div>
  `,
  imports: [SchedulerDirective, SchedulerMonthDirective],
})
class SchedulerMonthTestHostComponent {
  appointments = signal<Appointment[]>([]);
  focusedDate = signal(new Date(2026, 6, 15));
  maxVisiblePerCell = signal(3);
}

const appointment = (id: string, start: Date, end: Date): Appointment => ({
  id,
  parentId: null,
  title: id,
  start,
  end,
});

describe('SchedulerMonthDirective', () => {
  let fixture: ComponentFixture<SchedulerMonthTestHostComponent>;
  let host: SchedulerMonthTestHostComponent;
  let directive: SchedulerMonthDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SchedulerMonthTestHostComponent] });
    fixture = TestBed.createComponent(SchedulerMonthTestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    directive = fixture.debugElement.children[0].children[0].injector.get(SchedulerMonthDirective);
  });

  it('pads the grid to full Monday-starting weeks', () => {
    const weeks = directive.weeks();

    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.[0]?.date).toEqual(new Date(2026, 5, 29));
    expect(weeks[0]?.[0]?.outsideMonth).toBe(true);
  });

  it('re-buckets appointments when the input signal changes', () => {
    host.appointments.set([appointment('a', new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 10))]);
    fixture.detectChanges();

    const cell = directive
      .weeks()
      .flat()
      .find((c) => c.date.getTime() === new Date(2026, 6, 15).getTime());

    expect(cell?.visible.map((node) => node.appointment.id)).toEqual(['a']);
  });

  it('caps visible appointments to maxVisiblePerCell', () => {
    host.maxVisiblePerCell.set(1);
    host.appointments.set(['a', 'b'].map((id) => appointment(id, new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 10))));
    fixture.detectChanges();

    const cell = directive
      .weeks()
      .flat()
      .find((c) => c.date.getTime() === new Date(2026, 6, 15).getTime());

    expect(cell?.visible).toHaveLength(1);
    expect(cell?.overflow).toHaveLength(1);
  });
});
