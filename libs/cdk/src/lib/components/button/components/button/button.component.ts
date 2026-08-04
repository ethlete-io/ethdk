import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ButtonDirective } from '../../directives/button';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: '[et-button]',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: ButtonDirective, inputs: ['disabled', 'type', 'pressed'] }],
  host: {
    class: 'et-button et-legacy',
  },
})
export class ButtonComponent {
  protected button = inject(ButtonDirective);
}
