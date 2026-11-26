import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The anchored dialog's default enter/leave animation, as a styles-only component mounted by the
 * anchored-dialog strategy.
 *
 * Referenced only from that strategy, so an app that never opens one does not bundle its CSS.
 *
 * @internal
 */
@Component({
  selector: 'et-overlay-anchored-dialog-styles',
  template: '',
  styleUrl: './anchored-dialog-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class AnchoredDialogStylesComponent {}
