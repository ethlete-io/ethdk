import { AsyncPipe } from '@angular/common';
import { Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { TEL_INPUT_TOKEN, TelInputDirective } from '../../directives/tel-input';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-tel-input',
  templateUrl: './tel-input.component.html',
  styleUrls: ['./tel-input.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-tel-input et-legacy',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [TelInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class TelInputComponent extends DecoratedInputBase {
  protected readonly telInput = inject(TEL_INPUT_TOKEN);
}
