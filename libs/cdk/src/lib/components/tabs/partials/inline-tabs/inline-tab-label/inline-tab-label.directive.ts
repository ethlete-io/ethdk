import { CdkPortal } from '@angular/cdk/portal';
import { Directive, InjectionToken, inject } from '@angular/core';

export const TAB_LABEL = new InjectionToken<InlineTabLabelDirective>('TabLabel');

export const TAB = new InjectionToken<unknown>('TAB');

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[et-inline-tab-label]',
  providers: [{ provide: TAB_LABEL, useExisting: InlineTabLabelDirective }],

  host: {
    class: 'et-inline-tab-label et-legacy',
  },
})
export class InlineTabLabelDirective extends CdkPortal {
  _closestTab = inject(TAB, { optional: true });
}
