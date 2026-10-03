import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { LabelDirective } from '../../form-field/headless';
import { mountOtpInput, OtpInputDriver } from '../../testing/otp-input-driver';
import { OTP_INPUT_IMPORTS } from '../otp-input.imports';

@Component({
  template: `
    <et-otp-input
      [value]="value()"
      [length]="length()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      (valueChange)="value.set($event)"
      (complete)="completions.push($event)"
    >
      <et-label>Code</et-label>
    </et-otp-input>
  `,
  imports: [OTP_INPUT_IMPORTS, LabelDirective],
})
class OtpEdgeHost {
  value = signal<string>('');
  length = signal<number | string>(4);
  disabled = signal(false);
  readonly = signal(false);
  completions: string[] = [];
}

describe('OtpInputDirective edge cases', () => {
  let driver: OtpInputDriver<OtpEdgeHost>;

  beforeEach(() => {
    driver = mountOtpInput(OtpEdgeHost);
  });

  it('keeps an empty value empty and never completes it', () => {
    driver.type('');

    expect(driver.host.value()).toBe('');
    expect(driver.host.completions).toEqual([]);
    expect(driver.segmentTexts()).toEqual([null, null, null, null]);
  });

  it('drops a paste with no accepted character', () => {
    driver.type('abc -_');

    expect(driver.host.value()).toBe('');
    expect(driver.fieldValue()).toBe('');
  });

  it('drops full-width and other non-ASCII digits from a numeric code', () => {
    driver.type('１２٣4');

    expect(driver.host.value()).toBe('4');
  });

  it('keeps a paste with whitespace and line breaks around the code', () => {
    driver.type('  12\n34  ');

    expect(driver.host.value()).toBe('1234');
    expect(driver.host.completions).toEqual(['1234']);
  });

  it('strips a programmatic value with characters outside the charset', () => {
    driver.host.value.set('1a2b');
    driver.tick();

    expect(driver.host.value()).toBe('12');
  });

  it.each([
    ['zero', 0],
    ['a negative number', -3],
    ['NaN', 'abc'],
  ])('falls back to six segments for a length of %s and never completes an empty value', (_, length) => {
    driver.host.length.set(length);
    driver.tick();

    expect(driver.segmentCount()).toBe(6);
    expect(driver.host.completions).toEqual([]);
  });

  it('still accepts input after an unparseable length', () => {
    driver.host.length.set('abc');
    driver.tick();

    driver.type('12');

    expect(driver.host.value()).toBe('12');
  });

  it('does not complete when backspace removes the last character', () => {
    driver.type('1234');
    driver.type('123');

    expect(driver.host.completions).toEqual(['1234']);
    expect(driver.host.value()).toBe('123');
  });

  it('completes again once the same code is re-entered after an edit', () => {
    driver.type('1234');
    driver.type('123');
    driver.type('1234');

    expect(driver.host.completions).toEqual(['1234', '1234']);
  });

  it('does not take focus from a click while disabled', () => {
    driver.host.disabled.set(true);
    driver.tick();

    driver.click(driver.element());

    expect(document.activeElement).not.toBe(driver.field());
    expect(driver.field().disabled).toBe(true);
  });

  it('marks the native input readonly', () => {
    driver.host.readonly.set(true);
    driver.tick();

    expect(driver.field().readOnly).toBe(true);
  });
});
