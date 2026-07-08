import { Directive, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import {
  MENU_SELECTION_GROUP_MULTIPLE,
  MENU_SELECTION_GROUP_TOKEN,
  MenuSelectionGroupDirectiveBase,
  MenuSelectionGroupItem,
} from './menu-selection-group.tokens';

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
  public multipleInput = input(false, { alias: 'multiple' });
  public disabled = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

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
      item.checked.update((checked) => !checked);
      this.value.set(
        this.items()
          .filter((registered) => registered.checked())
          .map((registered) => registered.value()),
      );
    } else {
      for (const registered of this.items()) {
        registered.checked.set(registered === item);
      }

      this.value.set(item.value());
    }

    this.markTouched();
  }
}
