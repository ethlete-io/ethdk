import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { DestroyService } from '@ethlete/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { DecoratedInputBase } from '../../../../utils';
import { NumberInputDirective, NUMBER_INPUT_TOKEN } from '../../directives';

@Component({
  selector: 'et-number-input',
  templateUrl: './number-input.component.html',
  styleUrls: ['./number-input.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-number-input',
  },
  providers: [DestroyService],
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [NumberInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class NumberInputComponent extends DecoratedInputBase {
  protected readonly numberInput = inject(NUMBER_INPUT_TOKEN);
}
