import { Directive, computed, input, linkedSignal, model, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES } from '../../form-field/headless';
import { PHONE_COUNTRIES, matchCountryByDialCode, stripTrunkZero } from './phone-countries';
import { PhoneInputFieldDirective } from './phone-input-field.directive';
import { PhoneInputFlagDirective } from './phone-input-flag.directive';
import { mountControlSuffixStyles } from '../../form-field/form-field-control-suffix-styles.component';
import { TextShellControlDirective } from '../../form-field/headless/text-shell-control.directive';

const onlyDigits = (raw: string) => raw.replace(/\D/g, '');

@Directive({
  selector: '[etPhoneInput]',
  exportAs: 'etPhoneInput',
  host: {
    '[attr.data-disabled]': 'disabled() || null',
    '[attr.data-readonly]': 'readonly() || null',
  },
})
export class PhoneInputDirective extends TextShellControlDirective implements FormValueControl<string> {
  /** Normalized `+<dialCode><national digits>` - empty string while nothing is entered. */
  public value = model('');
  public placeholder = input('');

  public defaultCountry = input('us');
  /** ISO codes listed on top of the country dropdown. */
  public preferredCountries = input<string[]>([]);

  public hasValue = computed(() => this.mixed() || this.value().length > 0);

  /** The placeholder the tel field currently shows - `mixedLabel` while mixed. */
  public effectivePlaceholder = computed(() => (this.mixed() ? this.resolvedMixedLabel() : this.placeholder()));

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.PHONE_INPUT);

  /** @internal */
  public registeredField = signal<PhoneInputFieldDirective | null>(null);
  /** @internal Replaces the emoji flags in the trigger and the option list. */
  public registeredFlagTemplate = signal<PhoneInputFlagDirective | null>(null);

  public interactive = computed(() => !this.disabled() && !this.readonly());

  private countryPicked = false;

  /**
   * The active country's ISO code: derived from the value's dial code, manually selectable.
   * A manual pick survives value edits as long as its dial code still fits - dial codes are
   * shared (`+1` → US, CA, …) and typing digits must not flip a chosen country.
   */
  public country = linkedSignal<{ matched: string | null; fallback: string }, string>({
    source: () => ({
      matched: matchCountryByDialCode(onlyDigits(this.value()))?.iso2 ?? null,
      fallback: this.defaultCountry(),
    }),
    computation: (source, previous) => {
      // a defaultCountry that resolves late (a locale or geo lookup) still lands, but only while
      // nothing has moved the country off the previous default
      const followsDefault =
        previous === undefined || (!this.countryPicked && previous.value === previous.source.fallback);
      const fallback = followsDefault ? source.fallback : previous.value;

      if (!source.matched) {
        return fallback;
      }

      const matchedDial = this.dialCodeOf(source.matched);

      return this.dialCodeOf(fallback) === matchedDial && previous !== undefined ? fallback : source.matched;
    },
  });

  public dialCode = computed(() => this.dialCodeOf(this.country()));

  /** The digits after the dial code. Mixed masks the hidden raw number - it is never displayed. */
  public nationalNumber = computed(() => {
    if (this.mixed()) {
      return '';
    }

    const digits = onlyDigits(this.value());
    const dialCode = this.dialCode();

    return digits.startsWith(dialCode) ? digits.slice(dialCode.length) : digits;
  });

  /**
   * Cosmetic display grouping (groups of three) - deliberately **not** metadata-driven
   * per-country formatting; real validation belongs to the backend/schema.
   */
  public formattedNational = computed(() =>
    this.nationalNumber()
      .replace(/(\d{3})(?=\d)/g, '$1 ')
      .trim(),
  );

  /** A cheap length-window sanity check (4–14 national digits) - not real validation. */
  public isPlausible = computed(() => {
    const length = this.nationalNumber().length;

    return length >= 4 && length <= 14;
  });

  constructor() {
    super();

    mountControlSuffixStyles();
  }

  /** Clears the number (the selected country stays) - wired to the styled input's clear button. */
  public clearValue() {
    if (!this.interactive()) {
      return;
    }

    this.value.set('');
    this.mixed.set(false);

    // the tel field shows raw digits while focused (blur reformats) - a clear happens
    // while focused, so reset the element text directly
    const field = this.registeredField();

    if (field) {
      field.elementRef.nativeElement.value = '';
    }
  }

  /** Switches the country, keeping the national number. */
  public selectCountry(iso2: string) {
    if (!this.interactive() || !PHONE_COUNTRIES.some((country) => country.iso2 === iso2)) {
      return;
    }

    this.countryPicked = true;

    // while mixed a country pick is preparatory (like opening a select): it updates the
    // presentation only - rebuilding a value would leak the hidden national number, and
    // mixed resolves only once a national number is committed
    if (this.mixed()) {
      this.country.set(iso2);

      return;
    }

    const national = this.nationalNumber();

    this.country.set(iso2);
    this.value.set(national ? `+${this.dialCodeOf(iso2)}${national}` : '');
  }

  /**
   * @internal Wired to the tel field. Raw text starting with `+` (or the `00` international
   * call prefix) re-derives the country by longest dial-code match; anything else is national
   * digits for the active country, with a national trunk `0` stripped where applicable
   * (`0171…` with Germany active → `+49171…`).
   */
  public setNationalInput(raw: string) {
    const trimmed = raw.trim();
    const digits = onlyDigits(trimmed);

    if (trimmed.startsWith('+') || digits.startsWith('00')) {
      const international = digits.startsWith('00') ? digits.slice(2) : digits;

      this.commitTypedValue(international ? `+${international}` : '');

      return;
    }

    const national = stripTrunkZero(digits, this.country());

    this.commitTypedValue(national ? `+${this.dialCode()}${national}` : '');
  }

  public focusControl(options?: FocusOptions) {
    this.registeredField()?.focus(options);
  }

  /**
   * Writes a user-typed value. While mixed, only a non-empty entry commits - it is built
   * from scratch with the chosen country (never from the hidden number) and resolves mixed;
   * an empty entry leaves the hidden raw value untouched.
   */
  private commitTypedValue(next: string) {
    if (this.mixed()) {
      if (!next) {
        return;
      }

      this.mixed.set(false);
    }

    this.value.set(next);
  }

  private dialCodeOf(iso2: string) {
    return PHONE_COUNTRIES.find((country) => country.iso2 === iso2)?.dialCode ?? '';
  }
}
