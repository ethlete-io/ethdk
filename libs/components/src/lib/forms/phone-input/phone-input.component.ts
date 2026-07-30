import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, booleanAttribute, computed, inject, input } from '@angular/core';
import { ColorInteractiveDirective, injectLocale } from '@ethlete/core';
import { IconDirective, TIMES_ICON, provideIcons } from '../../icon';
import { SELECT_IMPORTS } from '../select';
import { FORM_FIELD_TOKEN } from '../form-field/headless';
import {
  PHONE_COUNTRIES,
  PhoneInputDirective,
  PhoneInputFieldDirective,
  PhoneInputFlagContext,
  phoneCountryFlag,
  phoneCountryName,
} from './headless';
import { injectFormFieldLabels } from '../../forms/form-field/form-field-labels';
import { injectPhoneInputLabels } from '../../forms/phone-input/phone-input-labels';

@Component({
  selector: 'et-phone-input',
  templateUrl: './phone-input.component.html',
  styleUrl: './phone-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...SELECT_IMPORTS, PhoneInputFieldDirective, NgTemplateOutlet, IconDirective],
  providers: [provideIcons(TIMES_ICON)],
  // the country picker is a full [etSelect] composition living INSIDE this control — the
  // barrier stops it from registering itself as the surrounding form field's control
  viewProviders: [{ provide: FORM_FIELD_TOKEN, useValue: null }],
  hostDirectives: [
    {
      directive: PhoneInputDirective,
      inputs: [
        'value',
        'mixed',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'placeholder',
        'mixedLabel',
        'defaultCountry',
        'preferredCountries',
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-phone-input',
  },
})
export class PhoneInputComponent {
  protected phoneInputLabels = injectPhoneInputLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected phone = inject(PhoneInputDirective);
  private locale = injectLocale();

  /** Accessible name of the country-picker trigger — its only visible content is the flag + dial code. */
  public countryLabel = input<string | null>(null);
  /** Shows a clear (×) control while a number is set and the field is in use. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  /** The string in effect: this instance's `countryLabel`, else the domain's label set. */
  protected resolvedCountryLabel = computed(() => this.countryLabel() ?? this.phoneInputLabels().selectCountry);

  /** The string in effect: this instance's `clearLabel`, else `FORM_FIELD_LABELS`. */
  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  // only while the field is in use — mirrors the select's clear affordance
  protected showClear = computed(
    () => this.clearable() && this.phone.hasValue() && this.phone.focused() && this.phone.interactive(),
  );

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

  protected activeFlagContext = computed<PhoneInputFlagContext>(() => {
    const iso2 = this.phone.country();

    return {
      $implicit: { iso2, dialCode: this.phone.dialCode(), flag: phoneCountryFlag(iso2) },
    };
  });

  protected handleClearClick(event: Event) {
    // clearing must not bubble into the form field's frame-click handling
    event.stopPropagation();
    this.phone.clearValue();
  }

  protected handleCountryChange(value: unknown) {
    if (typeof value === 'string') {
      this.phone.selectCountry(value);
      // a picked prefix hands focus to the number field (the natural next step is typing the
      // number) — done before the picker closes, so its close refocus leaves it there
      this.phone.activate();
    }
  }
}
