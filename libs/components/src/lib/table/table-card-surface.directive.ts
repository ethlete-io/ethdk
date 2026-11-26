import { booleanAttribute, computed, Directive, effect, inject, input } from '@angular/core';
import {
  injectParentSurface,
  injectSurfaceThemes,
  ProvideSurfaceDirective,
  resolveSurfaceByElevation,
} from '@ethlete/core';

/**
 * Raises a card row one surface elevation above the table it lies on, so the card is painted by a
 * theme instead of by a tint over the table's own surface - and so anything inside the row that
 * resolves an elevation of its own (a form field in an editing cell, a nested auto-surface) resolves
 * it from the card rather than from the table under it.
 *
 * @internal
 */
@Directive({
  selector: '[etTableCardSurface]',
  hostDirectives: [ProvideSurfaceDirective],
  host: {
    '[class.et-table-row--card-tint]': 'hasNoSurface()',
  },
})
export class TableCardSurfaceDirective {
  private provideSurface = inject(ProvideSurfaceDirective);
  private parentSurface = injectParentSurface();
  private surfaceThemes = injectSurfaceThemes({ optional: true });

  /**
   * Whether this row is a card. The table binds it per appearance; where it is off the row keeps the
   * surface it inherits, which is what every other appearance paints its rows on.
   */
  public etTableCardSurface = input(false, { transform: booleanAttribute });

  private resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    const parent = this.parentSurface();

    if (!this.etTableCardSurface() || !themes || !parent) return null;

    return resolveSurfaceByElevation(themes, parent.type, parent.elevation + 1);
  });

  /**
   * Whether the card asked for an elevation the app cannot give it - it registers no surface themes, or
   * the table already sits on the top of the ladder. The row then falls back to a tint (see
   * `.et-table-row--card-tint`), so a card is still marked off from the table under it.
   */
  protected hasNoSurface = computed(() => this.etTableCardSurface() && !this.resolvedSurface());

  constructor() {
    effect(() => {
      const surface = this.resolvedSurface();

      if (surface) {
        this.provideSurface.forceSurface(surface.name);
      } else {
        this.provideSurface.clearForcedSurface();
      }
    });
  }
}
