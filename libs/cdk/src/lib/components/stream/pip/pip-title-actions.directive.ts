import { Directive } from '@angular/core';

@Directive({
  selector: '[etPipTitleActions]',
  host: {
    class: 'et-stream-pip-chrome__title-actions',
  },
})
export class PipTitleActionsDirective {}
