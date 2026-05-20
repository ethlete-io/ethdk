import { computed, DestroyRef, Directive, inject, input, model, signal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../form-field/headless';
import { RADIO_GROUP_TOKEN, RadioGroupDirectiveBase, RadioGroupItem, RadioGroupLabelBase } from './radio-group.tokens';

@Directive({
  selector: '[etRadioGroup]',
  providers: [{ provide: RADIO_GROUP_TOKEN, useExisting: RadioGroupDirective }],
  host: {
    role: 'radiogroup',
    '[attr.aria-invalid]': 'shouldDisplayError() || null',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-describedby]': 'describedById() || null',
    '[attr.aria-labelledby]': 'labelId() || null',
    '[attr.data-disabled]': 'disabled() || null',
  },
})
export class RadioGroupDirective implements RadioGroupDirectiveBase, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public value = model<unknown | null>(null);
  public touched = model(false);
  public disabled = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  public items = signal<RadioGroupItem[]>([]);
  public registeredLabel = signal<RadioGroupLabelBase | null>(null);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.RADIO);

  public describedById = computed(() => this.describedBy());
  public labelId = computed(() => this.registeredLabel()?.id() ?? null);

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public registerItem(item: RadioGroupItem) {
    this.items.update((items) => [...items, item]);
  }

  public unregisterItem(item: RadioGroupItem) {
    this.items.update((items) => items.filter((i) => i !== item));
  }

  public markTouched() {
    this.touched.set(true);
  }

  public unregisterLabel(label: RadioGroupLabelBase) {
    if (this.registeredLabel() === label) {
      this.registeredLabel.set(null);
    }
  }

  public select(item: RadioGroupItem) {
    if (this.disabled()) {
      return;
    }

    this.value.set(item.value());

    for (const i of this.items()) {
      i.checked.set(i === item);
    }
  }

  public focusItem(item: RadioGroupItem) {
    item.elementRef.nativeElement.focus();
  }

  public activate() {
    const firstItem = this.items()[0];

    if (firstItem) {
      this.select(firstItem);
    }
  }
}
