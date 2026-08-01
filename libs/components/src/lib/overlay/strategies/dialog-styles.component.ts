import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The dialog's default enter/leave animation, as a styles-only component mounted by the dialog
 * strategy.
 *
 * Referenced only from that strategy, so an app that never opens one does not bundle its CSS.
 *
 * @internal
 */
@Component({
  selector: 'et-overlay-dialog-styles',
  template: '',
  styleUrl: './dialog-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class DialogStylesComponent {}
