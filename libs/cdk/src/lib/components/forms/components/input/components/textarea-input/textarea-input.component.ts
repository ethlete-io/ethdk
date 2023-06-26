import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, numberAttribute, ViewEncapsulation } from '@angular/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { DecoratedInputBase } from '../../../../utils';
import { TEXTAREA_INPUT_TOKEN, TextareaInputDirective } from '../../directives/textarea-input';

@Component({
  selector: 'et-textarea-input',
  templateUrl: './textarea-input.component.html',
  styleUrls: ['./textarea-input.component.scss'],
  standalone: true,
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

  @Input({ transform: numberAttribute })
  cols: number | null = null;

  @Input({ transform: numberAttribute })
  rows: number | null = null;
}
