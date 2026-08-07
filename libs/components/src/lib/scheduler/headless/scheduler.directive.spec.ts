import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Appointment, SchedulerView } from '../scheduler.types';
import { SchedulerDirective } from './scheduler.directive';

@Component({
  template: `
    <div
      #scheduler="etScheduler"
      [(view)]="view"
      [(focusedDate)]="focusedDate"
      [(selectedAppointmentId)]="selectedAppointmentId"
      [appointments]="appointments()"
      [firstDayOfWeek]="1"
      etScheduler
    ></div>
  `,
  imports: [SchedulerDirective],
})
class SchedulerTestHostComponent {
  appointments = signal<Appointment[]>([]);
  view = signal<SchedulerView>('month');
  focusedDate = signal(new Date(2026, 6, 15));
  selectedAppointmentId = signal<string | null>(null);
}

const appointment = (id: string, parentId: string | null = null): Appointment => ({
  id,
  parentId,
  title: id,
  start: new Date(2026, 6, 15, 9),
  end: new Date(2026, 6, 15, 10),
});

describe('SchedulerDirective', () => {
  let fixture: ComponentFixture<SchedulerTestHostComponent>;
  let host: SchedulerTestHostComponent;
  let directive: SchedulerDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SchedulerTestHostComponent] });
    fixture = TestBed.createComponent(SchedulerTestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    directive = fixture.debugElement.children[0].injector.get(SchedulerDirective);
  });

  it('pads the month view to full weeks starting Monday', () => {
    host.view.set('month');
    fixture.detectChanges();

    // July 2026: 1st is a Wednesday, 31st a Friday - the Monday-based grid runs June 29 to Aug 2
    expect(directive.visibleRange()).toEqual({
      start: new Date(2026, 5, 29),
      end: new Date(2026, 7, 2, 23, 59, 59, 999),
    });
  });

  it('gives the week and agenda views the same 7-day window', () => {
    host.view.set('week');
    fixture.detectChanges();
    const weekRange = directive.visibleRange();

    host.view.set('agenda');
    fixture.detectChanges();

    expect(directive.visibleRange()).toEqual(weekRange);
  });

  it('confines the day view to the focused date', () => {
    host.view.set('day');
    fixture.detectChanges();

    expect(directive.visibleRange()).toEqual({
      start: new Date(2026, 6, 15),
      end: new Date(2026, 6, 15, 23, 59, 59, 999),
    });
  });

  it('steps focusedDate by the active view unit', () => {
    host.view.set('day');
    fixture.detectChanges();
    directive.next();
    expect(host.focusedDate()).toEqual(new Date(2026, 6, 16));

    host.view.set('week');
    fixture.detectChanges();
    directive.next();
    expect(host.focusedDate()).toEqual(new Date(2026, 6, 23));

    host.view.set('month');
    fixture.detectChanges();
    directive.previous();
    expect(host.focusedDate()).toEqual(new Date(2026, 5, 23));
  });

  it('arranges the appointments input into a sub-appointment tree', () => {
    host.appointments.set([appointment('a'), appointment('a1', 'a')]);
    fixture.detectChanges();

    const tree = directive.appointmentTree();

    expect(tree).toHaveLength(1);
    expect(tree[0]?.children[0]?.appointment.id).toBe('a1');
  });

  it('resolves selectedAppointment from selectedAppointmentId', () => {
    host.appointments.set([appointment('a'), appointment('b')]);
    host.selectedAppointmentId.set('b');
    fixture.detectChanges();

    expect(directive.selectedAppointment()?.id).toBe('b');
  });

  it('resolves selectedAppointment to null when nothing is selected', () => {
    expect(directive.selectedAppointment()).toBeNull();
  });

  describe('drag-to-create range', () => {
    const QUARTER_HOUR = 15 * 60 * 1000;
    const at = (hour: number, minute = 0) => new Date(2026, 6, 15, hour, minute);

    it('opens one slot wide at the point the drag began', () => {
      directive.beginDraftRange(at(9), QUARTER_HOUR);

      expect(directive.draftRange()).toEqual({ start: at(9), end: at(9, 15), phase: 'dragging' });
    });

    it('grows downwards from the anchor', () => {
      directive.beginDraftRange(at(9), QUARTER_HOUR);
      directive.extendDraftRange(at(11), QUARTER_HOUR);

      expect(directive.draftRange()).toMatchObject({ start: at(9), end: at(11) });
    });

    it('flips so a drag above the anchor ends at it', () => {
      directive.beginDraftRange(at(9), QUARTER_HOUR);
      directive.extendDraftRange(at(7, 30), QUARTER_HOUR);

      expect(directive.draftRange()).toMatchObject({ start: at(7, 30), end: at(9) });
    });

    it('never shrinks below one slot while dragging back through the anchor', () => {
      directive.beginDraftRange(at(9), QUARTER_HOUR);
      directive.extendDraftRange(at(9, 5), QUARTER_HOUR);

      const range = directive.draftRange();

      expect(range!.end.getTime() - range!.start.getTime()).toBe(QUARTER_HOUR);
    });

    it('marks the range committed on release and drops it on clear', () => {
      directive.beginDraftRange(at(9), QUARTER_HOUR);
      directive.commitDraftRange();

      expect(directive.draftRange()?.phase).toBe('committed');

      directive.clearDraftRange();

      expect(directive.draftRange()).toBeNull();
    });

    it('leaves an already committed range untouched, so its surface is not reopened', () => {
      directive.beginDraftRange(at(9), QUARTER_HOUR);
      directive.commitDraftRange();

      const committed = directive.draftRange();

      directive.commitDraftRange();

      expect(directive.draftRange()).toBe(committed);
    });

    it('ignores an extend with no drag in progress', () => {
      directive.extendDraftRange(at(11), QUARTER_HOUR);

      expect(directive.draftRange()).toBeNull();
    });

    it('takes a whole range for a view that draws in days', () => {
      directive.setDraftRange({ start: at(0), end: new Date(2026, 6, 17, 23, 59), allDay: true });

      expect(directive.draftRange()).toMatchObject({ allDay: true, phase: 'dragging' });

      directive.commitDraftRange();

      expect(directive.draftRange()).toMatchObject({ allDay: true, phase: 'committed' });
    });
  });
});
