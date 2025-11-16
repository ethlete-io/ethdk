import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, numberAttribute, ViewEncapsulation, input } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { TEXTAREA_INPUT_TOKEN, TextareaInputDirective } from '../../directives/textarea-input';

@Component({
  selector: 'et-textarea-input',
  templateUrl: './textarea-input.component.html',
  styleUrls: ['./textarea-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-textarea-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [TextareaInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class TextareaInputComponent extends DecoratedInputBase {
  protected readonly textareaInput = inject(TEXTAREA_INPUT_TOKEN);

  readonly cols = input<number | null, unknown>(null, { transform: numberAttribute });

  readonly rows = input<number | null, unknown>(null, { transform: numberAttribute });
}
