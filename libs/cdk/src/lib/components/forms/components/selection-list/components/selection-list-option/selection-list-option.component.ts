import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { SelectionListOptionDirective } from '../../directives/selection-list-option';

@Component({
  selector: 'et-selection-list-option',
  template: `
    <div class="et-selection-list-option-content">
      <ng-content />
    </div>

    <div class="et-selection-list-option-state">
      <div class="et-selection-list-option-state-check"></div>
    </div>
  `,
  styleUrls: ['./selection-list-option.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: SelectionListOptionDirective, inputs: ['value', 'disabled', 'isResetOption'] }],
})
export class SelectionListOptionComponent {}
