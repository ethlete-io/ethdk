import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The swiss group border color, carried by a styles-only component so only apps that register
 * `swissBracketLayout()` inject it - mounted once, app-wide, via the style manager.
 *
 * @internal
 */
@Component({
  selector: 'et-bracket-swiss-styles',
  template: '',
  styleUrl: './bracket-swiss-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class BracketSwissStylesComponent {}
