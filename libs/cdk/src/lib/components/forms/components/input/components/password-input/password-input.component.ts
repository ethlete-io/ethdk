import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { DecoratedInputBase } from '../../../../utils';
import { PASSWORD_INPUT_TOKEN, PasswordInputDirective } from '../../directives';

@Component({
  selector: 'et-password-input',
  templateUrl: './password-input.component.html',
  styleUrls: ['./password-input.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-password-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [PasswordInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class PasswordInputComponent extends DecoratedInputBase {
  protected readonly passwordInput = inject(PASSWORD_INPUT_TOKEN);
}
