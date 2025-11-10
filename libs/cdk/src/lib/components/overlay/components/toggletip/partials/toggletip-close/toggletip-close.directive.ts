import { Directive, HostListener, inject } from '@angular/core';
import { TOGGLETIP } from '../../components/toggletip';

@Directive({
  selector: '[et-toggletip-close], [etToggletipClose]',
  exportAs: 'etToggletipClose',
})
export class ToggletipCloseDirective {
  private _toggletipDirective = inject(TOGGLETIP);

  @HostListener('click')
  _onButtonClick() {
    this._toggletipDirective._trigger._animatedOverlay.unmount();
  }
}
