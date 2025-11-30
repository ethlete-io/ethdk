import { Directive, inject } from '@angular/core';
import { applyHostListener } from '@ethlete/core';
import { TOGGLETIP } from '../../components/toggletip';

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
