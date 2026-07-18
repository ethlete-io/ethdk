import { DestroyRef, Directive, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../../form-field/headless';
import { deriveDurationFormatSpec, formatDuration, parseDuration } from './internals/duration-format';
import { DurationInputFieldDirective } from './duration-input-field.directive';

/**
 * A duration form control whose value is a **total elapsed time in milliseconds**
 * (`number | null`), not a `Date` — a duration is a distinct scalar quantity, so it
 * stays out of the calendar/time `Date` system. Typed entry parses leniently on
 * blur/Enter against a configurable segment layout (`130` → `1:30` under `mm:ss`).
 */
@Directive({
  selector: '[etDurationInput]',
  exportAs: 'etDurationInput',
})
export class DurationInputDirective implements FormValueControl<number | null>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  /** Total elapsed milliseconds, or `null` while empty/unparseable. */
  public value = model<number | null>(null);
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');
  public placeholder = input('');

  /** Message the form field shows when typed text can't be parsed as a duration. */
  public parseErrorMessage = input('Please enter a valid duration');

  /** The segment layout: `h`/`m`/`s`/`S` token runs plus separators. @default `'mm:ss'` */
  public durationFormat = input('mm:ss');

  public spec = computed(() => deriveDurationFormatSpec(this.durationFormat()));

  /** The committed value formatted for display. */
  public displayValue = computed(() => formatDuration(this.value(), this.spec()));

  /** The raw text currently in the field (tracked so unparseable input survives). */
  public inputText = signal('');

  /** Set when the last commit could not be parsed — the raw text is kept visible. */
  public parseError = signal(false);

  public focused = signal(false);

  public shouldDisplayError = computed(() => this.touched() && (this.invalid() || this.parseError()));
  public hasValue = computed(() => this.value() !== null || this.inputText().trim().length > 0);

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
      this.value.set(null);

      return;
    }

    const parsed = parseDuration(trimmed, this.spec());

    if (parsed === null) {
      this.parseError.set(true);

      // drop the now-stale value so the wire model can't disagree with the unparseable
      // text on screen — mirrors date/time/date-time, which all null on a bad commit
      if (this.value() !== null) {
        this.value.set(null);
      }

      return;
    }

    this.parseError.set(false);
    this.value.set(parsed);
  }
}
