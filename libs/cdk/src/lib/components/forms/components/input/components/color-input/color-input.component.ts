import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { COLOR_INPUT_TOKEN, ColorInputDirective } from '../../directives/color-input';

@Component({
  selector: 'et-color-input',
  templateUrl: './color-input.component.html',
  styleUrls: ['./color-input.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-color-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [ColorInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class ColorInputComponent extends DecoratedInputBase {
  protected readonly colorInput = inject(COLOR_INPUT_TOKEN);
}
