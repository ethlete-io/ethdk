import { computed, Directive, ElementRef, inject, model, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, TextFieldControlDirective } from '../../form-field/headless';

@Directive({
  selector: '[etColorInput]',
})
export class ColorInputDirective extends TextFieldControlDirective implements FormValueControl<string | null> {
  /** Hex color in `#rrggbb` notation, or `null` when nothing was picked yet. */
  public value = model<string | null>(null);

  public hasValue = computed(() => this.value() !== null);

  /**
   * `<input type="color">` ignores the native `readonly` attribute (spec), so the surface gates
   * interaction on this instead — the component blocks the picker-opening events while it's false,
   * and the value sync no-ops as a backstop.
   */
  public interactive = computed(() => !this.disabled() && !this.readonly());

  /** The color the native input currently paints — `#000000` until a value is picked. */
  public resolvedColor = computed(() => this.value() ?? '#000000');

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

  /** @internal */
  public syncFromNativeInput(inputElement: HTMLInputElement) {
    if (!this.interactive()) {
      return;
    }

    this.value.set(inputElement.value || null);
  }
}
