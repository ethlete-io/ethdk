import { Directive, inject } from '@angular/core';
import { PIP_CHROME_REF_TOKEN } from './pip-chrome-ref.token';

@Directive({
  selector: '[etPipGridToggle]',
  host: {
    class: 'et-stream-pip-chrome__view-btn',
    type: 'button',
    '[attr.aria-label]': 'chrome?.state?.gridToggleLabel()',
    '[attr.title]': 'chrome?.state?.gridToggleLabel()',
    '(click)': 'toggle($event)',
  },
})
export class PipGridToggleDirective {
  protected chrome = inject(PIP_CHROME_REF_TOKEN, { optional: true });

  toggle(event: Event): void {
    event.stopPropagation();
    this.chrome?.animations.toggleMultiView();
  }
}
