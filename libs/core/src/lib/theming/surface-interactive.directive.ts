import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { SurfaceInteractiveStylesComponent } from './surface-interactive-styles.component';

@Directive({
  selector: '[etSurfaceInteractive]',
  host: {
    class: 'et-surface-interactive',
  },
})
export class SurfaceInteractiveDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(SurfaceInteractiveStylesComponent);
  }
}
