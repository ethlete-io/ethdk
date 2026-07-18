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
  // them. Passwords are conventionally start-aligned regardless — the omission is deliberate.

  /** Whether the value is currently shown as plain text. */
  public revealed = model(false);

  /** Whether Caps Lock was active on the last keystroke — feed it via `syncCapsLock`. */
  public capsLockOn = signal(false);

  /**
   * A 0–4 typing-feedback score from a simple length + character-class heuristic —
   * render it however you like (deliberately not a zxcvbn-style security estimate).
   */
  public strength = computed(() => scorePasswordStrength(this.value()));

  /** The native `type` the input element should carry. */
  public inputType = computed(() => (this.revealed() ? 'text' : 'password'));

  public hasValue = computed(() => this.value().length > 0);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.PASSWORD_INPUT);

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

  public toggleRevealed() {
    if (this.disabled()) return;

    this.revealed.update((revealed) => !revealed);
  }

  /**
   * Feed keyboard or pointer events from the native input so `capsLockOn` stays current.
   * Pointer events matter for the focus case: clicking into an already-Caps-Lock-on field
   * fires no keystroke, so the warning would otherwise not appear until the first key —
   * `MouseEvent`/`PointerEvent` carry `getModifierState`, `FocusEvent` does not.
   */
  public syncCapsLock(event: KeyboardEvent | MouseEvent) {
    this.capsLockOn.set(event.getModifierState('CapsLock'));
  }
}
