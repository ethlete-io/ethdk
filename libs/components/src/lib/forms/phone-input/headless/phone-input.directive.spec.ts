import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { PHONE_INPUT_IMPORTS } from '../phone-input.imports';
import { PhoneInputDirective } from './phone-input.directive';
import { matchCountryByDialCode, phoneCountryFlag } from './phone-countries';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';

@Component({
  template: `
    <et-phone-input
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      defaultCountry="de"
      placeholder="Phone number"
    />
  `,
  imports: [PHONE_INPUT_IMPORTS],
})
class PhoneInputTestHost {
  value = signal('');
  mixed = signal(false);
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
  let fixture: ComponentFixture<PhoneInputTestHost>;
  let phone: PhoneInputDirective;
  let field: HTMLInputElement;

  const type = (raw: string) => {
    field.value = raw;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PhoneInputTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(PhoneInputTestHost);
    fixture.detectChanges();
    phone = fixture.debugElement.children[0]!.injector.get(PhoneInputDirective);
    field = fixture.nativeElement.querySelector('.et-phone-input-field');
  });

  it('starts on the default country with an empty value', () => {
    expect(phone.country()).toBe('de');
    expect(phone.dialCode()).toBe('49');
    expect(fixture.componentInstance.value()).toBe('');
  });

  it('renders a clear control while the focused field has a value and clears on click', () => {
    const clearButton = () => fixture.nativeElement.querySelector('.et-input-clear') as HTMLButtonElement | null;

    expect(clearButton()).toBeNull();

    field.focus();
    field.dispatchEvent(new Event('focus'));
    type('170 123');

    expect(clearButton()).not.toBeNull();

    clearButton()!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe('');
    expect(field.value).toBe('');
    // the selected country survives the clear
    expect(phone.country()).toBe('de');
    expect(clearButton()).toBeNull();
  });

  it('normalizes typed national digits into +dial value', () => {
    type('170 123');

    expect(fixture.componentInstance.value()).toBe('+49170123');
    expect(phone.nationalNumber()).toBe('170123');
  });

  it('strips the national trunk 0 ("0170…" means +49170…)', () => {
    type('0170 1234567');

    expect(fixture.componentInstance.value()).toBe('+491701234567');
    expect(phone.nationalNumber()).toBe('1701234567');
  });

  it('keeps the leading 0 for countries where it is part of the number', () => {
    phone.selectCountry('it');
    fixture.detectChanges();
    type('06 6981');

    expect(fixture.componentInstance.value()).toBe('+39066981');
    expect(phone.nationalNumber()).toBe('066981');
  });

  it('treats the 00 international call prefix like +', () => {
    type('0033 1 23 45 67 89');

    expect(phone.country()).toBe('fr');
    expect(fixture.componentInstance.value()).toBe('+33123456789');
  });

  it('re-derives the country from a pasted international number', () => {
    type('+33 1 23 45 67 89');

    expect(phone.country()).toBe('fr');
    expect(phone.dialCode()).toBe('33');
    expect(fixture.componentInstance.value()).toBe('+33123456789');
  });

  it('switches the country while keeping the national number', () => {
    type('123456789');
    phone.selectCountry('at');
    fixture.detectChanges();

    expect(phone.country()).toBe('at');
    expect(fixture.componentInstance.value()).toBe('+43123456789');
    expect(phone.nationalNumber()).toBe('123456789');
  });

  it('keeps a manually selected country when the dial code is shared', () => {
    phone.selectCountry('ca');
    fixture.detectChanges();
    type('2025550123');

    // +1 matches the US first, but Canada was chosen explicitly
    expect(phone.country()).toBe('ca');
    expect(fixture.componentInstance.value()).toBe('+12025550123');
  });

  it('derives the country from an external value', () => {
    fixture.componentInstance.value.set('+818012345678');
    fixture.detectChanges();

    expect(phone.country()).toBe('jp');
    expect(phone.nationalNumber()).toBe('8012345678');
  });

  it('groups the display while unfocused and shows raw digits while editing', () => {
    fixture.componentInstance.value.set('+491701234567');
    fixture.detectChanges();

    expect(phone.formattedNational()).toBe('170 123 456 7');
    expect(field.value).toBe('170 123 456 7');

    field.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(field.value).toBe('1701234567');

    field.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(field.value).toBe('170 123 456 7');
  });

  it('exposes a plausibility window, not real validation', () => {
    type('123');
    expect(phone.isPlausible()).toBe(false);

    type('1234567');
    expect(phone.isPlausible()).toBe(true);
  });

  describe('mixed', () => {
    const enterMixed = (raw: string) => {
      fixture.componentInstance.value.set(raw);
      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();
    };

    it('masks the hidden number in every display path while the raw value survives', () => {
      enterMixed('+491701234567');

      expect(phone.nationalNumber()).toBe('');
      expect(phone.formattedNational()).toBe('');
      expect(field.value).toBe('');
      expect(field.getAttribute('placeholder')).toBe('Mixed');
      expect(fixture.componentInstance.value()).toBe('+491701234567');

      // focusing for editing must not surface the hidden digits either
      field.dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      expect(field.value).toBe('');
    });

    it('updates only the country presentation on selectCountry - no value write, mixed stays', () => {
      enterMixed('+491701234567');

      phone.selectCountry('fr');
      fixture.detectChanges();

      expect(phone.country()).toBe('fr');
      expect(phone.dialCode()).toBe('33');
      expect(fixture.componentInstance.value()).toBe('+491701234567');
      expect(fixture.componentInstance.mixed()).toBe(true);
      expect(field.value).toBe('');
    });

    it('builds the first committed number from scratch with the chosen country and resolves mixed', () => {
      enterMixed('+491701234567');

      phone.selectCountry('fr');
      fixture.detectChanges();
      type('612345678');

      expect(fixture.componentInstance.value()).toBe('+33612345678');
      expect(fixture.componentInstance.mixed()).toBe(false);
      expect(phone.nationalNumber()).toBe('612345678');
    });

    it('keeps mixed and the raw value when the typed input produces no value', () => {
      enterMixed('+491701234567');

      type('');

      expect(fixture.componentInstance.value()).toBe('+491701234567');
      expect(fixture.componentInstance.mixed()).toBe(true);
    });

    it('clears to the empty value and resolves mixed', () => {
      enterMixed('+491701234567');

      phone.clearValue();
      fixture.detectChanges();

      expect(fixture.componentInstance.value()).toBe('');
      expect(fixture.componentInstance.mixed()).toBe(false);
    });

    it('preserves mixed across external value writes', () => {
      enterMixed('+491701234567');

      fixture.componentInstance.value.set('+33123456789');
      fixture.detectChanges();

      expect(fixture.componentInstance.mixed()).toBe(true);
      expect(field.value).toBe('');
    });
  });
});

describe('PhoneInputDirective (contract)', () => {
  describeMixedStateContract(() => {
    TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

    const fixture = TestBed.createComponent(PhoneInputTestHost);

    fixture.detectChanges();

    const phone = fixture.debugElement.children[0]!.injector.get(PhoneInputDirective);
    const field = fixture.nativeElement.querySelector('.et-phone-input-field') as HTMLInputElement;

    return {
      enterMixed: () => {
        fixture.componentInstance.value.set('+491701234567');
        fixture.componentInstance.mixed.set(true);
        fixture.detectChanges();
      },
      rawValue: () => '+491701234567',
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.nativeElement.querySelector('et-phone-input') as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set('+33123456789');
        fixture.detectChanges();
      },
      externallyWrittenValue: () => '+33123456789',
      commit: () => {
        field.value = '170555';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
      },
      // replace semantics: built from scratch with the active country, no hidden digits
      committedValue: () => '+49170555',
      assertMasked: () => {
        expect(phone.formattedNational()).toBe('');
        expect(field.value).toBe('');
        expect(field.getAttribute('placeholder')).toBe('Mixed');
      },
      clear: () => {
        phone.clearValue();
        fixture.detectChanges();
      },
      emptyValue: () => '',
    };
  });
});
