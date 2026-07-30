import { DestroyRef, Directive, booleanAttribute, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../../form-field/headless';
import { deriveDurationFormatSpec, formatDuration, parseDuration } from './internals/duration-format';
import { DurationInputFieldDirective } from './duration-input-field.directive';
import { injectFormFieldLabels } from '../../../../forms/form-field/form-field-labels';
import { injectDateTimeLabels } from '../../../../forms/date-time/date-time-labels';

/**
 * A duration form control whose value is a **total elapsed time in milliseconds**
 * (`number | null`), not a `Date` — a duration is a distinct scalar quantity, so it
 * stays out of the calendar/time `Date` system. Typed entry parses leniently on
 * blur/Enter against a configurable segment layout (`130` → `1:30` under `mm:ss`).
 */
@Directive({
  selector: '[etDurationInput]',
  exportAs: 'etDurationInput',
  host: {
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export class DurationInputDirective implements FormValueControl<number | null>, FormFieldControl {
  private dateTimeLabels = injectDateTimeLabels();

  private formFieldLabels = injectFormFieldLabels();

  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  /** Total elapsed milliseconds, or `null` while empty/unparseable. */
  public value = model<number | null>(null);
  /** View state for a field whose source values disagree (bulk edit). The raw form value stays untouched. */
  public mixed = model(false);
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');
  public placeholder = input('');
  /**
   * Field placeholder shown while `mixed` is set. Presentation only — the field stays
   * empty and the label shows through the placeholder slot; it never enters the form value.
   */
  public mixedLabel = input<string | null>(null);

  /** Message the form field shows when typed text can't be parsed as a duration. */
  public parseErrorMessage = input<string | null>(null);

  /** The segment layout: `h`/`m`/`s`/`S` token runs plus separators. @default `'mm:ss'` */
  public durationFormat = input('mm:ss');

  /** The string in effect: this instance's `mixedLabel`, else `FORM_FIELD_LABELS`. */
  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  /** The string in effect: this instance's `parseErrorMessage`, else the domain's label set. */
  public resolvedParseErrorMessage = computed(() => this.parseErrorMessage() ?? this.dateTimeLabels().invalidDuration);

  public spec = computed(() => deriveDurationFormatSpec(this.durationFormat()));

  /** The committed value formatted for display — masked (empty) while mixed. */
  public displayValue = computed(() => (this.mixed() ? '' : formatDuration(this.value(), this.spec())));

  /** The raw text currently in the field (tracked so unparseable input survives). */
  public inputText = signal('');

  /** Set when the last commit could not be parsed — the raw text is kept visible. */
  public parseError = signal(false);

  public focused = signal(false);

  public shouldDisplayError = computed(() => this.touched() && (this.invalid() || this.parseError()));
  public hasValue = computed(() => this.mixed() || this.value() !== null || this.inputText().trim().length > 0);

  /** What the field renders as its placeholder — `mixedLabel` while mixed masks the value. */
  public effectivePlaceholder = computed(() => (this.mixed() ? this.resolvedMixedLabel() : this.placeholder()));

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DURATION_INPUT);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public registeredField = signal<DurationInputFieldDirective | null>(null);

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

  /** Clears the value and any uncommitted field text — wired to the styled input's clear button. */
  public clearValue() {
    if (this.disabled() || this.readonly()) {
      return;
    }

    this.value.set(null);
    this.mixed.set(false);
    this.inputText.set('');
    this.parseError.set(false);

    // the field only mirrors state while unfocused (mid-typing rewrites would fight the
    // caret) — a clear happens while focused, so reset the element text directly
    const field = this.registeredField();

    if (field) {
      field.elementRef.nativeElement.value = '';
    }
  }

  /** Parses typed text and commits the resulting value (or flags a parse error). */
  public commitInput(rawValue: string) {
    if (this.disabled() || this.readonly()) {
      return;
    }

    const trimmed = rawValue.trim();

    this.inputText.set(rawValue);

    if (!trimmed) {
      this.parseError.set(false);

      // while mixed the field is empty anyway — a blank commit is a plain blur, not a user
      // clear, so the hidden raw value survives (the clear affordance resolves instead)
      if (!this.mixed()) {
        this.value.set(null);
      }

      return;
    }

    const parsed = parseDuration(trimmed, this.spec());

    if (parsed === null) {
      this.parseError.set(true);

      // drop the now-stale value so the wire model can't disagree with the unparseable
      // text on screen — mirrors date/time/date-time, which all null on a bad commit.
      // A failed parse resolves nothing while mixed: the masked raw value stays untouched
      if (!this.mixed() && this.value() !== null) {
        this.value.set(null);
      }

      return;
    }

    this.parseError.set(false);
    this.value.set(parsed);
    this.mixed.set(false);
  }
}
