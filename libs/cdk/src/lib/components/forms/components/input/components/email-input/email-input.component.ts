import { AsyncPipe } from '@angular/common';
import { Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { EMAIL_INPUT_TOKEN, EmailInputDirective } from '../../directives/email-input';

@Component({
  selector: 'et-email-input',
  templateUrl: './email-input.component.html',
  styleUrls: ['./email-input.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-email-input et-legacy',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [EmailInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class EmailInputComponent extends DecoratedInputBase {
  protected readonly emailInput = inject(EMAIL_INPUT_TOKEN);
}
