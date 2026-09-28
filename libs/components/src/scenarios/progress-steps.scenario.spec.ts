import { Component, getDebugNode, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  DEFAULT_PROGRESS_STEP_LABELS,
  injectProgressStepLabels,
  PROGRESS_STEP_LABELS,
  PROGRESS_STEP_STATES,
  PROGRESS_STEPS_IMPORTS,
  PROGRESS_STEPS_ORIENTATIONS,
  ProgressStepComponent,
  ProgressStepsComponent,
  ProgressStepsOrientation,
  ProgressStepState,
  provideProgressStepLabels,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'ok', type: 'success', primary: swatch('0 160 60') },
  { name: 'caution', type: 'warning', primary: swatch('220 160 0') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

@Component({
  selector: 'et-scenario-checkout-steps',
  imports: [PROGRESS_STEPS_IMPORTS],
  template: `
    <et-progress-steps [orientation]="orientation()">
      <a
        [state]="account()"
        (click)="$event.preventDefault(); visited.push('account')"
        et-progress-step
        href="/account"
      >
        Account
      </a>
      <button [state]="shipping()" (click)="visited.push('shipping')" et-progress-step type="button">
        Shipping
        <span class="shipping-note" etProgressStepDescription>Parcel for team-a</span>
      </button>
      <button [state]="payment()" (click)="visited.push('payment')" disabled et-progress-step type="button">
        Payment
      </button>
      <et-progress-step>Review</et-progress-step>
    </et-progress-steps>
  `,
})
class CheckoutStepsComponent {
  orientation = signal<ProgressStepsOrientation>(PROGRESS_STEPS_ORIENTATIONS.HORIZONTAL);
  account = signal<ProgressStepState>(PROGRESS_STEP_STATES.COMPLETE);
  shipping = signal<ProgressStepState>(PROGRESS_STEP_STATES.CURRENT);
  payment = signal<ProgressStepState>(PROGRESS_STEP_STATES.UPCOMING);
  visited: string[] = [];
}

const OUTCOME_STEPS_TEMPLATE = `
  <et-progress-steps>
    <et-progress-step state="complete">Account</et-progress-step>
    <et-progress-step state="success">Shipping</et-progress-step>
    <et-progress-step state="warning">Payment</et-progress-step>
    <et-progress-step state="error">Review</et-progress-step>
    <et-progress-step state="current">Confirm</et-progress-step>
    <et-progress-step state="upcoming">Done</et-progress-step>
  </et-progress-steps>
`;

@Component({
  selector: 'et-scenario-outcome-steps',
  imports: [PROGRESS_STEPS_IMPORTS],
  template: OUTCOME_STEPS_TEMPLATE,
})
class OutcomeStepsComponent {
  labels = injectProgressStepLabels();
}

@Component({
  selector: 'et-scenario-german-outcome-steps',
  imports: [PROGRESS_STEPS_IMPORTS],
  template: OUTCOME_STEPS_TEMPLATE,
  providers: [provideProgressStepLabels({ complete: 'Abgeschlossen', error: 'Fehlgeschlagen' })],
})
class GermanOutcomeStepsComponent {
  labels = injectProgressStepLabels();
}

@Component({
  selector: 'et-scenario-locale-outcome-steps',
  imports: [PROGRESS_STEPS_IMPORTS],
  template: OUTCOME_STEPS_TEMPLATE,
  providers: [{ provide: PROGRESS_STEP_LABELS, useValue: () => ({ success: 'Erfolgreich' }) }],
})
class LocaleOutcomeStepsComponent {}

const stateTexts = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>('.et-progress-step')).map(
    (step) => text(step.querySelector('.et-progress-step-state')) || null,
  );

