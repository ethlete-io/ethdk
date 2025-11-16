import { Directive, InjectionToken, Input, booleanAttribute, signal } from '@angular/core';
import { signalHostAttributes } from '@ethlete/core';

export const SCROLLABLE_IGNORE_CHILD_TOKEN = new InjectionToken<ScrollableIgnoreChildDirective>(
  'SCROLLABLE_IGNORE_CHILD_TOKEN',
);

export const SCROLLABLE_IGNORE_CHILD_ATTRIBUTE = 'etScrollableIgnoreChild';

export const isScrollableChildIgnored = (e: HTMLElement) => {
  const attr = e.attributes.getNamedItem(SCROLLABLE_IGNORE_CHILD_ATTRIBUTE)?.value;

  return attr === 'true' || attr === '';
};

@Directive({
  selector: `[${SCROLLABLE_IGNORE_CHILD_ATTRIBUTE}]`,

  providers: [
    {
      provide: SCROLLABLE_IGNORE_CHILD_TOKEN,
      useExisting: ScrollableIgnoreChildDirective,
    },
  ],
})
export class ScrollableIgnoreChildDirective {
  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input({ transform: booleanAttribute, alias: SCROLLABLE_IGNORE_CHILD_ATTRIBUTE })
  set _ignoreChildEnabled(v: boolean) {
    this.ignoreChildEnabled.set(v);
  }
  readonly ignoreChildEnabled = signal(true);

  readonly hostAttributeBindings = signalHostAttributes({
    [SCROLLABLE_IGNORE_CHILD_ATTRIBUTE]: this.ignoreChildEnabled,
  });
}
