import { Directive, InjectionToken, TemplateRef, computed, inject, input, numberAttribute } from '@angular/core';

export const SCROLLABLE_LOADING_TEMPLATE_TOKEN = new InjectionToken<ScrollableLoadingTemplateDirective>(
  'SCROLLABLE_LOADING_TEMPLATE_TOKEN',
);

@Directive({
  selector: 'ng-template[etScrollableLoadingTemplate]',
  standalone: true,
  providers: [
    {
      provide: SCROLLABLE_LOADING_TEMPLATE_TOKEN,
      useExisting: ScrollableLoadingTemplateDirective,
    },
  ],
})
export class ScrollableLoadingTemplateDirective {
  templateRef = inject(TemplateRef);

  repeatContentCount = input(1, { transform: numberAttribute });

  repeat = computed(() => Array.from({ length: this.repeatContentCount() }));
}
