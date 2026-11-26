import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The spinner's stylesheet, as a styles-only component mounted by `SpinnerComponent` (see
 * `ButtonStylesDirective` for the pattern).
 *
 * The fade-out copy of a removed list row clones the spinner inside it. A component stylesheet leaves the
 * document with its last instance, which would collapse that copy's spinner, so the sheet is mounted once
 * and stays.
 *
 * @internal
 */
@Component({
  selector: 'et-spinner-styles',
  template: '',
  styleUrl: './spinner-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SpinnerStylesComponent {}
