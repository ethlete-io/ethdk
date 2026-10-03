import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { mountPhoneInput, PhoneInputDriver } from '../../testing/phone-input-driver';
import { PHONE_INPUT_IMPORTS } from '../phone-input.imports';

@Component({
  template: `
    <et-phone-input
      [value]="value()"
      [defaultCountry]="defaultCountry()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      (valueChange)="value.set($event)"
      aria-label="Phone"
    />
  `,
  imports: [PHONE_INPUT_IMPORTS],
})
class PhoneEdgeHost {
  value = signal('');
  defaultCountry = signal('de');
  disabled = signal(false);
  readonly = signal(false);
}

describe('PhoneInputDirective edge cases', () => {
  let driver: PhoneInputDriver<PhoneEdgeHost>;

  beforeEach(() => {
    driver = mountPhoneInput(PhoneEdgeHost);
  });

  it('keeps the value empty for input without a digit', () => {
    driver.type('abc -()');

    expect(driver.host.value()).toBe('');
    expect(driver.phone.country()).toBe('de');
  });

  it('keeps the value empty for a lone plus or 00', () => {
    driver.type('+');
    expect(driver.host.value()).toBe('');

    driver.type('00');
    expect(driver.host.value()).toBe('');
  });

  it('keeps the value empty for a lone trunk 0', () => {
    driver.type('0');

    expect(driver.host.value()).toBe('');
  });

  it('drops the bracketed trunk 0 from a pasted international number', () => {
    driver.type('+49 (0) 171 1234567');

    expect(driver.host.value()).toBe('+491711234567');
    expect(driver.phone.country()).toBe('de');
  });

  it('drops the bracketed trunk 0 after the 00 prefix as well', () => {
    driver.type('0044 (0)20 7123 4567');

    expect(driver.host.value()).toBe('+442071234567');
    expect(driver.phone.country()).toBe('gb');
  });

  it('keeps a bracketed area code that is not a trunk 0', () => {
    driver.type('+1 (212) 555-0123');

    expect(driver.host.value()).toBe('+12125550123');
    expect(driver.phone.country()).toBe('us');
  });

  it('strips separators from a pasted national number', () => {
    driver.type('0171 / 123-45.67');

    expect(driver.host.value()).toBe('+491711234567');
  });

  it('keeps an unknown country selection from changing the active country', () => {
    driver.selectCountry('xx');

    expect(driver.phone.country()).toBe('de');
  });

  it('accepts a country code with surrounding whitespace', () => {
    driver.selectCountry(' FR ');

    expect(driver.phone.country()).toBe('fr');
  });

  it('switches the country of an empty value without writing one', () => {
    driver.selectCountry('fr');

    expect(driver.host.value()).toBe('');
    expect(driver.phone.dialCode()).toBe('33');
  });

  it('ignores country selection and clear while disabled or readonly', () => {
    driver.host.value.set('+491711234567');
    driver.host.disabled.set(true);
    driver.tick();

    driver.selectCountry('fr');
    driver.clearValue();

    expect(driver.host.value()).toBe('+491711234567');

    driver.host.disabled.set(false);
    driver.host.readonly.set(true);
    driver.tick();

    driver.selectCountry('fr');
    driver.clearValue();

    expect(driver.host.value()).toBe('+491711234567');
    expect(driver.field().readOnly).toBe(true);
  });

  it('reports an implausibly short or long national number', () => {
    driver.host.value.set('+49123');
    driver.tick();
    expect(driver.phone.isPlausible()).toBe(false);

    driver.host.value.set('+49123456789012345');
    driver.tick();
    expect(driver.phone.isPlausible()).toBe(false);

    driver.host.value.set('+491234');
    driver.tick();
    expect(driver.phone.isPlausible()).toBe(true);
  });
});
