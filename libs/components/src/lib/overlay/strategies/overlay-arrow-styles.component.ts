import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The floating-ui-positioned arrow's chrome, as a styles-only component mounted whenever a
 * strategy's config sets `arrow: true` (anchored dialogs, tooltips, toggletips, arrowed menus).
 *
 * Referenced only when a mounted strategy opts into an arrow, so an overlay that never renders
 * one does not bundle its CSS.
 *
 * @internal
 */
@Component({
  selector: 'et-overlay-arrow-styles',
  template: '',
  styleUrl: './overlay-arrow-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class OverlayArrowStylesComponent {}
