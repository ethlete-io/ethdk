import { Directive, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: 'ng-template[etPipTitleBar]',
})
export class PipTitleBarTemplateDirective {
  template = inject<TemplateRef<unknown>>(TemplateRef);
}
