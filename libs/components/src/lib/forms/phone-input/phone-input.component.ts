import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { ColorInteractiveDirective, injectLocale } from '@ethlete/core';
import { SELECT_IMPORTS } from '../select';
import { FORM_FIELD_TOKEN } from '../form-field/headless';
import {
  PHONE_COUNTRIES,
  PhoneInputDirective,
  PhoneInputFieldDirective,
  phoneCountryFlag,
  phoneCountryName,
} from './headless';

@Component({
  selector: 'et-phone-input',
  templateUrl: './phone-input.component.html',
  styleUrl: './phone-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...SELECT_IMPORTS, PhoneInputFieldDirective],
  // the country picker is a full [etSelect] composition living INSIDE this control — the
  // barrier stops it from registering itself as the surrounding form field's control
  viewProviders: [{ provide: FORM_FIELD_TOKEN, useValue: null }],
  hostDirectives: [
    {
      directive: PhoneInputDirective,
      inputs: [
        'value',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'placeholder',
        'defaultCountry',
        'preferredCountries',
      ],
      outputs: ['valueChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-phone-input',
  },
})
export class PhoneInputComponent {
  protected phone = inject(PhoneInputDirective);
  private locale = injectLocale();

  protected countries = computed(() => {
    const locale = this.locale.currentLocale();
    const preferred = this.phone.preferredCountries();
    const entries = PHONE_COUNTRIES.map((country) => ({
      ...country,
      name: phoneCountryName(country.iso2, locale),
      flag: phoneCountryFlag(country.iso2),
    }));
    const preferredEntries = preferred
      .map((iso2) => entries.find((entry) => entry.iso2 === iso2))
      .filter((entry) => entry !== undefined);
    const rest = entries
      .filter((entry) => !preferred.includes(entry.iso2))
      .sort((a, b) => a.name.localeCompare(b.name, locale));

    return [...preferredEntries, ...rest];
  });

  protected activeFlag = computed(() => phoneCountryFlag(this.phone.country()));

  protected handleCountryChange(value: unknown) {
    if (typeof value === 'string') {
      this.phone.selectCountry(value);
    }
  }
}
