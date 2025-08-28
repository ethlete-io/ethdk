import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { ButtonImports } from '../../button.imports';

@Component({
  selector: 'et-sb-button',
  template: ` <button [disabled]="disabled" [type]="type" [pressed]="pressed" et-button>Button</button> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonImports],
})
export class StorybookButtonComponent {
  disabled = false;
  pressed = false;
  type: 'button' | 'submit' | 'reset' | 'menu' = 'button';
}
