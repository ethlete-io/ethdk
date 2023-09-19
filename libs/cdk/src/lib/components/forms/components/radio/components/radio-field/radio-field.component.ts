import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StaticFormFieldDirective } from '../../../../directives';
import { RadioFieldDirective } from '../../directives';

@Component({
  selector: 'et-radio-field, et-radio-card-field',
  template: `
    <div class="et-radio-field-container">
      <ng-content />
      <ng-content />
    </div>
  `,
  styleUrls: ['./radio-field.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-radio-field',
  },
  hostDirectives: [StaticFormFieldDirective, RadioFieldDirective],
})
export class RadioFieldComponent {}
