import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, minLength } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { FORM_FIELD_IMPORTS, OtpInputComponent, OtpInputDirective } from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-verify-code',
  imports: [FORM_FIELD_IMPORTS, OtpInputComponent, FormField],
  template: `
    <et-otp-input [formField]="verify.code" [masked]="masked()" (complete)="completed.push($event)" length="4">
      <et-label>Verification code</et-label>
      <et-hint>Four digits from the email</et-hint>
    </et-otp-input>
  `,
})
class VerifyCodeComponent {
  masked = signal(false);
  model = signal({ code: '' });
  verify = form(this.model, (path) => {
    minLength(path.code, 4, { message: 'Enter all four digits' });
  });
  completed: string[] = [];
  otp = viewChild.required(OtpInputComponent);
}

@Component({
  selector: 'et-scenario-native-pin',
  imports: [OtpInputDirective],
  template: `
    <input
      [(value)]="pin"
      (complete)="completed.push($event)"
      etOtpInput
      length="4"
      charset="alphanumeric"
      aria-label="Pin"
    />
  `,
})
class NativePinComponent {
  pin = signal('');
  completed: string[] = [];
  otp = viewChild.required(OtpInputDirective);
}

const typeInto = (s: Scenario, input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

const segments = (host: Element) =>
  Array.from(host.querySelectorAll('.et-otp-input-segment')).map((segment) => segment.textContent?.trim() || null);

describe('otp input scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });

  it('fills the segments from one native input, strips non-digits and emits complete once', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(VerifyCodeComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const input = host.querySelector('input')!;

    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(host.querySelector(`#${input.getAttribute('aria-labelledby')}`)?.textContent).toContain('Verification code');

    app.otp().focus();
    s.tick();

    expect(document.activeElement).toBe(input);
    expect(host.querySelector('.et-otp-input-segment[data-caret]')).toBe(host.querySelector('.et-otp-input-segment'));

    typeInto(s, input, '1a2');

    expect(app.model().code).toBe('12');
    expect(input.value).toBe('12');
    expect(segments(host)).toEqual(['1', '2', null, null]);

    input.blur();
    s.tick();

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Enter all four digits');

    typeInto(s, input, '12345');

    expect(app.model().code).toBe('1234');
    expect(app.completed).toEqual(['1234']);
    expect(input.hasAttribute('aria-invalid')).toBe(false);

    app.masked.set(true);
    s.tick();

    expect(segments(host)).toEqual(['•', '•', '•', '•']);
    s.flush();
  });

  it('drives a plain input with the headless directive', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NativePinComponent);
    const app = fixture.componentInstance;
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;

    s.tick();

    expect(app.otp().nativeControl()).toBe(input);
    expect(app.otp().inputMode()).toBe('text');

    input.focus();
    s.tick();

    expect(app.otp().focused()).toBe(true);

    typeInto(s, input, 'ab-9z');

    expect(app.pin()).toBe('ab9z');
    expect(app.completed).toEqual(['ab9z']);

    input.blur();
    s.tick();

    expect(app.otp().touched()).toBe(true);
    expect(app.otp().focused()).toBe(false);
  });
});
