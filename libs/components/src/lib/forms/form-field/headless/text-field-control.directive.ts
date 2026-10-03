import { booleanAttribute, Directive, effect, input, signal } from '@angular/core';
import { injectRenderer } from '@ethlete/core';
import { TextShellControlDirective } from './text-shell-control.directive';

/**
 * The base's inputs, for a wrapper component's `hostDirectives` list. Spread it instead of copying
 * the names - a dropped entry makes that binding an NG0303 on the wrapper.
 */
export const TEXT_FIELD_CONTROL_INPUTS = [
  'touched',
  'mixed',
  'mixedLabel',
  'disabled',
  'readonly',
  'hidden',
  'invalid',
  'errors',
  'warnings',
  'required',
  'name',
  'maxLength',
  'pending',
  'aria-label',
  'aria-labelledby',
] as const;

/**
 * Shared wiring for the native-input-backed controls that render inside the text-field shell
 * (`et-input`, `et-number-input`, `et-password-input`, `et-color-input`, `et-textarea`).
 *
 * Subclasses add their own `value` model, `controlType`, `hasValue`, and any control-specific
 * surface (placeholder, native element wiring, etc.). Must be extended by an `@Directive` - Angular
 * only surfaces inherited inputs/outputs from a decorated base.
 */
@Directive()
export abstract class TextFieldControlDirective extends TextShellControlDirective {
  private nativeHostRenderer = injectRenderer();

  /**
   * The bound field's `maxLength()` limit, bound automatically by signal forms because this input
   * exists - so `<et-counter />` needs no `[max]` for a schema-validated field.
   *
   * Deliberately **not** forwarded to the native `maxlength` attribute. Set `maxlength` yourself on
   * the control if you want the browser to clamp instead.
   */
  public maxLength = input<number | undefined>(undefined);

  /**
   * True while an async validator is in flight for the bound field - bound automatically by signal
   * forms because this input exists.
   */
  public pending = input(false, { transform: booleanAttribute });

  /** @internal The element `focus()` targets - the native control by default. */
  public focusTarget = signal<HTMLElement | null>(null);

  /** @internal For a directive placed on the native element itself - a wrapper component binds these in its template. */
  protected mirrorOntoNativeHost(
    element: HTMLInputElement | HTMLTextAreaElement,
    state: {
      value: () => string;
      placeholder: () => string;
      type?: () => string;
      attributes?: () => Record<string, string | null>;
      skip?: () => boolean;
    },
  ) {
    effect(() => {
      const value = state.value();

      if (!state.skip?.() && element.value !== value) {
        this.nativeHostRenderer.setProperty(element, 'value', value);
      }
    });

    const type = state.type;

    if (type) {
      effect(() => this.nativeHostRenderer.setProperty(element, 'type', type()));
    }

    effect(() =>
      this.nativeHostRenderer.setProperties(element, {
        disabled: this.disabled(),
        readOnly: this.readonly(),
        required: this.required(),
      }),
    );

    const staticDescribedBy = element.getAttribute('aria-describedby');

    effect(() =>
      this.nativeHostRenderer.setAttributes(element, {
        placeholder: state.placeholder() || null,
        name: this.name() || null,
        'aria-invalid': this.shouldDisplayError() ? 'true' : null,
        'aria-describedby': [staticDescribedBy, this.describedBy()].filter(Boolean).join(' ') || null,
        ...state.attributes?.(),
      }),
    );
  }

  protected focusControl(options?: FocusOptions) {
    this.focusTarget()?.focus(options);
  }

  protected handleNativeFocus(event: FocusEvent) {
    if (event.target !== this.focusTarget()) return;

    this.focused.set(true);
  }

  protected handleNativeBlur(event: FocusEvent) {
    if (event.target !== this.focusTarget()) return;

    this.focused.set(false);
    this.touched.set(true);
  }
}
