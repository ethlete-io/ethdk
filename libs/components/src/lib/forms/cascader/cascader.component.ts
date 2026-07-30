import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, booleanAttribute, computed, inject, input } from '@angular/core';
import { ColorInteractiveDirective, ProvideColorDirective, injectErrorTheme } from '@ethlete/core';
import { TextButtonComponent } from '../../button';
import { CHEVRON_ICON, IconDirective, TIMES_ICON, provideIcons } from '../../icon';
import { SpinnerComponent } from '../../loader';
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

@Component({
  selector: 'et-cascader',
  templateUrl: './cascader.component.html',
  styleUrl: './cascader.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    CascaderTriggerDirective,
    CascaderSurfaceDirective,
    CascaderColumnDirective,
    CascaderNodeDirective,
    CascaderSearchDirective,
    CascaderSearchOptionDirective,
    CascaderPanelComponent,
    IconDirective,
    NgTemplateOutlet,
    SpinnerComponent,
    TextButtonComponent,
    ProvideColorDirective,
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
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'openChange', 'afterOpen', 'afterClose'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-cascader',
  },
})
export class CascaderComponent {
  protected cascader = inject<CascaderDirective>(CascaderDirective);
  protected errorColorTheme = injectErrorTheme();

  /** Shows a clear (×) control while a value is selected. */
  public clearable = input(true, { transform: booleanAttribute });
  public clearLabel = input('Clear');
  public backLabel = input('Back');
  /** Placeholder of the panel's search input (shown when the data source has a `search` hook). */
  public searchPlaceholder = input('Search');

  protected showClear = computed(
    () =>
      this.clearable() &&
      this.cascader.hasValue() &&
      this.cascader.focused() &&
      !this.cascader.disabled() &&
      !this.cascader.readonly(),
  );

  protected handleClearClick(event: Event) {
    event.stopPropagation();
    this.cascader.clearValue();
    this.cascader.activate();
  }

  protected resultDisabled(path: CascaderNode<unknown>[]) {
    return path[path.length - 1]?.disabled ?? false;
  }

  /**
   * Whether a column sits outside the browse window. It stays mounted (the carousel track
   * slides it out of the clipped viewport) but must not contribute its height to the panel.
   */
  protected isColumnOffstage(columnIndex: number) {
    const start = this.cascader.visibleColumnStart();

    return columnIndex < start || columnIndex >= start + this.cascader.maxVisibleColumns();
  }

  /** Whether a breadcrumb's column is currently inside the window (its level is on screen). */
  protected isCrumbCurrent(columnIndex: number) {
    return !this.isColumnOffstage(columnIndex);
  }
}
