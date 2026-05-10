import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { ColoredStylesComponent } from './color-themed-styles.component';

@Directive({
  selector: '[etColorThemed]',
  host: {
    class: 'et-color-themed',
  },
})
export class ColoredDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(ColoredStylesComponent);
  }
}
