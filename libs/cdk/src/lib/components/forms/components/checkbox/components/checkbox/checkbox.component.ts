import { AsyncPipe, NgClass } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { InputBase } from '../../../../utils';
import { CHECKBOX_TOKEN, CheckboxDirective } from '../../directives/checkbox';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-checkbox',
  templateUrl: './checkbox.component.html',
  styleUrls: ['./checkbox.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-checkbox et-legacy',
  },
  imports: [NgClass, AsyncPipe, NativeInputRefDirective],
  hostDirectives: [CheckboxDirective, { directive: InputDirective, inputs: ['autocomplete'] }],
})
export class CheckboxComponent extends InputBase {
  protected readonly checkbox = inject(CHECKBOX_TOKEN);
}
