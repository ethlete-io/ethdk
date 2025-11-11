import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StaticFormFieldDirective } from '../../../../directives/static-form-field';
import { SegmentedButtonFieldDirective } from '../../directives/segmented-button-field';

@Component({
  selector: 'et-segmented-button-field',
  template: `
    <div class="et-segmented-button-field-container">
      <ng-content />
    </div>
  `,
  styleUrls: ['./segmented-button-field.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-segmented-button-field',
  },
  hostDirectives: [StaticFormFieldDirective, SegmentedButtonFieldDirective],
})
export class SegmentedButtonFieldComponent {}
