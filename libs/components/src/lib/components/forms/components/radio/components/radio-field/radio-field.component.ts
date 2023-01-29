import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StaticFormFieldDirective } from '../../../../directives';
import { RadioFieldDirective } from '../../directives';

@Component({
  selector: 'et-radio-field',
  template: `
    <div class="et-radio-field-container">
      <ng-content select="et-radio" />
      <ng-content select="et-label" />
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-radio-field',
  },
  hostDirectives: [StaticFormFieldDirective, RadioFieldDirective],
})
export class RadioFieldComponent {}
