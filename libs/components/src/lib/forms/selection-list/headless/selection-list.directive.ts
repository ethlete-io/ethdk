import {
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { ValidationError } from '@angular/forms/signals';
import { signalElementMutations } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { isSameOrder, sortByDomOrder } from '../../../internals/dom-order';
import { createTypeahead } from '../../../internals/typeahead';
import { createSelectionState } from './internals/selection-state';
import {
  SELECTION_LIST_MULTIPLE,
  SELECTION_LIST_TOKEN,
  SelectionListCompareWith,
  SelectionListDirectiveBase,
  SelectionListItem,
} from './selection-list.tokens';
import { controlTouches } from '../../../internals/touch-output';
import { FieldStateControlDirective } from '../../form-field/headless/field-state-control.directive';

const sortConnectedItems = (items: SelectionListItem[]) =>
  items.some((item) => !item.elementRef.nativeElement.isConnected)
    ? items
    : sortByDomOrder(items, (item) => item.elementRef.nativeElement);

const referenceEquality: SelectionListCompareWith = (a, b) => a === b;

@Directive({
  selector: '[etSelectionList]',
  providers: [{ provide: SELECTION_LIST_TOKEN, useExisting: SelectionListDirective }],
  host: {
    '[attr.role]': 'role()',
    '[attr.aria-invalid]': 'shouldDisplayError() || null',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-describedby]': 'describedBy() || null',
    '[attr.aria-label]': 'ariaLabel()?.trim() || null',
    '[attr.aria-labelledby]': 'labelId() || null',
    '[attr.data-disabled]': 'disabled() || null',
    '[attr.data-mixed]': 'mixed() || null',
    '[attr.aria-readonly]': '!multiple() && readonly() || null',
    '[attr.data-readonly]': 'readonly() || null',
  },
})
export class SelectionListDirective
  extends FieldStateControlDirective
  implements SelectionListDirectiveBase, FormFieldControl
{
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private multipleOverride = inject(SELECTION_LIST_MULTIPLE, { optional: true });

  public value = model<unknown | unknown[] | null>(null);
  /**
   * View state for a group whose source values disagree (bulk edit). The raw `value` stays
   * untouched but no option reports as checked; the first user commit replaces it and
   * resolves the flag. There is no text display slot - the masking itself is the presentation.
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
  /** True while an async validator runs on the bound field (bound by signal forms); the field shows it as busy. */
  public pending = input(false, { transform: booleanAttribute });
  /**
   * Decides whether an option's value and a value in the model are the same choice - set it when
   * values are objects that are not the same instance (e.g. `(a, b) => a.id === b.id`). Only
   * called with two non-null values; identical values always match. Defaults to `===`.
   */
  public compareWith = input<SelectionListCompareWith<never>>(referenceEquality);
  public touch = outputFromObservable(controlTouches(this.touched));

  public multiple = computed(() => this.multipleOverride ?? this.multipleInput());

  private valuesMatch = computed<SelectionListCompareWith>(() => {
    const compareWith = this.compareWith() as SelectionListCompareWith;

    return (a, b) => a === b || (a !== null && a !== undefined && b !== null && b !== undefined && compareWith(a, b));
  });

  public selection = createSelectionState<unknown, SelectionListItem>({
    value: this.value,
    multiple: this.multiple,
    disabled: this.disabled,
    pruneValueOnUnregister: true,
    mixed: this.mixed,
    compareWith: this.valuesMatch,
    orderItems: sortConnectedItems,
  });

  private childMutations = signalElementMutations(inject<ElementRef<HTMLElement>>(ElementRef), {
    childList: true,
    subtree: true,
  });

  /** The registered options in DOM order, which a keyed `@for` can change without re-registering any. */
  public items = computed(
    () => {
      this.childMutations();

      return sortConnectedItems(this.selection.items());
    },
    { equal: isSameOrder },
  );

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public role = computed(() => (this.multiple() ? 'group' : 'radiogroup'));

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.SELECTION_LIST);

  private typeahead = createTypeahead();

  constructor() {
    super();

    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => {
      this.formField?.unregisterControl(this);
      this.typeahead.destroy();
    });
  }

  public markTouched() {
    this.touched.set(true);
  }

  public focusItem(item: SelectionListItem, options?: FocusOptions) {
    item.elementRef.nativeElement.focus(options);
  }

  /** @internal */
  public findTypeaheadMatch(character: string, from: SelectionListItem) {
    const query = this.typeahead.append(character);
    const items = this.items();
    const offset = query.length === 1 ? 1 : 0;
    const start = items.indexOf(from) + offset;

    for (let step = 0; step < items.length; step++) {
      const item = items[(start + step + items.length) % items.length];

      if (item && !item.disabled() && item.label().trim().toLowerCase().startsWith(query)) {
        return item;
      }
    }

    return null;
  }

  /** Mirrors the group's roving tabindex: the checked option, else the first enabled one. */
  public focus(options?: FocusOptions) {
    if (this.disabled()) {
      return;
    }

    const items = this.items();
    const target = items.find((item) => item.checked() && !item.disabled()) ?? items.find((item) => !item.disabled());

    if (target) {
      this.focusItem(target, options);
    }
  }

  public activate() {
    this.focus({ preventScroll: true });
  }
}
