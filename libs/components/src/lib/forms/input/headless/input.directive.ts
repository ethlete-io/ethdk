import { computed, Directive, ElementRef, inject, input, linkedSignal, model, signal } from '@angular/core';
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
    '(focus)': 'handleNativeFocus($event)',
    '(blur)': 'handleNativeBlur($event)',
    '(compositionstart)': 'handleCompositionChange($event, true)',
    '(compositionend)': 'handleCompositionChange($event, false)',
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

  // A bound field may hold `null` for "empty" (a nullable string field, e.g. the query form's
  // search field), so neither of these may assume a string is there.
  public hasValue = computed(() => this.mixed() || !!this.value());
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TEXT_INPUT);

  /** @internal `true` between `compositionstart` and `compositionend` on the native input. */
  public composing = signal(false);

  /**
   * The text the native input renders - empty while mixed so the raw value never reaches the DOM.
   * Held at its last rendered value while an IME composes: writing the native `value` mid-composition
   * tears the composition down, so a model change made meanwhile lands on `compositionend`.
   */
  public displayValue = linkedSignal<{ text: string; composing: boolean }, string>({
    source: () => ({ text: this.mixed() ? '' : (this.value() ?? ''), composing: this.composing() }),
    computation: (source, previous) => (source.composing && previous ? previous.value : source.text),
  }).asReadonly();

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
      this.mirrorOntoNativeHost(hostElement as HTMLInputElement, {
        value: this.displayValue,
        placeholder: this.effectivePlaceholder,
        type: this.type,
        skip: () => this.nativeSyncSuppressed,
      });
    }
  }

  /** Suppresses the built-in native `(input)` sync - see `nativeSyncSuppressed`. */
  public suppressNativeSync() {
    this.nativeSyncSuppressed = true;
  }

  /** Restores the built-in native `(input)` sync - the mask calls this when set to `null`. */
  public resumeNativeSync() {
    this.nativeSyncSuppressed = false;
  }

  protected handleCompositionChange(event: Event, composing: boolean) {
    if (event.target !== this.nativeControl()) {
      return;
    }

    this.composing.set(composing);
  }

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
