import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { ColorInteractiveDirective, ProvideColorDirective, createComponentId, injectErrorTheme } from '@ethlete/core';
import { ChipComponent } from '../../chip';
import { CHEVRON_ICON, IconDirective, PLUS_ICON, TIMES_ICON, provideIcons } from '../../icon';
import { SpinnerComponent } from '../../loader';
import { SelectDirective, SelectSurfaceDirective, SelectTriggerDirective, SelectValueContext } from './headless';
import { SelectOptionComponent } from './select-option.component';
import { SelectPanelComponent } from './select-panel.component';
import { SelectVirtualOptionComponent } from './select-virtual-option.component';

@Component({
  selector: 'et-select',
  templateUrl: './select.component.html',
  styleUrl: './select.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    SelectTriggerDirective,
    SelectSurfaceDirective,
    SelectPanelComponent,
    SelectOptionComponent,
    SelectVirtualOptionComponent,
    IconDirective,
    NgTemplateOutlet,
    ChipComponent,
    SpinnerComponent,
    ProvideColorDirective,
  ],
  providers: [provideIcons(CHEVRON_ICON, TIMES_ICON, PLUS_ICON)],
  hostDirectives: [
    {
      directive: SelectDirective,
      inputs: [
        'value',
        'mixed',
        'touched',
        'open',
        'multiple',
        'placeholder',
        'mixedLabel',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'options',
        'filterMode',
        'allowCustomValues',
        'customValueSeparators',
        'normalizeCustomValue',
        'commitCustomValueOnClose',
        'maxSelection',
        'allowAddNew',
        'loading',
        'error',
        'hasMoreItems',
        'pickOnly',
      ],
      outputs: [
        'valueChange',
        'mixedChange',
        'touchedChange',
        'openChange',
        'queryChange',
        'loadMore',
        'addNew',
        'pickOption',
      ],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-select',
  },
})
export class SelectComponent {
  protected select = inject(SelectDirective);
  protected errorColorTheme = injectErrorTheme();

  public loadMoreLabel = input('Load more');
  public addNewLabel = input('Add new');
  /** Leading text of the "Create …" row rendered for `customValueCandidate`. */
  public createLabel = input('Create');
  /** Shows a clear (×) control while a value is selected. */
  public clearable = input(true);
  public clearLabel = input('Clear');
  protected mixedLabelId = createComponentId('et-select-mixed-label');

  // only while the field is in use — `focused` covers the trigger/search input having DOM
  // focus as well as the panel being open
  protected showClear = computed(
    () =>
      this.clearable() &&
      this.select.hasValue() &&
      this.select.focused() &&
      !this.select.disabled() &&
      !this.select.readonly(),
  );

  public hasSearch = computed(() => !!this.select.registeredSearch());

  // whether the default value/placeholder span renders — never with an inline search
  // input: in single mode the input itself displays the selected label, in multi mode
  // the chips (or the input's placeholder) carry the value display. With a custom value
  // template it only covers the empty state (placeholder) of search-less selects.
  protected showValueLabel = computed(() => {
    const hasSearch = this.hasSearch();
    const entryCount = this.select.selectedEntries().length;

    if (this.select.mixed()) {
      return !hasSearch || this.select.multiple();
    }

    if (this.select.registeredValueTemplate()) {
      return !hasSearch && entryCount === 0;
    }

    if (this.select.multiple()) {
      return !hasSearch && entryCount === 0;
    }

    return !hasSearch;
  });

  protected valueContext = computed<SelectValueContext>(() => ({
    $implicit: this.select.selectedEntries(),
    select: this.select,
  }));

  // the custom value display coexists with an inline search input: while typing in single
  // mode the query replaces the visual value; in multi mode it stays visible (like chips).
  // Never rendered without a selection — an empty wrapper would keep the caret/placeholder
  // CSS rules active and the field would look dead
  protected showCustomValue = computed(() => {
    if (this.select.mixed() || !this.select.registeredValueTemplate() || !this.select.selectedEntries().length) {
      return false;
    }

    if (this.select.multiple()) {
      return true;
    }

    // single select: the rich template is the resting display — while the field is focused it
    // gives way to the editable label text in the search input (see the search directive)
    return !this.select.query() && !this.select.focused();
  });

  // single select with a custom value template + search: the value display and the query
  // input stack in the same cell (typing hides the template) — side by side they'd wrap
  // the input onto a second line on narrow fields
  protected stackedValue = computed(
    () => this.hasSearch() && !this.select.multiple() && !!this.select.registeredValueTemplate(),
  );

  constructor() {
    this.select.mixedLabelId.set(this.mixedLabelId);
  }

  protected handleClearClick(event: Event) {
    // clearing must not toggle the panel
    event.stopPropagation();
    this.select.clearValue();
    this.select.activate();
  }

  protected handleArrowClick(event: Event) {
    // with an inline search input, a field click focuses the input and opens — the chevron
    // is the one place that still toggles closed
    if (this.hasSearch() && this.select.open()) {
      event.stopPropagation();
      this.select.hide();
    }
  }
}
