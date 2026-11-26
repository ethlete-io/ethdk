import { AsyncPipe } from '@angular/common';
import { Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { DATE_TIME_INPUT_TOKEN, DateTimeInputDirective } from '../../directives/date-time-input';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-date-time-input',
  templateUrl: './date-time-input.component.html',
  styleUrls: ['./date-time-input.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-date-time-input et-legacy',
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
