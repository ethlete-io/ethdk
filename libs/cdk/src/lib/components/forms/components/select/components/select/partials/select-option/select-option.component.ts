import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { SELECT_OPTION_TOKEN, SELECT_TOKEN, SelectOptionDirective } from '../../directives';

@Component({
  selector: 'et-select-option',
  template: `<h2>Option</h2>`,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-select-option',
  },
  imports: [],
  hostDirectives: [{ directive: SelectOptionDirective, inputs: ['value', 'disabled'] }],
})
export class SelectOptionComponent {
  protected readonly selectOption = inject(SELECT_OPTION_TOKEN);

  private readonly _select = inject(SELECT_TOKEN);
}
