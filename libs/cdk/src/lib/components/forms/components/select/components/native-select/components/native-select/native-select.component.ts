import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { InputDirective } from '../../../../../../directives/input';
import { NativeInputRefDirective } from '../../../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../../../utils';
import { NATIVE_SELECT_INPUT_TOKEN, NativeSelectInputDirective } from '../../directives/native-select-input';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-native-select',
  templateUrl: './native-select.component.html',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-native-select et-legacy',
  },
  imports: [NativeInputRefDirective, NgTemplateOutlet, AsyncPipe],
  hostDirectives: [NativeSelectInputDirective, { directive: InputDirective, inputs: ['autocomplete'] }],
})
export class NativeSelectInputComponent extends DecoratedInputBase {
  protected readonly select = inject(NATIVE_SELECT_INPUT_TOKEN);
}
