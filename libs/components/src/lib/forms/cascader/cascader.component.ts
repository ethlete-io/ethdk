import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
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
        'touched',
        'open',
        'dataSource',
        'multiple',
        'selectableLevels',
        'compareWith',
        'toErrorMessage',
        'mirrorPanelWidth',
        'placeholder',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
      ],
      outputs: ['valueChange', 'touchedChange', 'openChange', 'opened', 'closed'],
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
  public clearable = input(true);
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
}
