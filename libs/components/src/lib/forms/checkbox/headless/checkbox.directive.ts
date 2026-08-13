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
import { FormCheckboxControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';

@Directive({
  selector: '[etCheckbox]',
  host: {
    role: 'checkbox',
    '[attr.aria-checked]': 'ariaChecked()',
    '[attr.aria-invalid]': 'shouldDisplayError() || null',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.aria-readonly]': 'readonly() || null',
    '[attr.data-readonly]': 'readonly() || null',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-describedby]': 'describedBy() || null',
    '[attr.aria-labelledby]': 'labelId() || null',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '(click)': 'toggle()',
    // toggle on keydown.space to match switch and the selection options (one activation phase
    // across the family), preventing the default page scroll
    '(keydown.space)': 'toggle(); $event.preventDefault()',
    '(blur)': 'touched.set(true)',
  },
})
export class CheckboxDirective implements FormCheckboxControl, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  public checked = model(false);
  public indeterminate = model(false);
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  /** View-only: keeps the normal look and focusability but blocks toggling (unlike `disabled`). */
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');

  public ariaChecked = computed(() => {
    if (this.indeterminate()) {
      return 'mixed';
    }

    return this.checked();
  });

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.CHECKBOX);

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
    this.focus({ focusVisible: false } as unknown as FocusOptions);
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) return;

    this.el.nativeElement.focus(options);
  }
}
