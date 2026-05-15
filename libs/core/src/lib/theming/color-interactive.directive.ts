import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { ColorInteractiveStylesComponent } from './color-interactive-styles.component';

@Directive({
  selector: '[etColorInteractive]',
  host: {
    class: 'et-color-interactive',
  },
})
export class ColorInteractiveDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(ColorInteractiveStylesComponent);
  }
}
