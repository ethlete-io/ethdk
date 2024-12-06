import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { SELECT_OPTION_TOKEN, SelectOptionDirective } from '../../directives/select-option';

@Component({
  selector: 'et-select-option',
  template: ` <ng-content /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-select-option',
  },
  imports: [NgTemplateOutlet],
  hostDirectives: [{ directive: SelectOptionDirective, inputs: ['value', 'disabled', 'label'] }],
})
export class SelectOptionComponent {
  protected readonly selectOption = inject(SELECT_OPTION_TOKEN);
}
