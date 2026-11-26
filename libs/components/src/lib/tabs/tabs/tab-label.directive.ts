import { Directive, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: '[etTabLabel]',
})
export class TabLabelDirective {
  public templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}
