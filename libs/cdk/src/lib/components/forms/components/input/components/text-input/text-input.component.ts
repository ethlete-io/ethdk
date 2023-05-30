import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { DecoratedInputBase } from '../../../../utils';
import { TEXT_INPUT_TOKEN, TextInputDirective } from '../../directives';

@Component({
  selector: 'et-text-input',
  templateUrl: './text-input.component.html',
  styleUrls: ['./text-input.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-text-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [TextInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class TextInputComponent extends DecoratedInputBase {
  protected readonly textInput = inject(TEXT_INPUT_TOKEN);
}
