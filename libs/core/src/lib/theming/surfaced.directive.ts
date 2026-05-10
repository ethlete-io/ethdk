import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { SurfacedStylesComponent } from './surfaced-styles.component';

@Directive({
  selector: '[etSurfaced]',
  host: {
    class: 'et-surfaced',
  },
})
export class SurfacedDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(SurfacedStylesComponent);
  }
}
