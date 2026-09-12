import { DestroyRef, Directive, booleanAttribute, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import {
  AccessibleNameControlDirective,
  FORM_FIELD_CONTROL_TYPES,
  FORM_FIELD_TOKEN,
  FormFieldControl,
} from '../../../form-field/headless';
import { deriveDurationFormatSpec, formatDuration, parseDuration } from './internals/duration-format';
import { DurationInputFieldDirective } from './duration-input-field.directive';
import { injectFormFieldLabels } from '../../../../forms/form-field/form-field-labels';
import { injectDateTimeLabels } from '../../../../forms/date-time/date-time-labels';
import { mountTextFieldShellStyles } from '../../../form-field/form-field-text-shell-styles.component';

/**
 * A duration form control whose value is a **total elapsed time in milliseconds**
 * (`number | null`), not a `Date`. Typed entry parses leniently on blur/Enter against a
 * configurable segment layout (`130` → `1:30` under `mm:ss`).
 */
@Directive({
  selector: '[etDurationInput]',
  exportAs: 'etDurationInput',
  host: {
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export class DurationInputDirective
  extends AccessibleNameControlDirective
  implements FormValueControl<number | null>, FormFieldControl
{
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
  /** Field placeholder shown while `mixed` is set. Presentation only - it never enters the form value. */
  public mixedLabel = input<string | null>(null);

  /** Message the form field shows when typed text can't be parsed as a duration. */
  public parseErrorMessage = input<string | null>(null);

  /** The segment layout: `h`/`m`/`s`/`S` token runs plus separators. @default `'mm:ss'` */
  public durationFormat = input('mm:ss');

  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  public resolvedParseErrorMessage = computed(() => this.parseErrorMessage() ?? this.dateTimeLabels().invalidDuration);

  public spec = computed(() => deriveDurationFormatSpec(this.durationFormat()));

  /** The committed value formatted for display - masked (empty) while mixed. */
  public displayValue = computed(() => (this.mixed() ? '' : formatDuration(this.value(), this.spec())));

  /** The raw text currently in the field (tracked so unparseable input survives). */
  public inputText = signal('');

  /** Set when the last commit could not be parsed - the raw text is kept visible. */
  public parseError = signal(false);

  public focused = signal(false);

  public shouldDisplayError = computed(() => this.touched() && (this.invalid() || this.parseError()));
  public hasValue = computed(() => this.mixed() || this.value() !== null || this.inputText().trim().length > 0);

  /** What the field renders as its placeholder - `mixedLabel` while mixed masks the value. */
  public effectivePlaceholder = computed(() => (this.mixed() ? this.resolvedMixedLabel() : this.placeholder()));

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DURATION_INPUT);

  /** @internal */
  public registeredField = signal<DurationInputFieldDirective | null>(null);

  constructor() {
    super();

    mountTextFieldShellStyles();

    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public activate() {
    this.focus();
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) {
      return;
    }

    this.registeredField()?.focus(options);
  }

  /** Clears the value and any uncommitted field text - wired to the styled input's clear button. */
  public clearValue() {
    if (this.disabled() || this.readonly()) {
      return;
    }

    this.value.set(null);
    this.mixed.set(false);
    this.inputText.set('');
    this.parseError.set(false);

    // the field only mirrors state while unfocused, and a clear happens while focused
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

      if (!this.mixed()) {
        this.value.set(null);
      }

      return;
    }

    const parsed = parseDuration(trimmed, this.spec());

    if (parsed === null) {
      this.parseError.set(true);

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
