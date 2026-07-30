import { booleanAttribute, computed, DestroyRef, Directive, inject, input, model, signal } from '@angular/core';
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
    '[attr.aria-describedby]': 'describedBy() || null',
    '[attr.aria-labelledby]': 'labelId() || null',
    '[attr.data-disabled]': 'disabled() || null',
    '[attr.data-mixed]': 'mixed() || null',
    // aria-readonly is only valid on radiogroup, not on group — the multi case reflects it
    // per option instead (role=checkbox supports it)
    '[attr.aria-readonly]': '!multiple() && readonly() || null',
    '[attr.data-readonly]': 'readonly() || null',
  },
})
export class SelectionListDirective implements SelectionListDirectiveBase, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private multipleOverride = inject(SELECTION_LIST_MULTIPLE, { optional: true });

  public value = model<unknown | unknown[] | null>(null);
  /**
   * View state for a group whose source values disagree (bulk edit). The raw `value` stays
   * untouched but no option reports as checked; the first user commit replaces it and
   * resolves the flag. There is no text display slot — the masking itself is the presentation.
   */
  public mixed = model(false);
  public touched = model(false);
  public multipleInput = input(false, { alias: 'multiple', transform: booleanAttribute });
  public disabled = input(false, { transform: booleanAttribute });
  /** View-only: options keep their normal look and focusability but cannot be (de)selected. */
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');

  public multiple = computed(() => this.multipleOverride ?? this.multipleInput());

  public selection = createSelectionState<unknown, SelectionListItem>({
    value: this.value,
    multiple: this.multiple,
    disabled: this.disabled,
    // every option is rendered, so a destroyed checked option is genuinely gone — drop its
    // stranded value from the model (the select family renders lazily and must not prune)
    pruneValueOnUnregister: true,
    // masking + first-commit-replaces live in the selection state, so aria-checked and all
    // styled visuals (which key off the options' checked state) follow automatically
    mixed: this.mixed,
  });

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public role = computed(() => (this.multiple() ? 'group' : 'radiogroup'));

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.SELECTION_LIST);

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
      if (!this.readonly()) {
        this.selection.select(firstItem);
      }

      this.focusItem(firstItem);
    }
  }
}
