import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { TIME_INPUT_TOKEN, TimeInputDirective } from '../../directives/time-input';

@Component({
  selector: 'et-time-input',
  templateUrl: './time-input.component.html',
  styleUrls: ['./time-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-time-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [TimeInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class TimeInputComponent extends DecoratedInputBase {
  protected readonly timeInput = inject(TIME_INPUT_TOKEN);
}
