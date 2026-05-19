import { computed, DestroyRef, Directive, ElementRef, inject, input, model, signal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { SEGMENTED_BUTTON_GROUP_TOKEN } from '../../segmented-button-group/segmented-button-group.tokens';

@Directive({
  selector: '[etSegmentedButton]',
  host: {
    role: 'option',
    '[attr.aria-checked]': 'checked()',
    '[attr.aria-disabled]': 'effectiveDisabled() || null',
    '[attr.aria-selected]': 'checked()',
    '[attr.tabindex]': 'effectiveDisabled() ? -1 : 0',
    '(click)': 'select()',
    '(keydown.space)': 'select(); $event.preventDefault()',
    '(keydown.enter)': 'select(); $event.preventDefault()',
    '(blur)': 'markTouched()',
  },
})
export class SegmentedButtonDirective implements FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private group = inject(SEGMENTED_BUTTON_GROUP_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private el = inject(ElementRef);

  public value = input.required<unknown>();
  public checked = model(false);
  public touched = model(false);
  public disabled = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public name = input('');

  public effectiveDisabled = computed(() => this.disabled() || (this.group?.disabled() ?? false));

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.SEGMENTED_BUTTON);

  private groupItem = { value: this.value, checked: this.checked };

  constructor() {
    if (!this.group) {
      this.formField?.registerControl(this);
      this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
    }

    if (this.group) {
      const group = this.group;
      group.registerItem(this.groupItem);
      this.destroyRef.onDestroy(() => group.unregisterItem(this.groupItem));
    }
  }

  public select() {
    if (this.effectiveDisabled()) {
      return;
    }

    if (this.group) {
      this.group.select(this.groupItem);
    } else {
      this.checked.update((v) => !v);
    }
  }

  public activate() {
    if (this.effectiveDisabled()) return;

    this.select();
    this.el.nativeElement.focus();
  }

  public markTouched() {
    this.touched.set(true);
  }
}
