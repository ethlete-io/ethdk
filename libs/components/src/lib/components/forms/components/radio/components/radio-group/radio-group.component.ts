import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { DYNAMIC_FORM_GROUP_DIRECTIVE_PUBLIC_API } from '../../../../directives';
import { RadioGroupDirective } from '../../directives';

@Component({
  selector: 'et-radio-group',
  templateUrl: './radio-group.component.html',
  styleUrls: ['./radio-group.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-radio-group',
  },
  hostDirectives: [...DYNAMIC_FORM_GROUP_DIRECTIVE_PUBLIC_API, RadioGroupDirective],
})
export class RadioGroupComponent {}
