import { CdkPortal } from '@angular/cdk/portal';
import { Directive, Inject, InjectionToken, Optional, TemplateRef, ViewContainerRef } from '@angular/core';

export const TAB_LABEL = new InjectionToken<InlineTabLabelDirective>('TabLabel');

export const TAB = new InjectionToken<unknown>('TAB');

@Directive({
  selector: '[et-inline-tab-label]',
  providers: [{ provide: TAB_LABEL, useExisting: InlineTabLabelDirective }],
  standalone: true,
  host: {
    class: 'et-inline-tab-label',
  },
})
export class InlineTabLabelDirective extends CdkPortal {
  constructor(
    templateRef: TemplateRef<unknown>,
    viewContainerRef: ViewContainerRef,
    @Inject(TAB) @Optional() public _closestTab: unknown,
  ) {
    super(templateRef, viewContainerRef);
  }
}
