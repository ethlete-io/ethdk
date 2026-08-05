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
});
