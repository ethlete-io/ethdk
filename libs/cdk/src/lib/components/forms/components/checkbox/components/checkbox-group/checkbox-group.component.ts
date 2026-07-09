import { Component, ViewEncapsulation } from '@angular/core';
import { StaticFormGroupDirective } from '../../../../directives/static-form-group';
import { CheckboxGroupDirective } from '../../directives/checkbox-group';

@Component({
  selector: 'et-checkbox-group',
  template: ` <ng-content /> `,
  styleUrls: ['./checkbox-group.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-group et-checkbox-group',
  },
  hostDirectives: [CheckboxGroupDirective, StaticFormGroupDirective],
})
export class CheckboxGroupComponent {}
