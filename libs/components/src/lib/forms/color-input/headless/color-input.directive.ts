import { computed, Directive, ElementRef, inject, model, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, TextFieldControlDirective } from '../../form-field/headless';

@Directive({
  selector: '[etColorInput]',
})
export class ColorInputDirective extends TextFieldControlDirective implements FormValueControl<string | null> {
  /** Hex color in `#rrggbb` notation, or `null` when nothing was picked yet. */
  public value = model<string | null>(null);

  public hasValue = computed(() => this.mixed() || this.value() !== null);

  /**
   * `<input type="color">` ignores the native `readonly` attribute (spec), so the surface gates
   * interaction on this instead — the component blocks the picker-opening events while it's false,
   * and the value sync no-ops as a backstop.
   */
  public interactive = computed(() => !this.disabled() && !this.readonly());

  /**
   * The color the native input currently paints — `#000000` until a value is picked, and
   * while mixed (the picker must not preselect and thereby reveal the hidden raw color).
   */
  public resolvedColor = computed(() => (this.mixed() ? '#000000' : (this.value() ?? '#000000')));

  /** The color the swatch paints — `null` while mixed so the CSS neutral treatment takes over. */
  public swatchColor = computed(() => (this.mixed() ? null : this.resolvedColor()));

  /** The text the value slot renders — `mixedLabel` while mixed, never the hidden raw color. */
  public displayValue = computed(() => (this.mixed() ? this.mixedLabel() : (this.value() ?? '')));

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.COLOR_INPUT);

  /**
   * The native color input this directive controls. Set automatically when the
   * directive is placed on an `<input>` element; otherwise the hosting component
   * registers it.
   */
  public nativeControl = signal<HTMLInputElement | null>(null);

  constructor() {
    super();

    const hostRef = inject<ElementRef<HTMLElement | null>>(ElementRef);
    const hostElement = hostRef.nativeElement;

    if (hostElement?.tagName === 'INPUT') {
      this.nativeControl.set(hostElement as HTMLInputElement);
      this.focusTarget.set(hostElement);
    }
  }

  /**
   * @internal Routes a picked color from the native input into the model. Picking is the
   * commit over a mixed state: it replaces the raw value and resolves `mixed`.
   */
  public syncFromNativeInput(inputElement: HTMLInputElement) {
    if (!this.interactive()) {
      return;
    }

    if (this.mixed()) {
      if (!inputElement.value) {
        return;
      }

      this.mixed.set(false);
    }

    this.value.set(inputElement.value || null);
  }
}
