import { Directive, inject } from '@angular/core';
import { OverlayRef } from '../../overlay';
import { ToggletipComponent } from '../toggletip.component';

@Directive({
  selector: '[etToggletipClose]',
  host: {
    '(click)': 'overlayRef.close()',
  },
})
export class ToggletipCloseDirective {
  protected overlayRef = inject<OverlayRef<ToggletipComponent, unknown>>(OverlayRef);
}
