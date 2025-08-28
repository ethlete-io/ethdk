import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { NUMBER_INPUT_TOKEN, NumberInputDirective } from '../../directives/number-input';

@Component({
  selector: 'et-number-input',
  templateUrl: './number-input.component.html',
  styleUrls: ['./number-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-number-input',
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
