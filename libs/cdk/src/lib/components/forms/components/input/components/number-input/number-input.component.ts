import { AsyncPipe } from '@angular/common';
import { Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { NUMBER_INPUT_TOKEN, NumberInputDirective } from '../../directives/number-input';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-number-input',
  templateUrl: './number-input.component.html',
  styleUrls: ['./number-input.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-number-input et-legacy',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [
    NumberInputDirective,
    { directive: InputDirective, inputs: ['autocomplete', 'placeholder', 'min', 'max'] },
  ],
})
export class NumberInputComponent extends DecoratedInputBase {
  protected readonly numberInput = inject(NUMBER_INPUT_TOKEN);
}
