import { computed, DestroyRef, Directive, inject, input, model, signal, Signal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_TOKEN, FormFieldControl, FormFieldControlType } from './form-field.tokens';

/**
 * Shared wiring for the native-input-backed controls that render inside the text-field shell
 * (`et-input`, `et-number-input`, `et-password-input`, `et-color-input`, `et-textarea`). It owns
 * the pieces those directives copy-pasted verbatim: the standard form-control inputs, the
 * form-field registration, the `describedBy`/`focused`/`focusTarget`/`labelId` plumbing, the
 * `touched && invalid` error gate, and the focus-target `activate()`.
 *
 * Subclasses add their own `value` model, `controlType`, `hasValue`, and any control-specific
 * surface (placeholder, native element wiring, etc.). Must be extended by an `@Directive` — Angular
 * only surfaces inherited inputs/outputs from a decorated base.
 */
@Directive({
  host: {
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export abstract class TextFieldControlDirective implements FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });

  public touched = model(false);
  /**
   * View state for a bulk-edit field whose source values disagree. While set, the raw `value`
   * stays untouched but is masked: the native control renders empty with `mixedLabel` as its
   * placeholder. The first user edit that produces content commits over the raw value (replace
   * semantics) and resolves `mixed`; external/programmatic value writes do not.
   */
  public mixed = model(false);
  /** Placeholder text shown while `mixed` is set — overrides the consumer placeholder. */
  public mixedLabel = input('Mixed');
  public disabled = input(false);
  public readonly = input(false);
  // eslint-disable-next-line ethlete/no-native-html-input-name -- form-field hidden state deliberately mirrors the native attribute
  public hidden = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  public describedBy = signal<string | null>(null);
  public focused = signal(false);

  /** @internal The element `activate()` focuses — the native control by default. */
  public focusTarget = signal<HTMLElement | null>(null);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** The control-type tag the form-field switches its shell/aria on. */
  public abstract controlType: Signal<FormFieldControlType>;

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.formField?.registerControl(this);
    destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    this.focusTarget()?.focus();
  }
}
