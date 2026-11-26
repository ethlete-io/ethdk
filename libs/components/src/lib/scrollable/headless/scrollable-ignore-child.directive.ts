import { Directive, booleanAttribute, input } from '@angular/core';

@Directive({
  selector: `[etScrollableIgnoreChild]`,
  host: {
    '[attr.etScrollableIgnoreChild]': 'enabled() ? "" : null',
  },
})
export class ScrollableIgnoreChildDirective {
  public enabled = input(true, { transform: booleanAttribute });
}
