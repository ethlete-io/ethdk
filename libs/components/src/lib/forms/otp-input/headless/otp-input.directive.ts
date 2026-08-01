import {
  DestroyRef,
  Directive,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
} from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';

export type OtpInputCharset = 'numeric' | 'alphanumeric' | RegExp;

const CHARSET_PATTERNS: Record<'numeric' | 'alphanumeric', RegExp> = {
  numeric: /[0-9]/,
  alphanumeric: /[a-zA-Z0-9]/,
};

@Directive({
  selector: '[etOtpInput]',
  exportAs: 'etOtpInput',
})
export class OtpInputDirective implements FormValueControl<string>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public value = model('');
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');

  /** Number of characters/segments. */
  public length = input(6, { transform: numberAttribute });
  /** Which characters are accepted - anything else is stripped (also from pastes). */
  public charset = input<OtpInputCharset>('numeric');
  /** Renders dots instead of the typed characters (PIN entry). */
  public masked = input(false, { transform: booleanAttribute });

  /** Emits once each time the value reaches the full length. */
  public complete = output<string>();

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value().length > 0);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.OTP_INPUT);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /**
   * The native input this directive controls. Auto-initialized when the directive sits on
   * an `<input>` (headless usage); otherwise set by the hosting component (`et-otp-input`).
   */
  public nativeControl = signal<HTMLInputElement | null>(null);

  public inputMode = computed(() => (this.charset() === 'numeric' ? 'numeric' : 'text'));

  /** The character each segment displays (`null` for empty slots). */
  public segmentChars = computed(() => {
    const value = this.value();
    const masked = this.masked();

    return Array.from({ length: this.length() }, (_, index) => {
      const char = value[index];

      return char === undefined ? null : masked ? '•' : char;
    });
  });

  /** The segment the synthetic caret sits on while focused - the next empty slot, or the last one when full. */
  public caretIndex = computed(() => Math.min(this.value().length, this.length() - 1));

  private charPattern = computed(() => {
    const charset = this.charset();

    return typeof charset === 'string' ? CHARSET_PATTERNS[charset] : charset;
  });

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    const hostRef = inject<ElementRef<HTMLElement | null>>(ElementRef);
    const hostElement = hostRef.nativeElement;

    if (hostElement?.tagName === 'INPUT') {
      this.nativeControl.set(hostElement as HTMLInputElement);
    }
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    this.nativeControl()?.focus({ preventScroll: true });
  }

  /** Strips characters outside the charset and truncates to `length` - pastes included. */
  public sanitize(raw: string) {
    const pattern = this.charPattern();

    return Array.from(raw)
      .filter((char) => pattern.test(char))
      .join('')
      .slice(0, this.length());
  }

  /** @internal Wired to the native input's `input` event. */
  public handleNativeInput() {
    const element = this.nativeControl();

    if (!element) {
      return;
    }

    const previous = this.value();
    const sanitized = this.sanitize(element.value);

    // normalize the element (rejected characters must not linger) and pin the caret to the
    // end - editing is append/delete-at-end only, which keeps segment display and caret in
    // lockstep without tracking native selection over invisible text
    if (element.value !== sanitized) {
      element.value = sanitized;
    }

    element.setSelectionRange(sanitized.length, sanitized.length);
    this.value.set(sanitized);

    // emit whenever a *different* full-length code lands - not just when growing from incomplete,
    // or replacing one complete code with another (select-all + paste, autofill over a filled
    // field) would silently never re-complete
    if (sanitized.length === this.length() && sanitized !== previous) {
      this.complete.emit(sanitized);
    }
  }

  /** @internal */
  public handleNativeFocus() {
    this.focused.set(true);

    const element = this.nativeControl();

    element?.setSelectionRange(element.value.length, element.value.length);
  }

  /** @internal */
  public handleNativeBlur() {
    this.focused.set(false);
    this.touched.set(true);
  }

  /** @internal Keeps the caret at the end - arrow/Home keys would detach it from the segment display. */
  public handleNativeSelectionEvent() {
    const element = this.nativeControl();

    if (!element || this.focused() === false) {
      return;
    }

    const end = element.value.length;

    if (element.selectionStart !== end || element.selectionEnd !== end) {
      element.setSelectionRange(end, end);
    }
  }
}
