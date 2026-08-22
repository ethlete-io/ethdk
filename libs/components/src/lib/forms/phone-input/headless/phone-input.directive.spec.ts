import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { mountPhoneInput, PhoneInputDriver } from '../../testing/phone-input-driver';
import { PHONE_INPUT_IMPORTS } from '../phone-input.imports';
import { matchCountryByDialCode, phoneCountryFlag } from './phone-countries';

@Component({
  template: `
    <et-phone-input
      [value]="value()"
      [mixed]="mixed()"
      [defaultCountry]="defaultCountry()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      placeholder="Phone number"
    />
  `,
  imports: [PHONE_INPUT_IMPORTS],
})
class PhoneInputTestHost {
  value = signal('');
  mixed = signal(false);
  defaultCountry = signal('de');
}

describe('phone-countries', () => {
  it('matches the longest dial code', () => {
    expect(matchCountryByDialCode('4917012345')?.iso2).toBe('de');
    expect(matchCountryByDialCode('12025550123')?.iso2).toBe('us');
    expect(matchCountryByDialCode('35112345')?.iso2).toBe('pt');
    expect(matchCountryByDialCode('')).toBeNull();
  });

  it('computes regional-indicator flags', () => {
    expect(phoneCountryFlag('de')).toBe('🇩🇪');
    expect(phoneCountryFlag('us')).toBe('🇺🇸');
  });
});

