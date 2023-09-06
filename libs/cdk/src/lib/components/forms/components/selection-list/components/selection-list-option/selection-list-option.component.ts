import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { SelectionListOptionDirective } from '../../directives';

@Component({
  selector: 'et-selection-list-option',
  template: `<ng-content />`,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [],
  hostDirectives: [{ directive: SelectionListOptionDirective, inputs: ['value', 'disabled'] }],
})
export class SelectionListOptionComponent {}
