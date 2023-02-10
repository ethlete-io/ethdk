import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { ButtonImports } from '../../..';

@Component({
  selector: 'et-sb-button',
  template: ` <button type="button" et-button>Button</button> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonImports],
})
export class StorybookButtonComponent {}
