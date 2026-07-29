import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The floating behaviour itself, as a styles-only component mounted by `FloatingActionDirective` (see
 * `ButtonStylesDirective` for the pattern).
 *
 * Mounted rather than carried by a default component because there is no default component: this domain has no
 * visual opinion of its own — the trigger is your button — only a position to change and a scale to animate.
 * Mounting is what lets a hand-built composition behave identically. Also where the domain's public tokens are
 * declared, since there is no Tier 3 to own them.
 *
 * @internal
 */
@Component({
  selector: 'et-floating-action-styles',
  template: '',
  styleUrl: './floating-action-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FloatingActionStylesComponent {}
