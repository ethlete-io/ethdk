import { Component, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  dialogOverlayStrategy,
  injectOverlayManager,
  OVERLAY_CONTENT_IMPORTS,
  TOOLTIP_IMPORTS,
} from '@ethlete/components';

@Component({
  selector: 'app-tooltip-in-dialog-content',
  template: `
    <div etOverlayMain>
      <div etOverlayHeader>
        <h2 et-overlay-title>Squad settings</h2>
      </div>

      <div et-overlay-body>
        <p>The tooltip below is passive: the dialog keeps answering Escape and a backdrop press while it shows.</p>

        <button etTooltip="Only the captain can change this" et-button size="sm" variant="outline">
          Tooltip inside the dialog
        </button>
      </div>

      <div etOverlayFooter>
        <button et-button etOverlayClose size="sm" variant="outline">Close</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS, TOOLTIP_IMPORTS],
})
export class TooltipInDialogContentComponent {}

@Component({
  selector: 'app-tooltip-in-dialog-example',
  template: `<button (click)="openDialog()" et-button size="sm">Open dialog</button>`,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class TooltipInDialogExampleComponent {
  private overlayManager = injectOverlayManager();

  protected openDialog() {
    this.overlayManager.open(TooltipInDialogContentComponent, { strategies: dialogOverlayStrategy() });
  }
}
