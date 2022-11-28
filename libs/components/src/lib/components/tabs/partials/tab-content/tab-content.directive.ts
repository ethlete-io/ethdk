import { Directive, InjectionToken, TemplateRef } from '@angular/core';

export const TAB_CONTENT = new InjectionToken<TabContentDirective>('TabContent');

@Directive({
  selector: '[etTabContent]',
  providers: [{ provide: TAB_CONTENT, useExisting: TabContentDirective }],
  standalone: true,
  host: {
    class: 'et-tab-content',
  },
})
export class TabContentDirective {
  constructor(public template: TemplateRef<unknown>) {}
}
