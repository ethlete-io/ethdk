import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { TEL_INPUT_TOKEN, TelInputDirective } from '../../directives/tel-input';

@Component({
  selector: 'et-tel-input',
  templateUrl: './tel-input.component.html',
  styleUrls: ['./tel-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-tel-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [TelInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class TelInputComponent extends DecoratedInputBase {
  protected readonly telInput = inject(TEL_INPUT_TOKEN);
}
