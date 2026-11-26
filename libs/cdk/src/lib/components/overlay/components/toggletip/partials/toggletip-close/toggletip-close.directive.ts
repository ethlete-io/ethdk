import { Directive, inject } from '@angular/core';
import { applyHostListener } from '@ethlete/core';
import { TOGGLETIP } from '../../components/toggletip';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[et-toggletip-close], [etToggletipClose]',
  exportAs: 'etToggletipClose',
})
export class ToggletipCloseDirective {
  private _toggletipDirective = inject(TOGGLETIP);

  constructor() {
    applyHostListener('click', () => this._toggletipDirective._trigger.animatedOverlay.unmount());
  }
}
