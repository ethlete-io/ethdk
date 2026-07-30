import { booleanAttribute, computed, DestroyRef, Directive, inject, input, model, signal, Signal } from '@angular/core';
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
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  // eslint-disable-next-line ethlete/no-native-html-input-name -- form-field hidden state deliberately mirrors the native attribute
  public hidden = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');

  /**
   * The bound field's `maxLength()` limit, bound automatically by signal forms because this input
   * exists — so `<et-counter />` needs no `[max]` for a schema-validated field.
   *
   * Deliberately **not** forwarded to the native `maxlength` attribute: hard-truncating typed input
   * would stop the validator from ever reporting the over-limit error the counter exists to surface.
   * Set `maxlength` yourself on the control if you want the browser to clamp instead.
   */
  public maxLength = input<number | undefined>(undefined);

  /**
   * True while an async validator is in flight for the bound field — bound automatically by signal
   * forms because this input exists. The field shell surfaces it as its busy state.
   */
  public pending = input(false, { transform: booleanAttribute });

  /**
   * Author-supplied accessible name, forwarded onto the native control. Use this (or an
   * `<et-label>`) when the field has no visible label — a placeholder is not an accessible name.
   */
  public ariaLabel = input<string | null>(null, { alias: 'aria-label' });

  /**
   * Author-supplied `aria-labelledby`, forwarded onto the native control. Takes precedence over the
   * id of a projected `<et-label>`.
   */
  public ariaLabelledby = input<string | null>(null, { alias: 'aria-labelledby' });

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  public describedBy = signal<string | null>(null);
  public focused = signal(false);

  /** @internal The element `activate()` focuses — the native control by default. */
  public focusTarget = signal<HTMLElement | null>(null);

  private registeredLabelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /**
   * The `aria-labelledby` the native control should render: a consumer-supplied value wins,
   * otherwise the id of a projected `<et-label>`.
   */
  public labelId = computed(() => this.ariaLabelledby()?.trim() || this.registeredLabelId());

  public hasCustomAccessibleName = computed(() => !!this.ariaLabel()?.trim() || !!this.ariaLabelledby()?.trim());

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
