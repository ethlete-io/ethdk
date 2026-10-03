import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, booleanAttribute, computed, inject, input, viewChild } from '@angular/core';
import { ColorInteractiveDirective, ProvideColorDirective, signalDeferredLoading } from '@ethlete/core';
import { TextButtonComponent } from '../../button';
import { FocusRingDirective } from '../../focus-ring';
import { CHEVRON_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../icon';
import { SpinnerComponent } from '../../loader';
import { ScrollbarComponent } from '../../scrollbar';
import { mountControlSuffixStyles } from '../form-field/form-field-control-suffix-styles.component';
import { ControlSuffixDirective } from '../form-field/partials';
import { CascaderPanelComponent } from './cascader-panel.component';
import {
  CascaderColumnDirective,
  CascaderDirective,
  CascaderNode,
  CascaderNodeDirective,
  CascaderSearchDirective,
  CascaderSearchOptionDirective,
  CascaderSurfaceDirective,
  CascaderTriggerDirective,
} from './headless';
import { injectFormFieldLabels } from '../form-field/form-field-labels';
import { injectCascaderLabels } from './cascader-labels';
import { ACCESSIBLE_NAME_INPUTS } from '../form-field/headless';
import { FIELD_STATE_INPUTS } from '../form-field/headless/field-state-control.directive';
import { SemanticThemesDirective } from '../../internals/semantic-themes.directive';

@Component({
  selector: 'et-cascader',
  templateUrl: './cascader.component.html',
  styleUrl: './cascader.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    CascaderTriggerDirective,
    CascaderSurfaceDirective,
    ControlSuffixDirective,
    CascaderColumnDirective,
    CascaderNodeDirective,
    CascaderSearchDirective,
    CascaderSearchOptionDirective,
    CascaderPanelComponent,
    IconDirective,
    NgTemplateOutlet,
    ScrollbarComponent,
    SpinnerComponent,
    TextButtonComponent,
    ProvideColorDirective,
    FocusRingDirective,
    SemanticThemesDirective,
  ],
  providers: [provideIcons(CHEVRON_ICON, TIMES_ICON)],
  hostDirectives: [
    {
      directive: CascaderDirective,
      inputs: [
        'value',
        'mixed',
        'touched',
        'open',
        'dataSource',
        'multiple',
        'selectableLevels',
        'compareWith',
        'toErrorMessage',
        'mirrorPanelWidth',
        'maxVisibleColumns',
        'mixedLabel',
        'placeholder',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'maxLength',
        'pending',
        ...ACCESSIBLE_NAME_INPUTS,
        ...FIELD_STATE_INPUTS,
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'touch', 'openChange', 'afterOpen', 'afterClose'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-cascader',
  },
})
export class CascaderComponent {
  protected cascaderLabels = injectCascaderLabels();

  private formFieldLabels = injectFormFieldLabels();

  protected cascader = inject<CascaderDirective>(CascaderDirective);

  /** Shows a clear (×) control while a value is selected. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);
  public backLabel = input<string | null>(null);
  /** Placeholder of the panel's search input (shown when the data source has a `search` hook). */
  public searchPlaceholder = input<string | null>(null);

  private panelThemes = viewChild(SemanticThemesDirective);

  protected errorColorTheme = computed(() => this.panelThemes()?.themes.error() ?? null);

  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  protected resolvedBackLabel = computed(() => this.backLabel() ?? this.cascaderLabels().back);

  protected resolvedSearchPlaceholder = computed(() => this.searchPlaceholder() ?? this.cascaderLabels().search);

  protected showClear = computed(
    () =>
      this.clearable() &&
      this.cascader.hasValue() &&
      this.cascader.focused() &&
      !this.cascader.disabled() &&
      !this.cascader.readonly(),
  );

  private columnLoading = computed(() => this.cascader.columns().some((column) => column.status === 'loading'));

  protected showColumnSpinner = signalDeferredLoading(this.columnLoading);

  protected showSearchSpinner = signalDeferredLoading(() => this.cascader.searchState().status === 'loading');

  constructor() {
    mountControlSuffixStyles();
  }

  protected handleClearClick(event: Event) {
    event.stopPropagation();
    this.cascader.clearValue();
    this.cascader.activate();
  }

  protected handleArrowClick(event: Event) {
    // the chevron renders in the field's suffix stack, outside the trigger, so its click never
    // reaches the trigger's own toggle - it owns the whole gesture
    event.stopPropagation();
    this.cascader.toggle();
    this.cascader.activate();
  }

  protected resultDisabled(path: CascaderNode<unknown>[]) {
    return path[path.length - 1]?.disabled ?? false;
  }

  protected isColumnOffstage(columnIndex: number) {
    const start = this.cascader.visibleColumnStart();

    return columnIndex < start || columnIndex >= start + this.cascader.maxVisibleColumns();
  }

  protected isCrumbCurrent(columnIndex: number) {
    return !this.isColumnOffstage(columnIndex);
  }

  public focus(options?: FocusOptions) {
    this.cascader.focus(options);
  }
}
