import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { InputBase } from '../../../../utils';
import { RADIO_TOKEN, RadioDirective } from '../../directives/radio';
import { RADIO_GROUP_TOKEN } from '../../directives/radio-group';

@Component({
  selector: 'et-radio',
  templateUrl: './radio.component.html',
  styleUrls: ['./radio.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-radio',
  },
  imports: [AsyncPipe, NgClass, NativeInputRefDirective],
  hostDirectives: [
    { directive: RadioDirective, inputs: ['value', 'disabled'] },
    { directive: InputDirective, inputs: ['autocomplete'] },
  ],
})
export class RadioComponent extends InputBase {
  protected readonly radio = inject(RADIO_TOKEN);
  protected readonly radioGroup = inject(RADIO_GROUP_TOKEN);
}
