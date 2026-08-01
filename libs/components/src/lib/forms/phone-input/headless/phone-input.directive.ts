import {
  DestroyRef,
  Directive,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  signal,
} from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { PHONE_COUNTRIES, matchCountryByDialCode, stripTrunkZero } from './phone-countries';
import { PhoneInputFieldDirective } from './phone-input-field.directive';
import { PhoneInputFlagDirective } from './phone-input-flag.directive';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { mountTextFieldShellStyles } from '../../form-field/form-field-text-shell-styles.component';

const onlyDigits = (raw: string) => raw.replace(/\D/g, '');

@Directive({
  selector: '[etPhoneInput]',
  exportAs: 'etPhoneInput',
  host: {
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export class PhoneInputDirective implements FormValueControl<string>, FormFieldControl {
  private formFieldLabels = injectFormFieldLabels();

  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  /** Normalized `+<dialCode><national digits>` — empty string while nothing is entered. */
  public value = model('');
  /** View state for a field whose source values disagree. The raw form value stays untouched. */
  public mixed = model(false);
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');
  public placeholder = input('');
  /** Field placeholder shown while `mixed` is set. */
  public mixedLabel = input<string | null>(null);

  public defaultCountry = input('us');
  /** ISO codes listed on top of the country dropdown. */
  public preferredCountries = input<string[]>([]);

  /** The string in effect: this instance's `mixedLabel`, else `FORM_FIELD_LABELS`. */
  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.mixed() || this.value().length > 0);

  /** The placeholder the tel field currently shows — `mixedLabel` while mixed. */
  public effectivePlaceholder = computed(() => (this.mixed() ? this.resolvedMixedLabel() : this.placeholder()));

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

  /** The digits after the dial code. Mixed masks the hidden raw number — it is never displayed. */
  public nationalNumber = computed(() => {
    if (this.mixed()) {
      return '';
    }

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
    mountTextFieldShellStyles();

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
    this.mixed.set(false);

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

    // while mixed a country pick is preparatory (like opening a select): it updates the
    // presentation only — rebuilding a value would leak the hidden national number, and
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

  /**
   * Writes a user-typed value. While mixed, only a non-empty entry commits — it is built
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
