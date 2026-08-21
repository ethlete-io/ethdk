import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { LabelDirective } from '../../form-field/headless';
import { mountOtpInput, OtpInputDriver } from '../../testing/otp-input-driver';
import { OTP_INPUT_IMPORTS } from '../otp-input.imports';
import { OtpInputCharset } from './otp-input.directive';

@Component({
  template: `
    <et-otp-input
      [value]="value()"
      [length]="4"
      [charset]="charset()"
      [masked]="masked()"
      (valueChange)="value.set($event)"
      (complete)="completions.push($event)"
    >
      <et-label>Test label</et-label>
    </et-otp-input>
  `,
  imports: [OTP_INPUT_IMPORTS, LabelDirective],
})
class OtpTestHost {
  value = signal('');
  charset = signal<OtpInputCharset>('numeric');
  masked = signal(false);
  completions: string[] = [];
}

describe('OtpInputDirective', () => {
  let driver: OtpInputDriver<OtpTestHost>;

  beforeEach(() => {
    driver = mountOtpInput(OtpTestHost);
  });

  it('renders one segment per character and a single autofill-ready input', () => {
    expect(driver.segmentCount()).toBe(4);
    expect(driver.attr('autocomplete')).toBe('one-time-code');
    expect(driver.attr('inputmode')).toBe('numeric');
    expect(driver.attr('maxlength')).toBe('4');
  });

  it('builds the value from typed characters and fills the segments', () => {
    driver.type('12');

    expect(driver.host.value()).toBe('12');
    expect(driver.segmentTexts()).toEqual(['1', '2', null, null]);
  });

  it('strips characters outside the charset (pastes with separators included)', () => {
    driver.type('12-3 4x');

    expect(driver.host.value()).toBe('1234');
    expect(driver.fieldValue()).toBe('1234');
  });

  it('truncates to the configured length', () => {
    driver.type('1234567');

    expect(driver.host.value()).toBe('1234');
  });

  it('emits completed exactly once per completion', () => {
    driver.type('123');
    expect(driver.host.completions).toEqual([]);

    driver.type('1234');
    expect(driver.host.completions).toEqual(['1234']);

    // editing within the completed state does not re-emit
    driver.type('1234');
    expect(driver.host.completions).toEqual(['1234']);

    // deleting and completing again emits again
    driver.type('123');
    driver.type('1235');
    expect(driver.host.completions).toEqual(['1234', '1235']);
  });

  it('masks the rendered characters, not the value', () => {
    driver.host.masked.set(true);
    driver.tick();

    driver.type('12');

    expect(driver.segmentTexts()).toEqual(['•', '•', null, null]);
    expect(driver.host.value()).toBe('12');
  });

  it('supports alphanumeric and custom charsets', () => {
    driver.host.charset.set('alphanumeric');
    driver.tick();
    driver.type('a1-b2');
    expect(driver.host.value()).toBe('a1b2');

    driver.host.charset.set(/[a-f]/);
    driver.tick();
    driver.type('abc123def');
    expect(driver.host.value()).toBe('abcd');
  });

  it('marks the caret segment while focused', () => {
    driver.focus();
    driver.type('12');

    expect(driver.segmentCarets()).toEqual([false, false, true, false]);

    driver.type('1234');
    expect(driver.segmentCarets()).toEqual([false, false, false, true]);

    driver.blur();
    expect(driver.segmentCarets()).toEqual([false, false, false, false]);
  });
});
