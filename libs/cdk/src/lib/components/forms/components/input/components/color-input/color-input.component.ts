import { AsyncPipe } from '@angular/common';
import { Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { COLOR_INPUT_TOKEN, ColorInputDirective } from '../../directives/color-input';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-color-input',
  templateUrl: './color-input.component.html',
  styleUrls: ['./color-input.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-color-input et-legacy',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [ColorInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class ColorInputComponent extends DecoratedInputBase {
  protected readonly colorInput = inject(COLOR_INPUT_TOKEN);
}
