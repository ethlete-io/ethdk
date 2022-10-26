import { Directive } from '@angular/core';

export const SCROLLABLE_IGNORE_TARGET_CLASS = 'et-scrollable-ignore-target';

@Directive({
  selector: '[etScrollableIgnoreTarget]',
  standalone: true,
  host: {
    class: SCROLLABLE_IGNORE_TARGET_CLASS,
  },
})
export class ScrollableIgnoreTargetDirective {}
