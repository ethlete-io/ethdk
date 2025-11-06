import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { EMAIL_INPUT_TOKEN, EmailInputDirective } from '../../directives/email-input';

@Component({
  selector: 'et-email-input',
  templateUrl: './email-input.component.html',
  styleUrls: ['./email-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-email-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [EmailInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class EmailInputComponent extends DecoratedInputBase {
  protected readonly emailInput = inject(EMAIL_INPUT_TOKEN);
}
