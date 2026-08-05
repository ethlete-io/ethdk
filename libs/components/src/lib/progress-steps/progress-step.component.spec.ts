import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { PROGRESS_STEPS_IMPORTS } from './progress-steps.imports';
import { ProgressStepState } from './progress-step.component';

@Component({
  selector: 'et-test-progress-step-host',
  template: `<et-progress-step [state]="state()">Shipping</et-progress-step>`,
  imports: [PROGRESS_STEPS_IMPORTS],
})
class ProgressStepHostComponent {
  public state = signal<ProgressStepState>('upcoming');
}

describe('ProgressStepComponent', () => {
  it('defaults to upcoming and renders no checkmark icon', () => {
    const fixture = TestBed.createComponent(ProgressStepHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector('et-progress-step') as HTMLElement;

    expect(host.getAttribute('data-state')).toBe('upcoming');
    expect(host.querySelector('.et-icon')).toBeNull();
    expect(host.querySelector('.et-progress-step-marker-number')).not.toBeNull();
  });

  it('reflects state as a data attribute', () => {
    const fixture = TestBed.createComponent(ProgressStepHostComponent);
    fixture.componentInstance.state.set('current');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('et-progress-step')?.getAttribute('data-state')).toBe('current');
  });

  it('renders a checkmark instead of the number marker once complete', () => {
    const fixture = TestBed.createComponent(ProgressStepHostComponent);
    fixture.componentInstance.state.set('complete');
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector('et-progress-step') as HTMLElement;

    expect(host.querySelector('.et-icon')).not.toBeNull();
    expect(host.querySelector('.et-progress-step-marker-number')).toBeNull();
  });

  it('projects the label content', () => {
    const fixture = TestBed.createComponent(ProgressStepHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.et-progress-step-label')?.textContent).toBe('Shipping');
  });
});
