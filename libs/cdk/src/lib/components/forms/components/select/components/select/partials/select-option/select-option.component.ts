import { Component, ViewEncapsulation, inject } from '@angular/core';
import { SELECT_OPTION_TOKEN, SelectOptionDirective } from '../../directives/select-option';

@Component({
  selector: 'et-select-option',
  template: ` <ng-content /> `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-select-option et-legacy',
  },
  hostDirectives: [{ directive: SelectOptionDirective, inputs: ['value', 'disabled', 'label'] }],
})
export class SelectOptionComponent {
  protected readonly selectOption = inject(SELECT_OPTION_TOKEN);
}
