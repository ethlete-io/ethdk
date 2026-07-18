import { computed, DestroyRef, Directive, ElementRef, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { scorePasswordStrength } from './internals/password-strength';

@Directive({
  selector: '[etPasswordInput]',
  exportAs: 'etPasswordInput',
})
export class PasswordInputDirective implements FormValueControl<string>, FormFieldControl {
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

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value().length > 0);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.PASSWORD_INPUT);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public focusTarget = signal<HTMLElement | null>(null);

  /**
   * The native input element this directive controls. Set automatically when the
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
