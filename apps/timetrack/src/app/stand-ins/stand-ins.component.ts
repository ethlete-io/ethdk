import { Component, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  defineOverlay,
  dialogOverlayStrategy,
} from '@ethlete/components';
import { StandInsListComponent } from './stand-ins-list.component';

/** The stand-in list as its own dialog, for a surface that has no accordion to hold it. */
@Component({
  selector: 'ethlete-stand-ins',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h4" etOverlayTitle>Waiting on a ticket</h2>
    </div>

    <et-overlay-body>
      <ethlete-stand-ins-list />
    </et-overlay-body>

    <div class="flex justify-end" etOverlayFooter>
      <button et-button etOverlayClose size="sm" variant="outline">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS, StandInsListComponent],
  hostDirectives: [OverlayMainDirective],
})
export class StandInsComponent {}

export const STAND_INS_OVERLAY = /* @__PURE__ */ defineOverlay({
  component: StandInsComponent,
  strategies: dialogOverlayStrategy({ width: 'min(720px, 90%)', maxWidth: '90%' }),
});
