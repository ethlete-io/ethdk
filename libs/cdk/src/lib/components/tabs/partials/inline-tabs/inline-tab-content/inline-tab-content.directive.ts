import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

export const TAB_CONTENT = new InjectionToken<InlineTabContentDirective>('TabContent');

@Directive({
  selector: '[etInlineTabContent]',
  providers: [{ provide: TAB_CONTENT, useExisting: InlineTabContentDirective }],

  host: {
    class: 'et-inline-tab-content',
  },
})
export class InlineTabContentDirective {
  template = inject(TemplateRef);
}
