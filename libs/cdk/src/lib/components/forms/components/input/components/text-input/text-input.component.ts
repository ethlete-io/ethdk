import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { DestroyService } from '@ethlete/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { DecoratedInputBase } from '../../../../utils';
import { TextInputDirective, TEXT_INPUT_TOKEN } from '../../directives';

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
  providers: [DestroyService],
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [TextInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class TextInputComponent extends DecoratedInputBase {
  protected readonly textInput = inject(TEXT_INPUT_TOKEN);
}
