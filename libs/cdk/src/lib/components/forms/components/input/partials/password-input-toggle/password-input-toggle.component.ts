import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, ViewEncapsulation } from '@angular/core';
import { INPUT_TOKEN } from '../../../../directives';
import { PASSWORD_INPUT_TOKEN } from '../../directives';

@Component({
  selector: 'et-password-input-toggle',
  templateUrl: './password-input-toggle.component.html',
  styleUrls: ['./password-input-toggle.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-password-input-toggle',
  },
  imports: [AsyncPipe],
})
export class PasswordInputToggleComponent {
  protected readonly passwordInput = inject(PASSWORD_INPUT_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  @Input()
  ariaLabel?: string;
}
