import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { ColorInteractiveStylesComponent } from './color-interactive-styles.component';

@Directive({
  selector: '[etColorInteractiveContainer]',
  host: {
    class: 'et-color-interactive-container',
  },
})
export class ColorInteractiveContainerDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(ColorInteractiveStylesComponent);
  }
}
