import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { DATE_TIME_INPUT_TOKEN, DateTimeInputDirective } from '../../directives/date-time-input';

@Component({
  selector: 'et-date-time-input',
  templateUrl: './date-time-input.component.html',
  styleUrls: ['./date-time-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-date-time-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [
    DateTimeInputDirective,
    { directive: InputDirective, inputs: ['autocomplete', 'placeholder', 'min', 'max'] },
  ],
})
export class DateTimeInputComponent extends DecoratedInputBase {
  protected readonly dateInput = inject(DATE_TIME_INPUT_TOKEN);
}
