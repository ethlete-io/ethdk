import { computed, Directive, ElementRef, inject, input, model, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, TextFieldControlDirective } from '../../form-field/headless';
import { scorePasswordStrength } from './internals/password-strength';

@Directive({
  selector: '[etPasswordInput]',
  exportAs: 'etPasswordInput',
})
export class PasswordInputDirective extends TextFieldControlDirective implements FormValueControl<string> {
  public value = model('');

  public placeholder = input('');
  public autocomplete = input('current-password');

  // No `textAlign` (unlike `InputDirective`/`NumberInputDirective`) on purpose: the reveal toggle
  // and Caps-Lock warning occupy the trailing edge, so `text-align: end` would run the value under
  // them. Passwords are conventionally start-aligned regardless - the omission is deliberate.

  /** Whether the value is currently shown as plain text. */
  public revealed = model(false);

  /**
   * Whether Caps Lock is known to be on - feed it via `syncCapsLock`. Only ever `true` off a
   * reading that can be trusted, so it lags one keystroke behind Caps Lock being switched on
   * rather than reporting it as still on after it has been switched off.
   */
  public capsLockOn = signal(false);

  /**
   * A 0–4 typing-feedback score from a simple length + character-class heuristic -
   * render it however you like (deliberately not a zxcvbn-style security estimate).
   * `0` while mixed - scoring the hidden raw value would leak information about it.
   */
  public strength = computed(() => (this.mixed() ? 0 : scorePasswordStrength(this.value())));

  /** The native `type` the input element should carry. */
  public inputType = computed(() => (this.revealed() ? 'text' : 'password'));

  public hasValue = computed(() => this.mixed() || this.value().length > 0);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.PASSWORD_INPUT);

  /** The text the native input renders - empty while mixed so the raw value never reaches the DOM. */
  public displayValue = computed(() => (this.mixed() ? '' : this.value()));

  /** The placeholder the native input renders - `mixedLabel` overrides the consumer placeholder while mixed. */
  public effectivePlaceholder = computed(() => (this.mixed() ? this.resolvedMixedLabel() : this.placeholder()));

  /**
   * The native input element this directive controls. Set automatically when the
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

  public toggleRevealed() {
    if (this.disabled()) return;

    this.revealed.update((revealed) => !revealed);
  }

  /**
   * Feed keyboard, pointer or focus events from the native input so `capsLockOn` stays current.
   * Pointer events matter for the focus case: clicking into an already-Caps-Lock-on field fires no
   * keystroke, so the warning would otherwise not appear until the first key. Events that cannot
   * report the state - `FocusEvent`, and the Caps Lock key itself - clear it.
   */
  public syncCapsLock(event: KeyboardEvent | MouseEvent | FocusEvent) {
    // Two readings can't be trusted: a `FocusEvent` carries no modifier state at all, and on macOS
    // the Caps Lock key's own keydown/keyup reports the state from before the toggle - which is why
    // switching Caps Lock off used to leave the warning on. Drop the state for both and let the next
    // real keystroke or pointer event re-establish it.
    if (!('getModifierState' in event) || ('key' in event && event.key === 'CapsLock')) {
      this.capsLockOn.set(false);

      return;
    }

    this.capsLockOn.set(event.getModifierState('CapsLock'));
  }
}
