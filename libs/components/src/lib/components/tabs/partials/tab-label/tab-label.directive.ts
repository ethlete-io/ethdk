import { Directive, Inject, InjectionToken, Optional, TemplateRef, ViewContainerRef } from '@angular/core';
import { CdkPortal } from '@angular/cdk/portal';

export const TAB_LABEL = new InjectionToken<TabLabelDirective>('TabLabel');

export const TAB = new InjectionToken<unknown>('TAB');

@Directive({
  selector: '[et-tab-label]',
  providers: [{ provide: TAB_LABEL, useExisting: TabLabelDirective }],
  standalone: true,
  host: {
    class: 'et-tab-label',
  },
})
export class TabLabelDirective extends CdkPortal {
  constructor(
    templateRef: TemplateRef<unknown>,
    viewContainerRef: ViewContainerRef,
    @Inject(TAB) @Optional() public _closestTab: unknown,
  ) {
    super(templateRef, viewContainerRef);
  }
}
