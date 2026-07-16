import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { PHONE_INPUT_IMPORTS } from '../phone-input.imports';
import { PhoneInputDirective } from './phone-input.directive';
import { matchCountryByDialCode, phoneCountryFlag } from './phone-countries';

const TEST_COLOR_THEMES = [
  {
    name: 'default',
    isDefault: true,
    primary: {
      color: {
        default: '0 255 161',
        hover: '76 247 184',
        focus: '76 247 184',
        active: '0 198 126',
        disabled: '0 122 77',
      },
      onColor: {
        default: '0 0 0',
        disabled: '0 36 23',
      },
    },
  },
] as const;

@Component({
  template: `
    <et-phone-input
      [value]="value()"
      (valueChange)="value.set($event)"
      defaultCountry="de"
      placeholder="Phone number"
    />
  `,
  imports: [PHONE_INPUT_IMPORTS],
})
class PhoneInputTestHost {
  value = signal('');
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
});
