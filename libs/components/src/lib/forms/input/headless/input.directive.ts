import { computed, Directive, ElementRef, inject, input, model, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, TextFieldControlDirective } from '../../form-field/headless';
import { INPUT_MASK_HOST } from '../../masked-input/headless/input-mask-host';
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
  // the built-in mask host - any [etInputMask] on the same element attaches through this
  providers: [{ provide: INPUT_MASK_HOST, useExisting: InputDirective }],
  host: {
    '(input)': 'handleNativeInput($event)',
  },
})
export class InputDirective extends TextFieldControlDirective implements FormValueControl<string> {
  public value = model('');

  public type = input<InputType>(INPUT_TYPES.TEXT);
  public placeholder = input('');
  public autocomplete = input('');
  public textAlign = input<InputTextAlignment>(INPUT_TEXT_ALIGNMENTS.START);

  /**
   * When another directive drives value-sync itself (input masking rewrites the raw/display
   * split in its own `(input)` handler), it suppresses ours so the two can't clobber each other.
   */
  private nativeSyncSuppressed = false;

  public hasValue = computed(() => this.mixed() || this.value().length > 0);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TEXT_INPUT);

  /** The text the native input renders - empty while mixed so the raw value never reaches the DOM. */
  public displayValue = computed(() => (this.mixed() ? '' : this.value()));

  /** The placeholder the native input renders - `mixedLabel` overrides the consumer placeholder while mixed. */
  public effectivePlaceholder = computed(() => (this.mixed() ? this.resolvedMixedLabel() : this.placeholder()));

  /**
   * The native input element this directive controls. Set automatically when the
   * directive is placed on an `<input>` element; otherwise the hosting component
   * registers it. Integrations (e.g. input masking) attach through this signal.
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

  /** @internal Suppresses the built-in native `(input)` sync - see `nativeSyncSuppressed`. */
  public suppressNativeSync() {
    this.nativeSyncSuppressed = true;
  }

  /** @internal Restores the built-in native `(input)` sync - the mask calls this when set to `null`. */
  public resumeNativeSync() {
    this.nativeSyncSuppressed = false;
  }

  /**
   * Keeps the model in sync while typing. The wrapper components also bind `(input)` on their
   * inner element, so this is redundant there (it routes through the same sync); its real job is
   * the standalone `input[etInput]` case, which otherwise has no listener updating the model.
   */
  protected handleNativeInput(event: Event) {
    if (this.nativeSyncSuppressed || event.target !== this.nativeControl()) {
      return;
    }

    this.syncFromNativeInput(event.target as HTMLInputElement);
  }

  /**
   * @internal Routes a user edit from the native input into the model. Typing is the commit
   * over a mixed state: the first edit that produces content replaces the raw value and
   * resolves `mixed`; an edit that leaves the input empty keeps both untouched.
   */
  public syncFromNativeInput(inputElement: HTMLInputElement) {
    if (this.mixed()) {
      if (!inputElement.value) {
        return;
      }

      this.mixed.set(false);
    }

    this.value.set(inputElement.value);
  }
}
