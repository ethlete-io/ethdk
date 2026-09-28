import { booleanAttribute, Directive, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { ValidationError } from '@angular/forms/signals';
import {
  MENU_SELECTION_GROUP_MULTIPLE,
  MENU_SELECTION_GROUP_TOKEN,
  MenuSelectionGroupDirectiveBase,
  MenuSelectionGroupItem,
} from './menu-selection-group.tokens';
import { controlTouches } from '../../internals/touch-output';

@Directive({
  selector: '[etMenuSelectionGroup]',
  exportAs: 'etMenuSelectionGroup',
  providers: [{ provide: MENU_SELECTION_GROUP_TOKEN, useExisting: MenuSelectionGroupDirective }],
  host: {
    role: 'group',
    '[attr.aria-labelledby]': 'labelId()',
    '[attr.data-disabled]': 'disabled() || null',
    '[attr.data-invalid]': 'shouldDisplayError() || null',
  },
})
export class MenuSelectionGroupDirective implements MenuSelectionGroupDirectiveBase {
  private multipleOverride = inject(MENU_SELECTION_GROUP_MULTIPLE, { optional: true });

  public value = model<unknown | unknown[] | null>(null);
  public touched = model(false);
  public multipleInput = input(false, { alias: 'multiple', transform: booleanAttribute });
  public disabled = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');
  public touch = outputFromObservable(controlTouches(this.touched));

  public multiple = computed(() => this.multipleOverride ?? this.multipleInput());
  public items = signal<MenuSelectionGroupItem[]>([]);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  /** @internal Set by a group label component so `aria-labelledby` can reference it. */
  public labelId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const currentValue = this.value();
      const currentItems = this.items();

      const itemValues = currentItems.map((item) => item.value());

      if (currentItems.length === 0) {
        return;
      }

      untracked(() => {
        if (this.multiple()) {
          const valueArray = Array.isArray(currentValue) ? currentValue : [];

          currentItems.forEach((item, index) => item.checked.set(valueArray.includes(itemValues[index])));
        } else {
          currentItems.forEach((item, index) => item.checked.set(itemValues[index] === currentValue));
        }
      });
    });
  }

  /** @internal */
  public registerItem(item: MenuSelectionGroupItem) {
    this.items.update((items) => [...items, item]);
  }

  /** @internal */
  public unregisterItem(item: MenuSelectionGroupItem) {
    this.items.update((items) => items.filter((registered) => registered !== item));
  }

  public markTouched() {
    this.touched.set(true);
  }

  public select(item: MenuSelectionGroupItem) {
    if (this.disabled() || item.disabled()) {
      return;
    }

    if (this.multiple()) {
      const itemValue = item.value();
      const current = this.value();
      const valueArray = Array.isArray(current) ? current : [];

      const others = valueArray.filter((value) => value !== itemValue);

      item.checked.update((checked) => !checked);
      this.value.set(item.checked() ? this.insertInOptionOrder(others, itemValue) : others);
    } else {
      for (const registered of this.items()) {
        registered.checked.set(registered === item);
      }

      this.value.set(item.value());
    }

    this.markTouched();
  }

  private insertInOptionOrder(values: unknown[], value: unknown) {
    const items = this.items();
    const optionIndex = (candidate: unknown) => items.findIndex((registered) => registered.value() === candidate);
    const index = optionIndex(value);
    const insertAt = values.findIndex((candidate) => optionIndex(candidate) > index);

    return insertAt === -1 ? [...values, value] : [...values.slice(0, insertAt), value, ...values.slice(insertAt)];
  }
}
