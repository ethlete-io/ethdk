import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The full-screen dialog's default enter/leave animation, as a styles-only component mounted by the
 * full-screen strategy.
 *
 * Referenced only from that strategy, so an app that never opens one does not bundle its CSS.
 *
 * @internal
 */
@Component({
  selector: 'et-overlay-full-screen-dialog-styles',
  template: '',
  styleUrl: './full-screen-dialog-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FullScreenDialogStylesComponent {}
