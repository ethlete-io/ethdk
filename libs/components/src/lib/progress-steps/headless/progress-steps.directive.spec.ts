import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { fakeLayout, fakeResizeObserver } from '../../testing/fake-layout';
import { PROGRESS_STEPS_IMPORTS } from '../progress-steps.imports';
import { ProgressStepDirective, ProgressStepState } from './progress-step.directive';
import { ProgressStepsDirective, ProgressStepsOrientation } from './progress-steps.directive';

@Component({
  selector: 'et-test-headless-progress-steps-host',
  template: `
    <ol [orientation]="orientation()" etProgressSteps>
      @for (state of states(); track $index) {
        <li [stepState]="state" etProgressStep>Step {{ $index + 1 }}</li>
      }
    </ol>
  `,
  imports: [ProgressStepsDirective, ProgressStepDirective],
})
class HeadlessHostComponent {
  public orientation = signal<ProgressStepsOrientation>('auto');
  public states = signal<ProgressStepState[]>(['complete', 'skipped', 'current', 'upcoming']);
}

@Component({
  selector: 'et-test-progress-steps-auto-host',
  template: `
    <et-progress-steps>
      <et-progress-step stepState="complete">Account</et-progress-step>
      <et-progress-step stepState="current">Shipping</et-progress-step>
      <et-progress-step stepState="upcoming">Payment</et-progress-step>
    </et-progress-steps>
  `,
  imports: [PROGRESS_STEPS_IMPORTS],
})
class AutoHostComponent {}

describe('ProgressStepsDirective', () => {
  it('gives any markup the list semantics and the step states, with no look', () => {
    const fixture = TestBed.createComponent(HeadlessHostComponent);
    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector('ol') as HTMLElement;
    const items = [...list.querySelectorAll('li')];

    expect(list.getAttribute('role')).toBe('list');
    expect(list.className).toBe('');
    expect(items.map((item) => item.getAttribute('data-state'))).toEqual([
      'complete',
      'skipped',
      'current',
      'upcoming',
    ]);
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, null, 'step', null]);
  });

  it('tracks the steps as they come and go', () => {
    const fixture = TestBed.createComponent(HeadlessHostComponent);
    fixture.detectChanges();

    const steps = fixture.debugElement.children[0]!.injector.get(ProgressStepsDirective);

    expect(steps.steps().length).toBe(4);

    fixture.componentInstance.states.set(['current']);
    fixture.detectChanges();

    expect(steps.steps().length).toBe(1);
  });

  it('stays horizontal in auto until it has been measured', () => {
    const fixture = TestBed.createComponent(HeadlessHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ol').getAttribute('data-orientation')).toBe('horizontal');
  });

  it('stacks into a column in auto once a step would get narrower than minStepSize', async () => {
    let width = 600;
    const observer = fakeResizeObserver();
    fakeLayout([{ match: 'et-progress-steps', clientWidth: () => width }]);

    const fixture = TestBed.createComponent(AutoHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector('et-progress-steps') as HTMLElement;

    observer.fire(host);
    fixture.detectChanges();

    expect(host.getAttribute('data-orientation')).toBe('horizontal');

    width = 200;
    observer.fire(host);
    fixture.detectChanges();

    expect(host.getAttribute('data-orientation')).toBe('vertical');
  });

  it('keeps an explicit orientation whatever the width', () => {
    const fixture = TestBed.createComponent(HeadlessHostComponent);
    fixture.componentInstance.orientation.set('vertical');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ol').getAttribute('data-orientation')).toBe('vertical');
  });
});
