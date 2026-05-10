import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { SurfacedStylesComponent } from './surface-themed-styles.component';

@Directive({
  selector: '[etSurfaceThemed]',
  host: {
    class: 'et-surface-themed',
  },
})
export class SurfacedDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(SurfacedStylesComponent);
  }
}
