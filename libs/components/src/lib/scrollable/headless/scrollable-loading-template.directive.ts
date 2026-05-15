import { Directive, TemplateRef, computed, inject, input, numberAttribute } from '@angular/core';
import { ScrollableDirective } from './scrollable.directive';

@Directive({
  selector: 'ng-template[etScrollableLoadingTemplate]',
})
export class ScrollableLoadingTemplateDirective {
  private scrollable = inject(ScrollableDirective, { optional: true });

  private templateRef = inject(TemplateRef);
  repeatContentCount = input(1, { transform: numberAttribute });
  repeat = computed(() => Array.from({ length: this.repeatContentCount() }));

  constructor() {
    this.scrollable?.loadingTemplateRef.set({
      templateRef: this.templateRef,
      repeat: this.repeat,
    });
  }
}
