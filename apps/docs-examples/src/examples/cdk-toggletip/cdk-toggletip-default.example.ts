import { Component, ViewEncapsulation, signal } from '@angular/core';
import { ToggletipCloseDirective, ToggletipImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-toggletip-default-example',
  template: `
    <button
      [showToggletip]="simpleOpen()"
      (click)="simpleOpen.set(!simpleOpen())"
      (toggletipClose)="simpleOpen.set(false)"
      etToggletip="Points are awarded per match win."
      placement="top"
      type="button"
    >
      Simple toggletip
    </button>

    <button
      [showToggletip]="templateOpen()"
      [etToggletip]="toggletipTpl"
      (click)="templateOpen.set(!templateOpen())"
      (toggletipClose)="templateOpen.set(false)"
      placement="top"
      type="button"
    >
      Toggletip with template
    </button>

    <ng-template #toggletipTpl>
      <p><strong>Fancy template!</strong> Lorem ipsum dolor sit amet consectetur adipisicing elit.</p>
      <button etToggletipClose type="button">Close</button>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ToggletipImports, ToggletipCloseDirective],
})
export class CdkToggletipDefaultExampleComponent {
  protected simpleOpen = signal(false);
  protected templateOpen = signal(false);
}
