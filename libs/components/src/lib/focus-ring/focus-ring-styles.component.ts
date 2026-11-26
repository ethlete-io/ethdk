import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The stylesheet behind `.et-focus-ring`; mount it yourself to ring elements without `etFocusRing`.
 * Tune the ring with `--et-focus-ring-color`, `--et-focus-ring-offset` (default `3px`) and
 * `--et-focus-ring-width` (default `2px`) on the element carrying the class.
 */
@Component({
  selector: 'et-focus-ring-styles',
  template: '',
  styleUrl: './focus-ring-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FocusRingStylesComponent {}
