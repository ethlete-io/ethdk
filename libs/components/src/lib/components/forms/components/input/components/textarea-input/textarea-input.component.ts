import { coerceNumberProperty, NumberInput } from '@angular/cdk/coercion';
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, ViewEncapsulation } from '@angular/core';
import { DestroyService } from '@ethlete/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { DecoratedInputBase } from '../../../../utils';
import { TextareaInputDirective, TEXTAREA_INPUT_TOKEN } from '../../directives/textarea-input';

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
  providers: [DestroyService],
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [TextareaInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class TextareaInputComponent extends DecoratedInputBase {
  protected readonly textareaInput = inject(TEXTAREA_INPUT_TOKEN);

  @Input()
  get cols(): number {
    return this._cols;
  }
  set cols(value: NumberInput) {
    this._cols = coerceNumberProperty(value);
  }
  private _cols = 0;

  @Input()
  get rows(): number {
    return this._rows;
  }
  set rows(value: NumberInput) {
    this._rows = coerceNumberProperty(value);
  }
  private _rows = 0;
}
