import { Directive, effect, inject, input, numberAttribute, TemplateRef, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[etRepeat]',
})
export class RepeatDirective {
  private mainTemplateRef = inject<TemplateRef<unknown>>(TemplateRef);
  private viewContainerRef = inject(ViewContainerRef);

  repeatCount = input(2, { alias: 'etRepeat', transform: numberAttribute });

  constructor() {
    effect(() => {
      const count = Math.max(0, this.repeatCount());

      while (this.viewContainerRef.length < count) {
        this.viewContainerRef.createEmbeddedView(this.mainTemplateRef);
      }

      while (this.viewContainerRef.length > count) {
        this.viewContainerRef.remove(this.viewContainerRef.length - 1);
      }
    });
  }
}
