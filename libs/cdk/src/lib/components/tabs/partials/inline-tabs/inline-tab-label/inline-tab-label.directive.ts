import { CdkPortal } from '@angular/cdk/portal';
import { Directive, InjectionToken, TemplateRef, ViewContainerRef, inject } from '@angular/core';

export const TAB_LABEL = new InjectionToken<InlineTabLabelDirective>('TabLabel');

export const TAB = new InjectionToken<unknown>('TAB');

@Directive({
  selector: '[et-inline-tab-label]',
  providers: [{ provide: TAB_LABEL, useExisting: InlineTabLabelDirective }],

  host: {
    class: 'et-inline-tab-label',
  },
})
export class InlineTabLabelDirective extends CdkPortal {
  _closestTab = inject(TAB, { optional: true });

  constructor() {
    const templateRef = inject<TemplateRef<unknown>>(TemplateRef);
    const viewContainerRef = inject(ViewContainerRef);

    super(templateRef, viewContainerRef);
  }
}
