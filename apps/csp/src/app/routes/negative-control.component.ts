import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, inject, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-negative-control',
  template: '<p data-testid="rendered">A nonce-less style element was appended to the head.</p>',
  encapsulation: ViewEncapsulation.None,
})
export class NegativeControlComponent {
  private document = inject(DOCUMENT);

  constructor() {
    afterNextRender(() => {
      /* eslint-disable ethlete/no-direct-dom-manipulation, ethlete/no-csp-unsafe -- the self-test needs a real CSP violation */
      const style = this.document.createElement('style');
      style.textContent = '.app-negative-control { color: red; }';
      this.document.head.appendChild(style);
      /* eslint-enable ethlete/no-direct-dom-manipulation, ethlete/no-csp-unsafe */
    });
  }
}
