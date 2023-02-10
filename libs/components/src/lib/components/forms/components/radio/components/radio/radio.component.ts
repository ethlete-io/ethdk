import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { InputBase } from '../../../../utils';
import { RadioDirective, RADIO_GROUP_TOKEN, RADIO_TOKEN } from '../../directives';

@Component({
  selector: 'et-radio',
  templateUrl: './radio.component.html',
  styleUrls: ['./radio.component.scss'],
  standalone: true,
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
