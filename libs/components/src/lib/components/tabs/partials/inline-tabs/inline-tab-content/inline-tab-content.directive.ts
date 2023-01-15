import { Directive, InjectionToken, TemplateRef } from '@angular/core';

export const TAB_CONTENT = new InjectionToken<InlineTabContentDirective>('TabContent');

@Directive({
  selector: '[etInlineTabContent]',
  providers: [{ provide: TAB_CONTENT, useExisting: InlineTabContentDirective }],
  standalone: true,
  host: {
    class: 'et-inline-tab-content',
  },
})
export class InlineTabContentDirective {
  constructor(public template: TemplateRef<unknown>) {}
}
