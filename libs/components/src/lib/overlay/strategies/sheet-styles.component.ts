import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The four sheet strategies' default enter/leave animations and overshoot filler, as a styles-only
 * component mounted by whichever sheet strategy is in play.
 *
 * Referenced only from that strategy, so an app that never opens one does not bundle its CSS.
 *
 * @internal
 */
@Component({
  selector: 'et-overlay-sheet-styles',
  template: '',
  styleUrl: './sheet-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SheetStylesComponent {}
