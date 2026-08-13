import {
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';

@Directive({
  selector: '[etSwitch]',
  host: {
    role: 'switch',
    '[attr.aria-checked]': 'checked()',
    // role=switch does not support aria-checked="mixed" (ARIA treats it as false), so the
    // indeterminate/bulk-edit state is reflected for styling only - aria-checked stays boolean
    '[attr.data-indeterminate]': 'indeterminate() || null',
    '[attr.aria-invalid]': 'shouldDisplayError() || null',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.aria-readonly]': 'readonly() || null',
    '[attr.data-readonly]': 'readonly() || null',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-describedby]': 'describedBy() || null',
    '[attr.aria-labelledby]': 'labelId() || null',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '(click)': 'toggle()',
    '(keydown.space)': 'toggle(); $event.preventDefault()',
    '(blur)': 'touched.set(true)',
  },
})
export class SwitchDirective implements FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  public checked = model(false);
  /**
   * Bulk-edit state for a switch whose source records disagree (some on, some off), mirroring
   * checkbox's platform `indeterminate`. The committed `checked` value stays untouched while
   * indeterminate; the first user toggle resolves the flag and turns the switch on.
   */
  public indeterminate = model(false);
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  /** View-only: keeps the normal look and focusability but blocks toggling (unlike `disabled`). */
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.SWITCH);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public toggle() {
    if (this.disabled() || this.readonly()) {
      return;
    }

    if (this.indeterminate()) {
      this.indeterminate.set(false);
      this.checked.set(true);

      return;
    }

    this.checked.update((value) => !value);
  }

  public activate() {
    if (this.disabled()) return;

    // readonly stays focusable (view-only), it just cannot toggle
    this.toggle();
    this.focus();
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) return;

    this.el.nativeElement.focus(options);
  }
}
