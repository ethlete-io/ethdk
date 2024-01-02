import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { DecoratedInputBase } from '../../../../utils';
import { DATE_INPUT_TOKEN, DateInputDirective } from '../../directives';

@Component({
  selector: 'et-date-input',
  templateUrl: './date-input.component.html',
  styleUrls: ['./date-input.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-date-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [
    DateInputDirective,
    { directive: InputDirective, inputs: ['autocomplete', 'placeholder', 'withTime'] },
  ],
})
export class DateInputComponent extends DecoratedInputBase {
  protected readonly dateInput = inject(DATE_INPUT_TOKEN);
}
