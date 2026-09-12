import { NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { ColorInteractiveDirective, ProvideColorDirective, createComponentId, injectErrorTheme } from '@ethlete/core';
import { CHIP_REMOVE_TAB_STOP, ChipComponent } from '../../chip';
import { CHEVRON_ICON, IconDirective, PLUS_ICON, TIMES_ICON, provideIcons } from '../../icon';
import { SpinnerComponent } from '../../loader';
import { mountControlSuffixStyles } from '../form-field/form-field-control-suffix-styles.component';
import { ControlSuffixDirective } from '../form-field/partials';
import { SelectDirective, SelectSurfaceDirective, SelectTriggerDirective, SelectValueContext } from './headless';
import { SelectOptionComponent } from './select-option.component';
import { SelectPanelComponent } from './select-panel.component';
import { SelectVirtualOptionComponent } from './select-virtual-option.component';
import { injectFormFieldLabels } from '../../forms/form-field/form-field-labels';
import { injectSelectLabels } from '../../forms/select/select-labels';
import { ACCESSIBLE_NAME_INPUTS } from '../form-field/headless';

@Component({
  selector: 'et-select',
  templateUrl: './select.component.html',
  styleUrl: './select.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    SelectTriggerDirective,
    SelectSurfaceDirective,
    ControlSuffixDirective,
    SelectPanelComponent,
    SelectOptionComponent,
    SelectVirtualOptionComponent,
    IconDirective,
    NgTemplateOutlet,
    ChipComponent,
    SpinnerComponent,
    ProvideColorDirective,
  ],
  providers: [provideIcons(CHEVRON_ICON, TIMES_ICON, PLUS_ICON), { provide: CHIP_REMOVE_TAB_STOP, useValue: false }],
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
        'mirrorPanelWidth',
        ...ACCESSIBLE_NAME_INPUTS,
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
  protected selectLabels = injectSelectLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected select = inject(SelectDirective);
  protected errorColorTheme = injectErrorTheme();

  public loadMoreLabel = input<string | null>(null);
  public addNewLabel = input<string | null>(null);
  /** Leading text of the "Create …" row rendered for `customValueCandidate`. */
  public createLabel = input<string | null>(null);
  /** Shows a clear (×) control while a value is selected. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  protected resolvedLoadMoreLabel = computed(() => this.loadMoreLabel() ?? this.selectLabels().loadMore);

  protected resolvedAddNewLabel = computed(() => this.addNewLabel() ?? this.selectLabels().addNew);

  protected resolvedCreateLabel = computed(() => this.createLabel() ?? this.selectLabels().create);

  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);
  protected mixedLabelId = createComponentId('et-select-mixed-label');

  protected showClear = computed(
    () =>
      this.clearable() &&
      this.select.hasValue() &&
      this.select.focused() &&
      !this.select.disabled() &&
      !this.select.readonly(),
  );

  public hasSearch = computed(() => !!this.select.registeredSearch());

  protected showLoadingRow = computed(() => this.select.loading() && !this.select.visibleItems().length);

  protected showLoadMoreLoading = computed(
    () =>
      this.select.hasMoreItems() &&
      !this.showLoadingRow() &&
      this.select.loadingMore() &&
      this.select.showLoadingIndicator(),
  );

  protected showBusyBar = computed(
    () => this.select.showLoadingIndicator() && this.select.visibleItems().length > 0 && !this.showLoadMoreLoading(),
  );

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

  protected showCustomValue = computed(() => {
    if (this.select.mixed() || !this.select.registeredValueTemplate() || !this.select.selectedEntries().length) {
      return false;
    }

    if (this.select.multiple()) {
      return true;
    }

    return !this.select.query() && !this.select.focused();
  });

  protected stackedValue = computed(
    () => this.hasSearch() && !this.select.multiple() && !!this.select.registeredValueTemplate(),
  );

  constructor() {
    mountControlSuffixStyles();
    this.select.mixedLabelId.set(this.mixedLabelId);
  }

  protected handleClearClick(event: Event) {
    event.stopPropagation();
    this.select.clearValue();
    this.select.activate();
  }

  protected handleArrowClick(event: Event) {
    event.stopPropagation();
    this.select.toggle();
    this.select.activate();
  }

  public focus(options?: FocusOptions) {
    this.select.focus(options);
  }
}
