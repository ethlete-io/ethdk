import { computed, DestroyRef, Directive, effect, inject, input, model, signal, untracked } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import {
  SELECTION_LIST_MULTIPLE,
  SELECTION_LIST_TOKEN,
  SelectionListDirectiveBase,
  SelectionListItem,
} from './selection-list.tokens';

@Directive({
  selector: '[etSelectionList]',
  providers: [{ provide: SELECTION_LIST_TOKEN, useExisting: SelectionListDirective }],
  host: {
    '[attr.role]': 'role()',
    '[attr.aria-invalid]': 'shouldDisplayError() || null',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-describedby]': 'describedById() || null',
    '[attr.aria-labelledby]': 'labelId() || null',
    '[attr.data-disabled]': 'disabled() || null',
  },
})
export class SelectionListDirective implements SelectionListDirectiveBase, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private multipleOverride = inject(SELECTION_LIST_MULTIPLE, { optional: true });

  public value = model<unknown | unknown[] | null>(null);
  public touched = model(false);
  public multipleInput = input(false, { alias: 'multiple' });
  public disabled = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  public multiple = computed(() => this.multipleOverride ?? this.multipleInput());
  public items = signal<SelectionListItem[]>([]);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public role = computed(() => (this.multiple() ? 'group' : 'radiogroup'));

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.SELECTION_LIST);

  public describedById = computed(() => this.describedBy());
  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  public allSelected = computed(() => {
    const list = this.items();

    if (list.length === 0) {
      return false;
    }

    return list.every((item) => item.checked());
  });

  public someSelected = computed(() => {
    const list = this.items();

    if (list.length === 0) {
      return false;
    }

    const checkedCount = list.filter((item) => item.checked()).length;

    return checkedCount > 0 && checkedCount < list.length;
  });

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    effect(() => {
      const currentValue = this.value();
      const currentItems = this.items();

      if (currentItems.length === 0) {
        return;
      }

      untracked(() => {
        if (this.multiple()) {
          const valueArray = Array.isArray(currentValue) ? currentValue : [];

          for (const item of currentItems) {
            item.checked.set(valueArray.includes(item.value()));
          }
        } else {
          for (const item of currentItems) {
            item.checked.set(item.value() === currentValue);
          }
        }
      });
    });
  }

  public registerItem(item: SelectionListItem) {
    this.items.update((items) => [...items, item]);
  }

  public unregisterItem(item: SelectionListItem) {
    this.items.update((items) => items.filter((i) => i !== item));
  }

  public markTouched() {
    this.touched.set(true);
  }

  public select(item: SelectionListItem) {
    if (this.disabled() || item.disabled()) {
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

  public focusItem(item: SelectionListItem) {
    item.elementRef.nativeElement.focus();
  }

  public toggleAll() {
    if (this.disabled()) {
      return;
    }

    const shouldCheck = !this.allSelected();

    for (const item of this.items()) {
      if (!item.disabled()) {
        item.checked.set(shouldCheck);
      }
    }

    this.value.set(
      this.items()
        .filter((i) => i.checked())
        .map((i) => i.value()),
    );
  }

  public activate() {
    const firstItem = this.items().find((i) => !i.disabled());

    if (firstItem) {
      this.select(firstItem);
      this.focusItem(firstItem);
    }
  }
}
