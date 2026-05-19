import {
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { FormCheckboxControl, ValidationError } from '@angular/forms/signals';
import { CHECKBOX_GROUP_TOKEN } from '../../checkbox-group/checkbox-group.tokens';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';

@Directive({
  selector: '[etCheckbox]',
  host: {
    role: 'checkbox',
    '[attr.aria-checked]': 'ariaChecked()',
    '[attr.aria-invalid]': 'shouldDisplayError() || null',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-describedby]': 'describedById() || null',
    '[attr.aria-labelledby]': 'labelId() || null',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '(click)': 'toggle()',
    '(keydown.space)': 'toggle(); $event.preventDefault()',
    '(blur)': 'touched.set(true)',
  },
})
export class CheckboxDirective implements FormCheckboxControl, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private checkboxGroup = inject(CHECKBOX_GROUP_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private el = inject(ElementRef);

  public checked = model(false);
  public indeterminate = model(false);
  public touched = model(false);
  public skipGroup = input(false);
  public disabled = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
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

  public describedById = computed(() => this.describedBy());

  private groupItem = { checked: this.checked, indeterminate: this.indeterminate };

  constructor() {
    this.formField?.registerControl(this);

    if (this.checkboxGroup) {
      const group = this.checkboxGroup;
      let registered = false;

      effect(() => {
        const skip = this.skipGroup();

        untracked(() => {
          if (skip && registered) {
            group.unregisterItem(this.groupItem);
            registered = false;
          } else if (!skip && !registered) {
            group.registerItem(this.groupItem);
            registered = true;
          }
        });
      });

      this.destroyRef.onDestroy(() => {
        if (registered) {
          group.unregisterItem(this.groupItem);
        }
      });
    }

    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public toggle() {
    if (this.disabled()) {
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

    this.toggle();
    this.el.nativeElement.focus();
  }
}