describe('PhoneInputDirective', () => {
  let driver: PhoneInputDriver<PhoneInputTestHost>;

  beforeEach(() => {
    driver = mountPhoneInput(PhoneInputTestHost);
  });

  it('starts on the default country with an empty value', () => {
    expect(driver.phone.country()).toBe('de');
    expect(driver.phone.dialCode()).toBe('49');
    expect(driver.host.value()).toBe('');
  });

  it('renders a clear control while the focused field has a value and clears on click', () => {
    expect(driver.clearButton()).toBeNull();

    driver.focus();
    driver.typeChars('170 123');

    expect(driver.clearButton()).not.toBeNull();

    driver.click(driver.clearButton()!);

    expect(driver.host.value()).toBe('');
    expect(driver.fieldValue()).toBe('');
    // the selected country survives the clear
    expect(driver.phone.country()).toBe('de');
    expect(driver.clearButton()).toBeNull();
  });

  it('normalizes typed national digits into +dial value', () => {
    driver.typeChars('170 123');

    expect(driver.host.value()).toBe('+49170123');
    expect(driver.phone.nationalNumber()).toBe('170123');
  });

  it('strips the national trunk 0 ("0170…" means +49170…)', () => {
    driver.typeChars('0170 1234567');

    expect(driver.host.value()).toBe('+491701234567');
    expect(driver.phone.nationalNumber()).toBe('1701234567');
  });

  it('keeps the leading 0 for countries where it is part of the number', () => {
    driver.selectCountry('it');
    driver.typeChars('06 6981');

    expect(driver.host.value()).toBe('+39066981');
    expect(driver.phone.nationalNumber()).toBe('066981');
  });

  it('treats the 00 international call prefix like +', () => {
    driver.typeChars('0033 1 23 45 67 89');

    expect(driver.phone.country()).toBe('fr');
    expect(driver.host.value()).toBe('+33123456789');
  });

  it('re-derives the country from an international number typed one character at a time', () => {
    driver.focus();
    driver.typeChars('+33123456789');

    expect(driver.phone.country()).toBe('fr');
    expect(driver.host.value()).toBe('+33123456789');

    driver.blur();

    expect(driver.phone.nationalNumber()).toBe('123456789');
    expect(driver.fieldValue()).toBe('123 456 789');
  });

  it('re-derives the country from a pasted international number', () => {
    // one input event for the whole string is what a paste produces
    driver.type('+33 1 23 45 67 89');

    expect(driver.phone.country()).toBe('fr');
    expect(driver.phone.dialCode()).toBe('33');
    expect(driver.host.value()).toBe('+33123456789');
  });

  it('switches the country while keeping the national number', () => {
    driver.typeChars('123456789');
    driver.selectCountry('at');

    expect(driver.phone.country()).toBe('at');
    expect(driver.host.value()).toBe('+43123456789');
    expect(driver.phone.nationalNumber()).toBe('123456789');
  });

  it('keeps a manually selected country when the dial code is shared', () => {
    driver.selectCountry('ca');
    driver.typeChars('2025550123');

    // +1 matches the US first, but Canada was chosen explicitly
    expect(driver.phone.country()).toBe('ca');
    expect(driver.host.value()).toBe('+12025550123');
  });

  it('adopts a defaultCountry that resolves after the first render', () => {
    driver.host.defaultCountry.set('fr');
    driver.tick();

    expect(driver.phone.country()).toBe('fr');
    expect(driver.phone.dialCode()).toBe('33');
  });

  it('leaves a manually picked country alone when a late defaultCountry arrives', () => {
    driver.selectCountry('at');

    driver.host.defaultCountry.set('fr');
    driver.tick();

    expect(driver.phone.country()).toBe('at');
  });

  it('leaves a country derived from the value alone when a late defaultCountry arrives', () => {
    driver.host.value.set('+818012345678');
    driver.tick();

    driver.host.defaultCountry.set('fr');
    driver.tick();

    expect(driver.phone.country()).toBe('jp');
  });

  it('derives the country from an external value', () => {
    driver.host.value.set('+818012345678');
    driver.tick();

    expect(driver.phone.country()).toBe('jp');
    expect(driver.phone.nationalNumber()).toBe('8012345678');
  });

  it('groups the display while unfocused and shows raw digits while editing', () => {
    driver.host.value.set('+491701234567');
    driver.tick();

    expect(driver.phone.formattedNational()).toBe('170 123 456 7');
    expect(driver.fieldValue()).toBe('170 123 456 7');

    driver.focus();
    expect(driver.fieldValue()).toBe('1701234567');

    driver.blur();
    expect(driver.fieldValue()).toBe('170 123 456 7');
  });

  it('exposes a plausibility window, not real validation', () => {
    driver.type('123');
    expect(driver.phone.isPlausible()).toBe(false);

    driver.type('1234567');
    expect(driver.phone.isPlausible()).toBe(true);
  });

  describe('mixed', () => {
    const enterMixed = (raw: string) => {
      driver.host.value.set(raw);
      driver.host.mixed.set(true);
      driver.tick();
    };

    it('masks the hidden number in every display path while the raw value survives', () => {
      enterMixed('+491701234567');

      expect(driver.phone.nationalNumber()).toBe('');
      expect(driver.phone.formattedNational()).toBe('');
      expect(driver.fieldValue()).toBe('');
      expect(driver.placeholder()).toBe('Mixed');
      expect(driver.host.value()).toBe('+491701234567');

      // focusing for editing must not surface the hidden digits either
      driver.focus();

      expect(driver.fieldValue()).toBe('');
    });

    it('updates only the country presentation on selectCountry - no value write, mixed stays', () => {
      enterMixed('+491701234567');

      driver.selectCountry('fr');

      expect(driver.phone.country()).toBe('fr');
      expect(driver.phone.dialCode()).toBe('33');
      expect(driver.host.value()).toBe('+491701234567');
      expect(driver.host.mixed()).toBe(true);
      expect(driver.fieldValue()).toBe('');
    });

    it('builds the first committed number from scratch with the chosen country and resolves mixed', () => {
      enterMixed('+491701234567');

      driver.selectCountry('fr');
      driver.typeChars('612345678');

      expect(driver.host.value()).toBe('+33612345678');
      expect(driver.host.mixed()).toBe(false);
      expect(driver.phone.nationalNumber()).toBe('612345678');
    });

    it('keeps mixed and the raw value when the typed input produces no value', () => {
      enterMixed('+491701234567');

      driver.type('');

      expect(driver.host.value()).toBe('+491701234567');
      expect(driver.host.mixed()).toBe(true);
    });

    it('clears to the empty value and resolves mixed', () => {
      enterMixed('+491701234567');

      driver.clearValue();

      expect(driver.host.value()).toBe('');
      expect(driver.host.mixed()).toBe(false);
    });

    it('preserves mixed across external value writes', () => {
      enterMixed('+491701234567');

      driver.host.value.set('+33123456789');
      driver.tick();

      expect(driver.host.mixed()).toBe(true);
      expect(driver.fieldValue()).toBe('');
    });
  });
});

describe('PhoneInputDirective (contract)', () => {
  describeMixedStateContract(() => {
    const driver = mountPhoneInput(PhoneInputTestHost);

    return {
      enterMixed: () => {
        driver.host.value.set('+491701234567');
        driver.host.mixed.set(true);
        driver.tick();
      },
      rawValue: () => '+491701234567',
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.hostEl(),
      writeValueExternally: () => {
        driver.host.value.set('+33123456789');
        driver.tick();
      },
      externallyWrittenValue: () => '+33123456789',
      commit: () => driver.type('170555'),
      // replace semantics: built from scratch with the active country, no hidden digits
      committedValue: () => '+49170555',
      assertMasked: () => {
        expect(driver.phone.formattedNational()).toBe('');
        expect(driver.fieldValue()).toBe('');
        expect(driver.placeholder()).toBe('Mixed');
      },
      clear: () => driver.clearValue(),
      emptyValue: () => '',
    };
  });
});
