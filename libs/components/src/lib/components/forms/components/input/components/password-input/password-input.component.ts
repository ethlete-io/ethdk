import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { InputDirective, INPUT_TOKEN, NativeInputRefDirective, NATIVE_INPUT_REF_TOKEN } from '../../../../directives';
import { PasswordInputDirective, PASSWORD_INPUT_TOKEN } from '../../directives';

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
  hostDirectives: [PasswordInputDirective, { directive: InputDirective, inputs: ['autocomplete'] }],
})
export class PasswordInputComponent implements OnInit {
  protected readonly passwordInput = inject(PASSWORD_INPUT_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  @ViewChild(NATIVE_INPUT_REF_TOKEN, { static: true })
  protected readonly nativeInputRef!: NativeInputRefDirective;

  ngOnInit(): void {
    this.input._setNativeInputRef(this.nativeInputRef);
  }
}
