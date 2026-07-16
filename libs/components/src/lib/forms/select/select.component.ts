import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { ColorInteractiveDirective, ProvideColorDirective, injectErrorTheme } from '@ethlete/core';
import { ChipComponent } from '../../chip';
import { CHEVRON_ICON, IconDirective, PLUS_ICON, TIMES_ICON, provideIcons } from '../../icon';
import { SpinnerComponent } from '../../loader';
import { SelectDirective, SelectSurfaceDirective, SelectTriggerDirective, SelectValueContext } from './headless';
import { SelectPanelComponent } from './select-panel.component';

@Component({
  selector: 'et-select',
  templateUrl: './select.component.html',
  styleUrl: './select.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    SelectTriggerDirective,
    SelectSurfaceDirective,
    SelectPanelComponent,
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
        'touched',
        'open',
        'multiple',
        'placeholder',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'filterMode',
        'allowCustomValues',
        'allowAddNew',
        'loading',
        'error',
        'hasMoreItems',
      ],
      outputs: ['valueChange', 'touchedChange', 'openChange', 'queryChange', 'loadMoreRequested', 'addNewRequested'],
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
  /** Shows a clear (×) control while a value is selected. */
  public clearable = input(true);
  public clearLabel = input('Clear');

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
    if (!this.select.registeredValueTemplate() || !this.select.selectedEntries().length) {
      return false;
    }

    return this.select.multiple() || !this.select.query();
  });

  // single select with a custom value template + search: the value display and the query
  // input stack in the same cell (typing hides the template) — side by side they'd wrap
  // the input onto a second line on narrow fields
  protected stackedValue = computed(
    () => this.hasSearch() && !this.select.multiple() && !!this.select.registeredValueTemplate(),
  );

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