describe('progress steps scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('renders each state on the consumer element with a number or an outcome icon', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CheckoutStepsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const row = host.querySelector('et-progress-steps') as HTMLElement;
    const steps = Array.from(row.querySelectorAll<HTMLElement>('.et-progress-step'));
    const markers = () => steps.map((step) => (step.querySelector('.et-progress-step-marker i') ? 'icon' : 'number'));

    expect(getDebugNode(row)?.componentInstance).toBeInstanceOf(ProgressStepsComponent);
    expect(steps.map((step) => getDebugNode(step)?.componentInstance instanceof ProgressStepComponent)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(row.classList).toContain('et-progress-steps');
    expect(row.getAttribute('data-orientation')).toBe('horizontal');
    expect(steps.map((step) => step.tagName)).toEqual(['A', 'BUTTON', 'BUTTON', 'ET-PROGRESS-STEP']);
    expect(steps.map((step) => step.getAttribute('data-state'))).toEqual([
      'complete',
      'current',
      'upcoming',
      'upcoming',
    ]);
    expect(markers()).toEqual(['icon', 'number', 'number', 'number']);
    expect(steps.map((step) => text(step.querySelector('.et-progress-step-label')))).toEqual([
      'Account',
      'Shipping',
      'Payment',
      'Review',
    ]);
    expect(text(steps[1]?.querySelector('.et-progress-step-text > .shipping-note'))).toBe('Parcel for team-a');
    expect(steps[1]?.querySelector('.et-progress-step-label .shipping-note')).toBeNull();
    expect(steps.every((step) => step.classList.contains('et-color--inherited'))).toBe(true);

    app.shipping.set(PROGRESS_STEP_STATES.SUCCESS);
    app.payment.set(PROGRESS_STEP_STATES.ERROR);
    app.account.set(PROGRESS_STEP_STATES.WARNING);
    s.tick();

    expect(steps.map((step) => step.getAttribute('data-state'))).toEqual(['warning', 'success', 'error', 'upcoming']);
    expect(markers()).toEqual(['icon', 'icon', 'icon', 'number']);
    expect(steps[0]?.classList).toContain('et-color--caution');
    expect(steps[1]?.classList).toContain('et-color--ok');
    expect(steps[2]?.classList).toContain('et-color--alert');

    app.payment.set(PROGRESS_STEP_STATES.CURRENT);
    s.tick();
    expect(steps[2]?.classList).toContain('et-color--inherited');
    expect(markers()[2]).toBe('number');

    app.orientation.set(PROGRESS_STEPS_ORIENTATIONS.VERTICAL);
    s.tick();
    expect(row.getAttribute('data-orientation')).toBe('vertical');
    expect(s.errors).toEqual([]);
  });

  it('marks only the current step with aria-current="step" and moves it with the state', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CheckoutStepsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const steps = Array.from(host.querySelectorAll<HTMLElement>('.et-progress-step'));
    const ariaCurrent = () => steps.map((step) => step.getAttribute('aria-current'));

    expect(ariaCurrent()).toEqual([null, 'step', null, null]);

    app.shipping.set(PROGRESS_STEP_STATES.COMPLETE);
    app.payment.set(PROGRESS_STEP_STATES.CURRENT);
    s.tick();

    expect(ariaCurrent()).toEqual([null, null, 'step', null]);

    app.payment.set(PROGRESS_STEP_STATES.ERROR);
    s.tick();

    expect(ariaCurrent()).toEqual([null, null, null, null]);
    expect(s.errors).toEqual([]);
  });

  it('keeps the consumer link and buttons interactive, and a disabled one inert', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CheckoutStepsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const [account, shipping, payment] = Array.from(host.querySelectorAll<HTMLElement>('.et-progress-step'));

    expect(account?.getAttribute('href')).toBe('/account');
    account?.click();
    shipping?.click();
    payment?.click();
    expect(app.visited).toEqual(['account', 'shipping']);

    shipping?.focus();
    expect(document.activeElement).toBe(shipping);
    expect(s.errors).toEqual([]);
  });

  it('announces each resolved state with the default labels and no text for current or upcoming', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(OutcomeStepsComponent);

    s.tick();

    expect(fixture.componentInstance.labels()).toEqual(DEFAULT_PROGRESS_STEP_LABELS);
    expect(stateTexts(fixture.nativeElement)).toEqual([
      DEFAULT_PROGRESS_STEP_LABELS.complete,
      DEFAULT_PROGRESS_STEP_LABELS.success,
      DEFAULT_PROGRESS_STEP_LABELS.warning,
      DEFAULT_PROGRESS_STEP_LABELS.error,
      null,
      null,
    ]);
    expect(s.errors).toEqual([]);
  });

  it('localizes the state text below provideProgressStepLabels and keeps the defaults it leaves out', () => {
    const s = scenario();
    const german = TestBed.createComponent(GermanOutcomeStepsComponent);
    const locale = TestBed.createComponent(LocaleOutcomeStepsComponent);

    s.tick();

    expect(german.componentInstance.labels()).toEqual({
      ...DEFAULT_PROGRESS_STEP_LABELS,
      complete: 'Abgeschlossen',
      error: 'Fehlgeschlagen',
    });
    expect(stateTexts(german.nativeElement)).toEqual([
      'Abgeschlossen',
      DEFAULT_PROGRESS_STEP_LABELS.success,
      DEFAULT_PROGRESS_STEP_LABELS.warning,
      'Fehlgeschlagen',
      null,
      null,
    ]);
    expect(stateTexts(locale.nativeElement)).toEqual([
      DEFAULT_PROGRESS_STEP_LABELS.complete,
      'Erfolgreich',
      DEFAULT_PROGRESS_STEP_LABELS.warning,
      DEFAULT_PROGRESS_STEP_LABELS.error,
      null,
      null,
    ]);
    expect(s.errors).toEqual([]);
  });
});
