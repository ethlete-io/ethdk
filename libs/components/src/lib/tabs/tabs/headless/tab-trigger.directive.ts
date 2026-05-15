import { Directive, input } from '@angular/core';

@Directive({
  selector: '[etTabTrigger]',
  host: {
    '[attr.aria-controls]': 'panelId()',
  },
})
export class TabTriggerDirective {
  panelId = input<string | null>(null);
}
