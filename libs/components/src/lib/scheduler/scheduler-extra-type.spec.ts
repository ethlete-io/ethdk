import { Component, OutputEmitterRef, OutputRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import '../../test-helpers';
import { injectSchedulerFeatureHost, SchedulerFeatureHost } from './headless';
import { SchedulerComponent } from './scheduler.component';
import { Appointment, SchedulerAppointmentReschedule } from './scheduler.types';

type IssueExtra = { issueKey: string };

const issue: Appointment<IssueExtra> = {
  id: 'a',
  parentId: null,
  title: 'Standup',
  start: new Date(2026, 6, 15, 9),
  end: new Date(2026, 6, 15, 10),
  extra: { issueKey: 'ET-1' },
};

@Component({
  template: `<et-scheduler [appointments]="appointments" (appointmentReschedule)="move($event)" />`,
  imports: [SchedulerComponent],
})
class TypedSchedulerHostComponent {
  scheduler = viewChild.required(SchedulerComponent);
  appointments = [issue];
  moves: SchedulerAppointmentReschedule<IssueExtra>[] = [];

  move(reschedule: SchedulerAppointmentReschedule<IssueExtra>) {
    this.moves.push(reschedule);
  }
}

describe('SchedulerComponent TExtra', () => {
  it('carries TExtra from appointments to its outputs and its feature host', () => {
    expectTypeOf<SchedulerComponent<IssueExtra>['appointmentSave']>().toEqualTypeOf<
      OutputEmitterRef<Appointment<IssueExtra>>
    >();
    expectTypeOf<SchedulerComponent<IssueExtra>['appointmentReschedule']>().toEqualTypeOf<
      OutputRef<SchedulerAppointmentReschedule<IssueExtra>>
    >();
    expectTypeOf<SchedulerComponent<IssueExtra>>().toExtend<SchedulerFeatureHost<IssueExtra>>();
    expectTypeOf<ReturnType<SchedulerFeatureHost<IssueExtra>['visibleAppointments']>>().toEqualTypeOf<
      readonly Appointment<IssueExtra>[]
    >();
    expectTypeOf(injectSchedulerFeatureHost<IssueExtra>).returns.toEqualTypeOf<SchedulerFeatureHost<IssueExtra>>();
    expectTypeOf<SchedulerComponent['appointmentSave']>().toEqualTypeOf<OutputEmitterRef<Appointment>>();
  });

  it('emits appointmentReschedule once per reschedule', () => {
    const fixture = TestBed.createComponent(TypedSchedulerHostComponent);

    fixture.detectChanges();

    const reschedule = { appointment: { ...issue, start: new Date(2026, 6, 15, 11) }, previous: issue };

    fixture.componentInstance.scheduler().headless.appointmentReschedule.emit(reschedule);

    expect(fixture.componentInstance.moves).toEqual([reschedule]);

    fixture.destroy();
  });
});
