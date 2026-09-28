import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/** @internal The field row the three range inputs share, mounted once for all of them. */
@Component({
  selector: 'et-range-input-shell-styles',
  template: '',
  styleUrl: './range-input-shell-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class RangeInputShellStylesComponent {}

/** @internal Call from the constructor of each styled range input. */
export const mountRangeInputShellStyles = () => injectStyleManager().mount(RangeInputShellStylesComponent);
