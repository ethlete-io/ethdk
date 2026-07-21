import { AsyncPipe } from '@angular/common';
import { Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { PASSWORD_INPUT_TOKEN, PasswordInputDirective } from '../../directives/password-input';

@Component({
  selector: 'et-password-input',
  templateUrl: './password-input.component.html',
  styleUrls: ['./password-input.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-password-input et-legacy',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [PasswordInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class PasswordInputComponent extends DecoratedInputBase {
  protected readonly passwordInput = inject(PASSWORD_INPUT_TOKEN);
}
