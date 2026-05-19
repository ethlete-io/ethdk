import { computed, DestroyRef, Directive, inject, input, model, signal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../form-field/headless';
import {
  SEGMENTED_BUTTON_GROUP_TOKEN,
  SegmentedButtonGroupDirectiveBase,
  SegmentedButtonItem,
} from './segmented-button-group.tokens';

@Directive({
  selector: '[etSegmentedButtonGroup]',
  providers: [{ provide: SEGMENTED_BUTTON_GROUP_TOKEN, useExisting: SegmentedButtonGroupDirective }],
  host: {
    role: 'group',
    '[attr.aria-invalid]': 'shouldDisplayError() || null',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-describedby]': 'describedById() || null',
  },
})
export class SegmentedButtonGroupDirective implements SegmentedButtonGroupDirectiveBase, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public value = model<unknown | unknown[] | null>(null);
  public touched = model(false);
  public multiple = input(false);
  public disabled = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  private items = signal<SegmentedButtonItem[]>([]);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.SEGMENTED_BUTTON);

  public describedById = computed(() => this.describedBy());

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public registerItem(item: SegmentedButtonItem) {
    this.items.update((items) => [...items, item]);
  }

  public unregisterItem(item: SegmentedButtonItem) {
    this.items.update((items) => items.filter((i) => i !== item));
  }

  public select(item: SegmentedButtonItem) {
    if (this.disabled()) {
      return;
    }

    if (this.multiple()) {
      item.checked.update((v) => !v);
      this.value.set(
        this.items()
          .filter((i) => i.checked())
          .map((i) => i.value()),
      );
    } else {
      for (const i of this.items()) {
        i.checked.set(i === item);
      }

      this.value.set(item.value());
    }
  }

  public activate() {
    const firstItem = this.items()[0];

    if (firstItem) {
      this.select(firstItem);
    }
  }
}
