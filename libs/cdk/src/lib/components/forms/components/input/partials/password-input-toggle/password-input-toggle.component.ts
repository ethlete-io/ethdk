import { AsyncPipe } from '@angular/common';
import { Component, inject, ViewEncapsulation, input } from '@angular/core';
import { INPUT_TOKEN } from '../../../../directives/input';
import { PASSWORD_INPUT_TOKEN } from '../../directives/password-input';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-password-input-toggle',
  templateUrl: './password-input-toggle.component.html',
  styleUrls: ['./password-input-toggle.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-password-input-toggle et-legacy',
  },
  imports: [AsyncPipe],
})
export class PasswordInputToggleComponent {
  protected readonly passwordInput = inject(PASSWORD_INPUT_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  readonly ariaLabel = input<string>();
}
