import { Directive } from '@angular/core';
import { injectStyleManager } from '../providers';
import { ColoredStylesComponent } from './colored-styles.component';

@Directive({
  selector: '[etColored]',
  host: {
    class: 'et-colored',
  },
})
export class ColoredDirective {
  private styleManager = injectStyleManager();

  constructor() {
    this.styleManager.mount(ColoredStylesComponent);
  }
}
