import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { PROGRESS_STEPS_IMPORTS } from './progress-steps.imports';

@Component({
  selector: 'et-test-progress-steps-host',
  template: `
    <et-progress-steps>
      <et-progress-step state="complete">Account</et-progress-step>
      <et-progress-step state="current">Shipping</et-progress-step>
      <et-progress-step state="upcoming">Payment</et-progress-step>
    </et-progress-steps>
  `,
  imports: [PROGRESS_STEPS_IMPORTS],
})
class ProgressStepsHostComponent {}

@Component({
  selector: 'et-test-progress-steps-link-host',
  template: `<et-progress-steps><a href="/a" state="complete" et-progress-step>Account</a></et-progress-steps>`,
  imports: [PROGRESS_STEPS_IMPORTS],
})
class ProgressStepsLinkHostComponent {}

describe('ProgressStepsComponent', () => {
  it('renders the projected steps in order', () => {
    const fixture = TestBed.createComponent(ProgressStepsHostComponent);
    fixture.detectChanges();

    const steps = fixture.nativeElement.querySelectorAll('et-progress-steps et-progress-step');

    expect([...steps].map((el: Element) => el.getAttribute('data-state'))).toEqual(['complete', 'current', 'upcoming']);
    expect([...steps].map((el: Element) => el.querySelector('.et-progress-step-label')?.textContent)).toEqual([
      'Account',
      'Shipping',
      'Payment',
    ]);
  });

  it('exposes the steps as a list', () => {
    const fixture = TestBed.createComponent(ProgressStepsHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('et-progress-steps').getAttribute('role')).toBe('list');
    expect(
      [...fixture.nativeElement.querySelectorAll('et-progress-step')].map((el: Element) => el.getAttribute('role')),
    ).toEqual(['listitem', 'listitem', 'listitem']);
  });

  it('keeps the native role of a step written as a link', () => {
    const fixture = TestBed.createComponent(ProgressStepsLinkHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a').getAttribute('role')).toBeNull();
  });
});
