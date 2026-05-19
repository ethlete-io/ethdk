import { computed, Directive, signal } from '@angular/core';
import { CHECKBOX_GROUP_TOKEN, CheckboxGroupDirectiveBase, CheckboxGroupItem } from './checkbox-group.tokens';

@Directive({
  selector: '[etCheckboxGroup]',
  providers: [{ provide: CHECKBOX_GROUP_TOKEN, useExisting: CheckboxGroupDirective }],
})
export class CheckboxGroupDirective implements CheckboxGroupDirectiveBase {
  private items = signal<CheckboxGroupItem[]>([]);

  public allChecked = computed(() => {
    const list = this.items();

    if (list.length === 0) {
      return false;
    }

    return list.every((item) => item.checked());
  });

  public someChecked = computed(() => {
    const list = this.items();

    if (list.length === 0) {
      return false;
    }

    const checkedCount = list.filter((item) => item.checked()).length;

    return checkedCount > 0 && checkedCount < list.length;
  });

  public noneChecked = computed(() => {
    const list = this.items();

    if (list.length === 0) {
      return true;
    }

    return list.every((item) => !item.checked());
  });

  public registerItem(item: CheckboxGroupItem) {
    this.items.update((items) => [...items, item]);
  }

  public unregisterItem(item: CheckboxGroupItem) {
    this.items.update((items) => items.filter((i) => i !== item));
  }

  public toggleAll() {
    const currentlyAllChecked = this.allChecked();
    const shouldCheck = !currentlyAllChecked;

    for (const item of this.items()) {
      item.checked.set(shouldCheck);
      item.indeterminate?.set(false);
    }
  }
}
