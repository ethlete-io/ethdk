import { AsyncPipe } from '@angular/common';
import { Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { TEXT_INPUT_TOKEN, TextInputDirective } from '../../directives/text-input';
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-text-input',
  templateUrl: './text-input.component.html',
  styleUrls: ['./text-input.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-text-input et-legacy',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [TextInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class TextInputComponent extends DecoratedInputBase {
  protected readonly textInput = inject(TEXT_INPUT_TOKEN);
}
