import { Component, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  createOverlayOpener,
  defineOverlay,
  dialogOverlayStrategy,
  OverlayBodyComponent,
  OverlayCloseDirective,
  OverlayFooterDirective,
  OverlayHeaderDirective,
  OverlayMainDirective,
  OverlayTitleDirective,
} from '@ethlete/components';

@Component({
  selector: 'app-dialog',
  template: `
    <div etOverlayHeader><h2 etOverlayTitle>CSP dialog</h2></div>
    <et-overlay-body data-testid="dialog-body">Rendered inside a dialog overlay.</et-overlay-body>
    <div etOverlayFooter><button et-button etOverlayClose type="button">Close</button></div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayCloseDirective,
    BUTTON_IMPORTS,
  ],
  hostDirectives: [OverlayMainDirective],
})
export class DialogComponent {}

const DIALOG = defineOverlay<DialogComponent, void>({
  component: DialogComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
});

@Component({
  selector: 'app-overlay',
  template: '<button et-button type="button" data-testid="open" (click)="opener.open()">Open dialog</button>',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class OverlayRouteComponent {
  protected opener = createOverlayOpener(DIALOG);
}
