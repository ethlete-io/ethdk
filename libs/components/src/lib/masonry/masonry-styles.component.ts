import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The masonry's structural CSS, as a styles-only component mounted by `MasonryDirective` (see
 * `ButtonStylesDirective` for the pattern).
 *
 * It is mounted rather than carried by a default component because this domain has no default component to
 * carry it: masonry is pure layout mechanism — absolute positioning, the transitions between placements, the
 * fade on first placement — with no visual opinion of its own to wrap in one. Mounting means a hand-built
 * `<ul etMasonry>` gets the mechanism too, which a Tier 3 stylesheet could not give it. The style manager
 * de-duplicates per component type, so any number of masonries on a page inject one `<style>`.
 *
 * This is therefore also where the domain's public design tokens are declared, since there is no default
 * component to own them.
 *
 * @internal
 */
@Component({
  selector: 'et-masonry-styles',
  template: '',
  styleUrl: './masonry-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class MasonryStylesComponent {}
