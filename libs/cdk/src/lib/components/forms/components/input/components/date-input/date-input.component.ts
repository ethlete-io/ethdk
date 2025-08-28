import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { DATE_INPUT_TOKEN, DateInputDirective } from '../../directives/date-input';

@Component({
  selector: 'et-date-input',
  templateUrl: './date-input.component.html',
  styleUrls: ['./date-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-date-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [
    DateInputDirective,
    { directive: InputDirective, inputs: ['autocomplete', 'placeholder', 'min', 'max'] },
  ],
})
export class DateInputComponent extends DecoratedInputBase {
  protected readonly dateInput = inject(DATE_INPUT_TOKEN);
}
