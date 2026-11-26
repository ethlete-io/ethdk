import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { OVERLAY_CONTENT_IMPORTS } from '../../../overlay/overlay.imports';
import { dialogOverlayStrategy } from '../../../overlay/strategies';
import { TOOLTIP_IMPORTS } from '../../tooltip.imports';

@Component({
  selector: 'et-sb-tooltip-in-dialog-content',
  template: `
    <div etOverlayMain>
      <div etOverlayHeader>
        <h2 class="text-h6 font-title" et-overlay-title>Squad settings</h2>
      </div>

      <div et-overlay-body>
        <div class="flex max-w-md flex-col gap-4 text-base text-white/80">
          <p>The tooltip below is passive: the dialog keeps answering Escape and a backdrop press while it shows.</p>

          <button etTooltip="Only the captain can change this" et-button size="sm" variant="outline">
            Tooltip inside the dialog
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-3" etOverlayFooter>
        <button et-button etOverlayClose size="sm" variant="outline">Close</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS, TOOLTIP_IMPORTS],
})
export class TooltipInDialogContentComponent {}

@Component({
  selector: 'et-sb-tooltip-in-dialog',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans" style="min-height: 18rem;">
      <header class="flex flex-col gap-1">
        <h2 class="text-h5 font-title">Tooltip inside a dialog</h2>
        <p class="text-small text-white/60">A shown tooltip never takes the top layer away from the dialog.</p>
      </header>

      <div>
        <button (click)="openDialog()" et-button size="sm">Open dialog</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class TooltipInDialogStorybookComponent {
  private overlayManager = injectOverlayManager();

  protected openDialog() {
    this.overlayManager.open(TooltipInDialogContentComponent, { strategies: dialogOverlayStrategy() });
  }
}
