import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StaticFormFieldDirective } from '../../../../directives';
import { RadioFieldDirective } from '../../directives';

@Component({
  selector: 'et-radio-field',
  template: `<ng-content />`,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-radio-field',
  },
  hostDirectives: [StaticFormFieldDirective, RadioFieldDirective],
})
export class RadioFieldComponent {}
