import { Component, ViewEncapsulation, signal } from '@angular/core';
import { ButtonImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-button-default-example',
  template: `
    <button [pressed]="pressed()" (click)="pressed.set(!pressed())" et-button type="button">
      {{ pressed() ? 'Pressed' : 'Press me' }}
    </button>

    <button et-button type="button" disabled>Disabled</button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonImports],
})
export class CdkButtonDefaultExampleComponent {
  protected pressed = signal(false);
}
