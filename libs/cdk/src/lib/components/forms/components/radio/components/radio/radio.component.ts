import { AsyncPipe, NgClass } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { InputBase } from '../../../../utils';
import { RADIO_TOKEN, RadioDirective } from '../../directives/radio';
import { RADIO_GROUP_TOKEN } from '../../directives/radio-group';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-radio',
  templateUrl: './radio.component.html',
  styleUrls: ['./radio.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-radio et-legacy',
  },
  imports: [AsyncPipe, NgClass, NativeInputRefDirective],
  hostDirectives: [
    { directive: RadioDirective, inputs: ['value', 'disabled'] },
    { directive: InputDirective, inputs: ['autocomplete'] },
  ],
})
export class RadioComponent extends InputBase {
  protected readonly radio = inject(RADIO_TOKEN);
  protected readonly radioGroup = inject(RADIO_GROUP_TOKEN);
}
