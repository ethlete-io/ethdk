import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { DecoratedInputBase } from '../../../../utils';
import { EMAIL_INPUT_TOKEN, EmailInputDirective } from '../../directives';

@Component({
  selector: 'et-email-input',
  templateUrl: './email-input.component.html',
  styleUrls: ['./email-input.component.scss'],
  standalone: true,
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
