import { DestroyRef, Directive, Signal, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FormFieldControl } from '../../form-field/headless';
import { resolvePickerCommit } from './picker-input-commit';
import { DatePickerInputFieldBase, PickerInputBaseDirective } from './picker-input-base.directive';

export type { DatePickerInputFieldBase } from './picker-input-base.directive';

/**
 * Shared host for the three `Date`-string picker inputs (`et-date-input`, `et-time-input`,
 * `et-date-time-input`): the field registration and the typed-text commit on top of
 * `PickerInputBaseDirective`.
 *
 * Must be extended by an `@Directive` - Angular only surfaces inherited inputs from a decorated base.
 */
@Directive()
export abstract class DatePickerInputDirective
  extends PickerInputBaseDirective
  implements FormValueControl<string | null>, FormFieldControl
{
  /** The committed value rendered in `displayFormat`. */
  public abstract displayValue: Signal<string>;

  /**
   * @internal Parses committed field text with the control's own rules (strict vs lenient);
   * `null` when the text does not parse.
   */
  public abstract parseCommitText(raw: string): Date | null;

  /** @internal Writes a parsed commit into the wire value, in the control's own shape. */
  public abstract writeCommitted(parsed: Date): void;

  /** The wire value in `valueFormat`, or `null` while empty/unparseable. */
  public value = model<string | null>(null);
  public placeholder = input('');

  /** Uncommitted field text - kept visible when it fails to parse. */
  public inputText = signal('');
  /** `true` while the field holds text that does not parse. */
  public parseError = signal(false);

  public focused = signal(false);

  /** @internal */
  public registeredField = signal<DatePickerInputFieldBase | null>(null);

  public hasValue = computed(
    () => this.mixed() || this.value() !== null || this.inputText().length > 0 || this.displayValue().length > 0,
  );

  /** What the field renders as its placeholder - `mixedLabel` while mixed masks the value. */
  public effectivePlaceholder = computed(() => (this.mixed() ? this.resolvedMixedLabel() : this.placeholder()));

  constructor() {
    super();

    this.formField?.registerControl(this);
    inject(DestroyRef).onDestroy(() => this.formField?.unregisterControl(this));
  }

  /**
   * @internal Commits typed field text: empty clears, a successful parse writes the value,
   * anything else keeps the raw text and raises `parseError`.
   */
  public commitInput(raw: string) {
    const outcome = resolvePickerCommit(raw, {
      displayValue: this.displayValue(),
      parseError: this.parseError(),
      interactive: this.interactive(),
      parse: (text) => this.parseCommitText(text),
    });

    if (outcome === null) {
      return;
    }

    this.beforeCommit();

    this.inputText.set(outcome.text);
    this.parseError.set(outcome.text.length > 0);

    if (outcome.parsed !== null) {
      this.writeCommitted(outcome.parsed);

      return;
    }

    if (!this.mixed() && this.value() !== null) {
      this.value.set(null);
    }
  }

  /** @internal Runs once a commit is known to apply. */
  public beforeCommit() {
    return;
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) {
      return;
    }

    this.registeredField()?.focus(options);
  }

  /** Clears the value and any uncommitted field text - wired to the styled inputs' clear button. */
  public clearValue() {
    if (!this.interactive()) {
      return;
    }

    this.value.set(null);
    this.mixed.set(false);
    this.inputText.set('');
    this.parseError.set(false);
    this.registeredField()?.resetText();
  }

  protected anchorField() {
    return this.registeredField();
  }
}
