import { computed, DestroyRef, Directive, ElementRef, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';

@Directive({
  selector: '[etColorInput]',
})
export class ColorInputDirective implements FormValueControl<string | null>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  /** Hex color in `#rrggbb` notation, or `null` when nothing was picked yet. */
  public value = model<string | null>(null);
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  // eslint-disable-next-line ethlete/no-native-html-input-name -- form-field hidden state deliberately mirrors the native attribute
  public hidden = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value() !== null);

  /**
   * `<input type="color">` ignores the native `readonly` attribute (spec), so the surface gates
   * interaction on this instead — the component blocks the picker-opening events while it's false,
   * and the value sync no-ops as a backstop.
   */
  public interactive = computed(() => !this.disabled() && !this.readonly());

  /** The color the native input currently paints — `#000000` until a value is picked. */
  public resolvedColor = computed(() => this.value() ?? '#000000');

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.COLOR_INPUT);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public focusTarget = signal<HTMLElement | null>(null);

  /**
   * The native color input this directive controls. Set automatically when the
   * directive is placed on an `<input>` element; otherwise the hosting component
   * registers it.
   */
  public nativeControl = signal<HTMLInputElement | null>(null);

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    const hostRef = inject<ElementRef<HTMLElement | null>>(ElementRef);
    const hostElement = hostRef.nativeElement;

    if (hostElement?.tagName === 'INPUT') {
      this.nativeControl.set(hostElement as HTMLInputElement);
      this.focusTarget.set(hostElement);
    }
  }

  public activate() {
    if (this.disabled()) return;

    this.focusTarget()?.focus();
  }

  /** @internal */
  public syncFromNativeInput(inputElement: HTMLInputElement) {
    if (!this.interactive()) {
      return;
    }

    this.value.set(inputElement.value || null);
  }
}
