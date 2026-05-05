import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { ColorThemedStylesComponent } from './color-themed-styles.component';

@Directive({
  selector: '[etColorThemed]',
  host: {
    class: 'et-color-themed',
  },
})
export class ColorThemedDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(ColorThemedStylesComponent);
  }
}
