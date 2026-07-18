import { DestroyRef, Directive, computed, inject, input, linkedSignal, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { PHONE_COUNTRIES, matchCountryByDialCode, stripTrunkZero } from './phone-countries';
import { PhoneInputFieldDirective } from './phone-input-field.directive';
import { PhoneInputFlagDirective } from './phone-input-flag.directive';

const onlyDigits = (raw: string) => raw.replace(/\D/g, '');

@Directive({
  selector: '[etPhoneInput]',
  exportAs: 'etPhoneInput',
})
export class PhoneInputDirective implements FormValueControl<string>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  /** Normalized `+<dialCode><national digits>` — empty string while nothing is entered. */
  public value = model('');
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');
  public placeholder = input('');

  public defaultCountry = input('us');
  /** ISO codes listed on top of the country dropdown. */
  public preferredCountries = input<string[]>([]);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value().length > 0);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.PHONE_INPUT);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public registeredField = signal<PhoneInputFieldDirective | null>(null);
  /** @internal Replaces the emoji flags in the trigger and the option list. */
  public registeredFlagTemplate = signal<PhoneInputFlagDirective | null>(null);

  public interactive = computed(() => !this.disabled() && !this.readonly());

  /**
   * The active country's ISO code: derived from the value's dial code, manually selectable.
   * A manual pick survives value edits as long as its dial code still fits — dial codes are
   * shared (`+1` → US, CA, …) and typing digits must not flip a chosen country.
   */
  public country = linkedSignal<string | null, string>({
    source: () => matchCountryByDialCode(onlyDigits(this.value()))?.iso2 ?? null,
    computation: (matched, previous) => {
      const fallback = previous?.value ?? this.defaultCountry();

      if (!matched) {
        return fallback;
      }

      const matchedDial = this.dialCodeOf(matched);

      return this.dialCodeOf(fallback) === matchedDial && previous !== undefined ? fallback : matched;
    },
  });

  public dialCode = computed(() => this.dialCodeOf(this.country()));

  /** The digits after the dial code. */
  public nationalNumber = computed(() => {
    const digits = onlyDigits(this.value());
    const dialCode = this.dialCode();

    return digits.startsWith(dialCode) ? digits.slice(dialCode.length) : digits;
  });

  /**
   * Cosmetic display grouping (groups of three) — deliberately **not** metadata-driven
   * per-country formatting; real validation belongs to the backend/schema.
   */
  public formattedNational = computed(() =>
    this.nationalNumber()
      .replace(/(\d{3})(?=\d)/g, '$1 ')
      .trim(),
  );

  /** A cheap length-window sanity check (4–14 national digits) — not real validation. */
  public isPlausible = computed(() => {
    const length = this.nationalNumber().length;

    return length >= 4 && length <= 14;
  });

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    this.registeredField()?.focus();
  }

  /** Clears the number (the selected country stays) — wired to the styled input's clear button. */
  public clearValue() {
    if (!this.interactive()) {
      return;
    }

    this.value.set('');

    // the tel field shows raw digits while focused (blur reformats) — a clear happens
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

      this.value.set(international ? `+${international}` : '');

      return;
    }

    const national = stripTrunkZero(digits, this.country());

    this.value.set(national ? `+${this.dialCode()}${national}` : '');
  }

  private dialCodeOf(iso2: string) {
    return PHONE_COUNTRIES.find((country) => country.iso2 === iso2)?.dialCode ?? '';
  }
}
