import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { expectDescribedByPointsAtErrors } from '../../testing/described-by';
import { FORM_FIELD_IMPORTS } from '../../form-field/form-field.imports';
import { mountControl } from '../../../testing/control-driver';
import { flushFrames, latestPane } from '../../../testing/driver-core';
import { resolveAccessibleName } from '../../testing/accessible-name';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { mountPhoneInput, PhoneInputDriver } from '../../testing/phone-input-driver';
import { PHONE_INPUT_IMPORTS } from '../phone-input.imports';
import { phoneCountryName } from './phone-countries';
import { PHONE_COUNTRIES, matchCountryByDialCode, phoneCountryFlag, stripTrunkZero } from './phone-countries';

@Component({
  template: `
    <et-phone-input
      [value]="value()"
      [mixed]="mixed()"
      [defaultCountry]="defaultCountry()"
      [preferredCountries]="preferredCountries()"
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
  preferredCountries = signal<string[]>([]);
}

describe('phone-countries', () => {
  it('matches the longest dial code', () => {
    expect(matchCountryByDialCode('4917012345')?.iso2).toBe('de');
    expect(matchCountryByDialCode('12025550123')?.iso2).toBe('us');
    expect(matchCountryByDialCode('35112345')?.iso2).toBe('pt');
    expect(matchCountryByDialCode('')).toBeNull();
  });

  it('matches the NANP countries that share +1 by their area code', () => {
    expect(matchCountryByDialCode('18765550123')?.iso2).toBe('jm');
    expect(matchCountryByDialCode('17875550123')?.iso2).toBe('pr');
    expect(matchCountryByDialCode('18095550123')?.iso2).toBe('do');
    expect(matchCountryByDialCode('12465550123')?.iso2).toBe('bb');
  });

  it('matches the further area codes of NANP countries that share +1', () => {
    expect(matchCountryByDialCode('18295550123')?.iso2).toBe('do');
    expect(matchCountryByDialCode('19395550123')?.iso2).toBe('pr');
    expect(matchCountryByDialCode('16585550123')?.iso2).toBe('jm');
    expect(matchCountryByDialCode('14165550123')?.iso2).toBe('ca');
    expect(matchCountryByDialCode('12125550123')?.iso2).toBe('us');
  });

  it('matches the ranges of countries that share a dial code', () => {
    expect(matchCountryByDialCode('77012345678')?.iso2).toBe('kz');
    expect(matchCountryByDialCode('74951234567')?.iso2).toBe('ru');
    expect(matchCountryByDialCode('441481123456')?.iso2).toBe('gg');
    expect(matchCountryByDialCode('447797123456')?.iso2).toBe('je');
    expect(matchCountryByDialCode('441624123456')?.iso2).toBe('im');
    expect(matchCountryByDialCode('442071234567')?.iso2).toBe('gb');
    expect(matchCountryByDialCode('35818123456')?.iso2).toBe('ax');
    expect(matchCountryByDialCode('390669812345')?.iso2).toBe('va');
  });

  it('lists the Crown Dependencies, Åland and Vatican City', () => {
    const codes = PHONE_COUNTRIES.map((country) => country.iso2);

    expect(codes).toEqual(expect.arrayContaining(['gg', 'je', 'im', 'ax', 'va']));
  });

  it('keeps every table entry unique and resolvable by its own dial code', () => {
    const codes = PHONE_COUNTRIES.map((country) => country.iso2);

    expect(new Set(codes).size).toBe(codes.length);

    for (const country of PHONE_COUNTRIES) {
      expect(country.iso2).toMatch(/^[a-z]{2}$/);
      expect(country.dialCode).toMatch(/^\d{1,4}$/);
      expect(matchCountryByDialCode(`${country.dialCode}5550123`)?.dialCode).toBe(country.dialCode);
    }
  });

  it('keeps the leading 0 where it belongs to the international number', () => {
    expect(stripTrunkZero('0701234567', 'ci')).toBe('0701234567');
    expect(stripTrunkZero('061234567', 'cg')).toBe('061234567');
    expect(stripTrunkZero('01701234567', 'de')).toBe('1701234567');
  });

  it('builds one Intl.DisplayNames per locale for the whole table', () => {
    const DisplayNames = Intl.DisplayNames;
    const construct = vi.spyOn(Intl, 'DisplayNames').mockImplementation(function (
      ...args: ConstructorParameters<typeof Intl.DisplayNames>
    ) {
      return new DisplayNames(...args);
    });

    const names = PHONE_COUNTRIES.map((country) => phoneCountryName(country.iso2, 'fr'));

    const constructions = construct.mock.calls.length;

    construct.mockRestore();

    expect(constructions).toBe(1);
    expect(names).toContain('Allemagne');
  });

  it('falls back to the upper-cased code for a locale Intl cannot read', () => {
    expect(phoneCountryName('de', '!!')).toBe('DE');
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

  it('derives a NANP country from an external +1 value with its area code', () => {
    driver.host.value.set('+18765550123');
    driver.tick();

    expect(driver.phone.country()).toBe('jm');
    expect(driver.phone.nationalNumber()).toBe('5550123');
  });

  it('shows and keeps a further NANP area code as the dial code', () => {
    driver.host.value.set('+18295550123');
    driver.tick();

    expect(driver.phone.country()).toBe('do');
    expect(driver.phone.dialCode()).toBe('1829');
    expect(driver.phone.nationalNumber()).toBe('5550123');

    driver.focus();
    driver.typeChars('4');

    expect(driver.host.value()).toBe('+182955501234');
    expect(driver.phone.country()).toBe('do');
  });

  it('shows a range inside a shared dial code under the shared dial code', () => {
    driver.host.value.set('+441481123456');
    driver.tick();

    expect(driver.phone.country()).toBe('gg');
    expect(driver.phone.dialCode()).toBe('44');
    expect(driver.phone.nationalNumber()).toBe('1481123456');
  });

  it('moves off a picked country when a typed number carries a longer prefix of another', () => {
    driver.selectCountry('us');
    driver.focus();
    driver.typeChars('+14165550123');

    expect(driver.phone.country()).toBe('ca');
    expect(driver.host.value()).toBe('+14165550123');
  });

  it('keeps the US while national digits that start with another NANP area code are typed', () => {
    driver.selectCountry('us');
    driver.focus();
    driver.typeChars('8765550123');

    expect(driver.phone.country()).toBe('us');
    expect(driver.host.value()).toBe('+18765550123');

    driver.selectCountry('jm');

    expect(driver.host.value()).toBe('+18768765550123');
    expect(driver.phone.country()).toBe('jm');

    driver.selectCountry('us');

    expect(driver.phone.country()).toBe('us');
    expect(driver.host.value()).toBe('+18765550123');
  });

  it('accepts upper-case ISO codes', () => {
    driver.host.defaultCountry.set('FR');
    driver.host.preferredCountries.set(['DE', 'At']);
    driver.tick();

    expect(driver.phone.country()).toBe('fr');
    expect(driver.phone.preferredCountries()).toEqual(['de', 'at']);

    driver.typeChars('0123456789');

    expect(driver.host.value()).toBe('+33123456789');

    driver.selectCountry('AT');

    expect(driver.phone.country()).toBe('at');
    expect(driver.host.value()).toBe('+43123456789');
  });

  it('warns in dev mode about an unknown ISO code', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    driver.host.defaultCountry.set('xx');
    driver.tick();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"xx"'));

    warn.mockRestore();
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

  it('leaves a manual pick of the current default alone when a late defaultCountry arrives', () => {
    driver.selectCountry('de');

    driver.host.defaultCountry.set('fr');
    driver.tick();

    expect(driver.phone.country()).toBe('de');
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

  it('names the country trigger with countryLabel, the active country and its dial code, closed and open', async () => {
    const trigger = driver.query('.et-phone-input-country-trigger')!;
    const [countryLabelId, selfId] = trigger.getAttribute('aria-labelledby')?.split(' ') ?? [];

    expect(document.getElementById(countryLabelId!)?.textContent).toBe('Select country');
    expect(selfId).toBe(trigger.id);
    expect(trigger.hasAttribute('aria-label')).toBe(false);
    expect(trigger.querySelector('.et-phone-input-country-flag')?.getAttribute('aria-hidden')).toBe('true');
    expect(trigger.querySelector('.et-phone-input-country-name')?.textContent).toBe(phoneCountryName('de'));
    expect(trigger.querySelector('.et-phone-input-dial-code')?.textContent).toBe('+49');

    driver.click(trigger);
    await flushFrames();
    driver.tick();
    await flushFrames();
    driver.tick();

    const search = latestPane()?.querySelector('input[etselectsearch]');

    expect(search).not.toBeNull();
    expect(resolveAccessibleName(search!)).toBe('Select country');
    expect(trigger.getAttribute('aria-labelledby')).toBe(`${countryLabelId} ${trigger.id}`);
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
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        driver.tick();
      },
      mixedLabel: () => 'Mixed',
      mixedDisplayText: () => driver.placeholder(),
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

@Component({
  template: `
    <et-form-field>
      <et-label>Phone</et-label>
      <et-phone-input [(touched)]="touched" [errors]="errors" invalid name="phone" />
      <et-hint>Include the area code</et-hint>
    </et-form-field>
  `,
  imports: [FORM_FIELD_IMPORTS, PHONE_INPUT_IMPORTS],
})
class PhoneInputInFormFieldTestHost {
  errors = [{ kind: 'required', message: 'Enter a phone number' }];

  touched = signal(true);
}

describe('phone input support region', () => {
  it('should describe the phone input by the rendered error', () => {
    const host = mountControl(PhoneInputInFormFieldTestHost).nativeElement as HTMLElement;

    expectDescribedByPointsAtErrors(host);
  });
});
