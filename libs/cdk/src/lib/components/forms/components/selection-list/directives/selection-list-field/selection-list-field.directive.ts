import { FocusKeyManager } from '@angular/cdk/a11y';
import { A, ENTER, SPACE, hasModifierKey } from '@angular/cdk/keycodes';
import {
  ContentChildren,
  Directive,
  InjectionToken,
  Input,
  QueryList,
  booleanAttribute,
  inject,
  signal,
} from '@angular/core';
import { TypedQueryList, createDestroy } from '@ethlete/core';
import { takeUntil } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';
import { Primitive } from '../../../select/components/combobox/utils';
import { SELECTION_LIST_OPTION, SelectionListOptionDirective } from '../selection-list-option';

export const SELECTION_LIST_FIELD = new InjectionToken<SelectionListFieldDirective>(
  'ET_SELECTION_LIST_FIELD_DIRECTIVE_TOKEN',
);

@Directive({
  providers: [{ provide: SELECTION_LIST_FIELD, useExisting: SelectionListFieldDirective }],
  exportAs: 'etSelectionListField',
  host: {
    class: 'et-selection-list-field',
    '[class.et-selection-list-field--multiple]': 'multiple',
    role: 'listbox',
    '[attr.aria-multiselectable]': 'multiple',
    '[attr.aria-disabled]': 'input.disabled',
    '(keydown)': '_handleKeydown($event)',
  },
})
export class SelectionListFieldDirective {
  private readonly _destroy$ = createDestroy();

  private _keyManager: FocusKeyManager<SelectionListOptionDirective> | null = null;
  readonly input = inject<InputDirective<Primitive | Primitive[] | null>>(INPUT_TOKEN);

  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  @ContentChildren(SELECTION_LIST_OPTION)
  set options(value: TypedQueryList<SelectionListOptionDirective> | null) {
    this._options.set(value);

    if (value && !this._keyManager) {
      this._setupRovingTabindex(value);
    }
  }
  private _options = signal<TypedQueryList<SelectionListOptionDirective> | null>(null);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input({ transform: booleanAttribute })
  get multiple(): boolean {
    return this._multiple();
  }
  set multiple(value: boolean) {
    this._multiple.set(value);
  }
  private _multiple = signal<boolean>(false);

  protected _handleKeydown(event: KeyboardEvent) {
    const activeItem = this._keyManager?.activeItem;

    if (
      (event.keyCode === ENTER || event.keyCode === SPACE) &&
      !this._keyManager?.isTyping() &&
      activeItem &&
      !activeItem.disabled
    ) {
      event.preventDefault();
      activeItem._toggleSelected();
    } else if (
      event.keyCode === A &&
      this.multiple &&
      !this._keyManager?.isTyping() &&
      hasModifierKey(event, 'ctrlKey')
    ) {
      const shouldSelect = this._options()?.some(
        (option) => !option?.disabled && !option?.selected() && !option?.isResetOption,
      );
      event.preventDefault();
      this._setAllOptionsSelected(shouldSelect ?? true);
    } else {
      this._keyManager?.onKeydown(event);
    }
  }

  private _setupRovingTabindex(queryList: TypedQueryList<SelectionListOptionDirective>) {
    this._keyManager = new FocusKeyManager(queryList as QueryList<SelectionListOptionDirective>)
      .withHomeAndEnd()
      .withTypeAhead()
      .withWrap()
      .skipPredicate(() => this.input.disabled);

    // Set the initial focus.
    this._resetActiveOption();

    // Move the tabindex to the currently-focused list item.
    this._keyManager.change
      .pipe(takeUntil(this._destroy$))
      .subscribe((activeItemIndex) => this._setActiveOption(activeItemIndex));

    // If the active item is removed from the list, reset back to the first one.
    queryList.changes.pipe(takeUntil(this._destroy$)).subscribe(() => {
      const activeItem = this._keyManager?.activeItem;

      if (!activeItem || !queryList.toArray().indexOf(activeItem)) {
        this._resetActiveOption();
      }
    });
  }

  private _setActiveOption(index: number) {
    this._options()?.forEach((item, itemIndex) => item?._setTabindex(itemIndex === index ? 0 : -1));
    this._keyManager?.updateActiveItem(index);
  }

  private _resetActiveOption() {
    if (this.input.disabled) {
      this._setActiveOption(-1);
      return;
    }

    const list = this._options();
    if (!list) return;

    const activeItem = list.find((item) => !!item && item.selected() && !item.disabled) || list.first;
    this._setActiveOption(activeItem ? list.toArray().indexOf(activeItem) : -1);
  }

  private _setAllOptionsSelected(shouldSelectAll: boolean) {
    if (!this.multiple) return;

    const options = this._options()?.toArray() as SelectionListOptionDirective[] | undefined;

    if (!options) return;

    if (shouldSelectAll) {
      const values = options.filter((o) => !o.disabled && !o.isResetOption).map((o) => o.value);

      this.input._updateValue(values);
    } else {
      this.input._updateValue([]);
    }
  }
}
