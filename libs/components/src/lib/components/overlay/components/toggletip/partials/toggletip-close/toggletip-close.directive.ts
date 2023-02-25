import { Directive, HostListener, inject } from '@angular/core';
import { TOGGLETIP } from '../../components';

@Directive({
  selector: '[et-toggletip-close], [etToggletipClose]',
  exportAs: 'etToggletipClose',
  standalone: true,
})
export class ToggletipCloseDirective {
  private _toggletipDirective = inject(TOGGLETIP);

  @HostListener('click', ['$event'])
  _onButtonClick() {
    this._toggletipDirective._trigger._animateUnmount();
  }
}
