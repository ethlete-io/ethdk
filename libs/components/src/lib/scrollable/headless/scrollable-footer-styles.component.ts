import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

@Component({
  selector: 'et-scrollable-footer-styles',
  template: '',
  styleUrl: './scrollable-footer.css',
  encapsulation: ViewEncapsulation.None,
})
export class ScrollableFooterStylesComponent {}

export const mountScrollableFooterStyles = () => injectStyleManager().mount(ScrollableFooterStylesComponent);
