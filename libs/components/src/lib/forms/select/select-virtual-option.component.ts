import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { CHECK_ICON, IconDirective, provideIcons } from '../../icon';
import { SelectDirective, SelectOptionTemplateContext, SelectVirtualOptionDirective } from './headless';

/**
 * One windowed row of a data-driven (`options` input) select. Looks and behaves exactly
 * like `et-select-option`, but renders a select-owned item instead of registering its own -
 * `et-select` creates these for `virtualizedItems()`.
 */
@Component({
  selector: 'et-select-virtual-option',
  template: `
    <span class="et-select-option-label">
      @if (select.registeredOptionTemplate(); as optionTemplate) {
        <ng-template [ngTemplateOutlet]="optionTemplate.templateRef" [ngTemplateOutletContext]="templateContext()" />
      } @else {
        {{ virtualOption.item().label() }}
      }
    </span>

    <span class="et-select-option-check">
      <i etIcon="et-check"></i>
    </span>
  `,
  // shares the option stylesheet on purpose: in pure data-driven mode no et-select-option
  // instance may exist, and Angular only keeps a component's styles loaded while an
  // instance of that component lives - the class alone would not bring the CSS with it
  styleUrl: './select-option.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective, NgTemplateOutlet],
  providers: [provideIcons(CHECK_ICON)],
  hostDirectives: [
    {
      directive: SelectVirtualOptionDirective,
      inputs: ['etSelectVirtualOption: item'],
    },
  ],
  host: {
    class: 'et-select-option',
  },
})
export class SelectVirtualOptionComponent {
  protected select = inject(SelectDirective);
  protected virtualOption = inject(SelectVirtualOptionDirective);

  protected templateContext = computed<SelectOptionTemplateContext>(() => {
    const item = this.virtualOption.item();

    return {
      $implicit: item.data?.() ?? { value: item.value(), label: item.label() },
      item,
    };
  });
}
