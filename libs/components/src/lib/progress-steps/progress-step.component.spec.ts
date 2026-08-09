import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, ProvideColorDirective, provideColorThemesWithTailwind4 } from '@ethlete/core';
import '../../test-helpers';
import { PROGRESS_STEPS_IMPORTS } from './progress-steps.imports';
import { ProgressStepComponent, ProgressStepState } from './progress-step.component';

const COLOR_THEMES: ColorTheme[] = [
  { name: 'danger', type: 'error', primary: { color: { default: '220 38 38' }, onColor: { default: '255 255 255' } } },
  { name: 'sunshine', type: 'warning', primary: { color: { default: '234 179 8' }, onColor: { default: '0 0 0' } } },
  { name: 'grass', type: 'success', primary: { color: { default: '22 163 74' }, onColor: { default: '255 255 255' } } },
];

@Component({
  selector: 'et-test-progress-step-host',
  template: `<et-progress-step [state]="state()">Shipping</et-progress-step>`,
  imports: [PROGRESS_STEPS_IMPORTS],
})
class ProgressStepHostComponent {
  public step = viewChild(ProgressStepComponent, { read: ProvideColorDirective });

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

  it('needs no semantic theme registered for the three plain states', () => {
    TestBed.configureTestingModule({ providers: [] });

    const fixture = TestBed.createComponent(ProgressStepHostComponent);

    for (const state of ['upcoming', 'current', 'complete'] as const) {
      fixture.componentInstance.state.set(state);
      expect(() => fixture.detectChanges()).not.toThrow();
    }
  });

  it.each([
    ['success', 'et-check', 'grass'],
    ['warning', 'et-triangle-exclamation', 'sunshine'],
    ['error', 'et-times', 'danger'],
  ] as const)('renders the %s outcome with its own icon and semantic theme', (state, iconName, themeName) => {
    TestBed.configureTestingModule({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

    const fixture = TestBed.createComponent(ProgressStepHostComponent);
    fixture.componentInstance.state.set(state);
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector('et-progress-step') as HTMLElement;

    expect(host.getAttribute('data-state')).toBe(state);
    expect(host.querySelector('.et-progress-step-marker-number')).toBeNull();
    expect(host.querySelector(`.et-icon--${iconName}`)).not.toBeNull();
    expect((fixture.componentInstance.step()?.effectiveColor() as ColorTheme)?.name).toBe(themeName);
  });

  it('drops back to the surrounding theme when an outcome is cleared', () => {
    TestBed.configureTestingModule({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

    const fixture = TestBed.createComponent(ProgressStepHostComponent);
    fixture.componentInstance.state.set('error');
    fixture.detectChanges();

    fixture.componentInstance.state.set('current');
    fixture.detectChanges();

    expect(fixture.componentInstance.step()?.effectiveColor()).toBeUndefined();
  });

  it('projects the label content', () => {
    const fixture = TestBed.createComponent(ProgressStepHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.et-progress-step-label')?.textContent).toBe('Shipping');
  });
});
