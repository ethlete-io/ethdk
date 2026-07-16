import { computed, DestroyRef, Directive, inject, input, model, signal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { createSelectionState } from './internals/selection-state';
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

  public selection = createSelectionState<unknown, SelectionListItem>({
    value: this.value,
    multiple: this.multiple,
    disabled: this.disabled,
  });

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public role = computed(() => (this.multiple() ? 'group' : 'radiogroup'));

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.SELECTION_LIST);

  public describedById = computed(() => this.describedBy());
  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public markTouched() {
    this.touched.set(true);
  }

  public focusItem(item: SelectionListItem) {
    item.elementRef.nativeElement.focus();
  }

  public activate() {
    const firstItem = this.selection.items().find((i) => !i.disabled());

    if (firstItem) {
      this.selection.select(firstItem);
      this.focusItem(firstItem);
    }
  }
}
