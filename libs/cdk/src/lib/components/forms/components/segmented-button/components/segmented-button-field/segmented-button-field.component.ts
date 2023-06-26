import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StaticFormFieldDirective } from '../../../../directives';
import { SegmentedButtonFieldDirective } from '../../directives';

@Component({
  selector: 'et-segmented-button-field',
  template: `
    <div class="et-segmented-button-field-container">
      <ng-content />
    </div>
  `,
  styleUrls: ['./segmented-button-field.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-field et-segmented-button-field',
  },
  imports: [],
  hostDirectives: [StaticFormFieldDirective, SegmentedButtonFieldDirective],
})
export class SegmentedButtonFieldComponent {}
