import { computed, DestroyRef, Directive, ElementRef, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { INPUT_TEXT_ALIGNMENTS, InputTextAlignment } from '../input.types';

export const INPUT_TYPES = {
  TEXT: 'text',
  EMAIL: 'email',
  PASSWORD: 'password',
  TEL: 'tel',
  URL: 'url',
  SEARCH: 'search',
} as const;

type InputType = (typeof INPUT_TYPES)[keyof typeof INPUT_TYPES];

@Directive({
  selector: '[etInput]',
  host: {
    '(input)': 'handleNativeInput($event)',
  },
})
export class InputDirective implements FormValueControl<string>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public value = model('');
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  // eslint-disable-next-line ethlete/no-native-html-input-name -- form-field hidden state deliberately mirrors the native attribute
  public hidden = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  public type = input<InputType>(INPUT_TYPES.TEXT);
  public placeholder = input('');
  public autocomplete = input('');
  public textAlign = input<InputTextAlignment>(INPUT_TEXT_ALIGNMENTS.START);

  /**
   * When another directive drives value-sync itself (input masking rewrites the raw/display
   * split in its own `(input)` handler), it suppresses ours so the two can't clobber each other.
   */
  private nativeSyncSuppressed = false;

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value().length > 0);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TEXT_INPUT);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public focusTarget = signal<HTMLElement | null>(null);

  /**
   * The native input element this directive controls. Set automatically when the
   * directive is placed on an `<input>` element; otherwise the hosting component
   * registers it. Integrations (e.g. input masking) attach through this signal.
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

  /** @internal Suppresses the built-in native `(input)` sync — see `nativeSyncSuppressed`. */
  public suppressNativeSync() {
    this.nativeSyncSuppressed = true;
  }

  /**
   * Keeps the model in sync while typing. The wrapper components also bind `(input)` on their
   * inner element, so this is redundant there (it writes the same value); its real job is the
   * standalone `input[etInput]` case, which otherwise has no listener updating the model.
   */
  protected handleNativeInput(event: Event) {
    if (this.nativeSyncSuppressed || event.target !== this.nativeControl()) {
      return;
    }

    this.value.set((event.target as HTMLInputElement).value);
  }
}
