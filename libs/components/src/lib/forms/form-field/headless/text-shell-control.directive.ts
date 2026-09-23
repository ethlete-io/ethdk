import { booleanAttribute, computed, DestroyRef, Directive, inject, input, model, signal, Signal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { AccessibleNameControlDirective } from './accessible-name-control.directive';
import { FORM_FIELD_TOKEN, FormFieldControl, FormFieldControlType } from './form-field.tokens';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { mountTextFieldShellStyles } from '../form-field-text-shell-styles.component';

/** Must be extended by an `@Directive` - Angular only surfaces inherited inputs/outputs from a decorated base. */
@Directive({
  host: {
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export abstract class TextShellControlDirective extends AccessibleNameControlDirective implements FormFieldControl {
  private formFieldLabels = injectFormFieldLabels();

  private formField = inject(FORM_FIELD_TOKEN, { optional: true });

  public touched = model(false);
  /**
   * View state for a bulk-edit field whose source values disagree. While set, the raw `value`
   * stays untouched but is masked: the native control renders empty with `mixedLabel` as its
   * placeholder. The first user edit that produces content commits over the raw value (replace
   * semantics) and resolves `mixed`; external/programmatic value writes do not.
   */
  public mixed = model(false);
  /** Placeholder text shown while `mixed` is set - overrides the consumer placeholder. */
  public mixedLabel = input<string | null>(null);

  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');

  /** The string in effect: this instance's `mixedLabel`, else `FORM_FIELD_LABELS`. */
  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  public describedBy = signal<string | null>(null);
  public focused = signal(false);

  /** The control-type tag the form-field switches its shell/aria on. */
  public abstract controlType: Signal<FormFieldControlType>;

  constructor() {
    super();

    mountTextFieldShellStyles();

    const destroyRef = inject(DestroyRef);

    this.formField?.registerControl(this);
    destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public activate() {
    this.focus();
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) {
      return;
    }

    this.focusControl(options);
  }

  protected abstract focusControl(options?: FocusOptions): void;
}
