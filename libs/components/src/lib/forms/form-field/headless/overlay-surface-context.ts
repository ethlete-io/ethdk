import { ElementRef, Signal, inject } from '@angular/core';
import { COLOR_PROVIDER, ProvideColorDirective, injectAnimatedBlockSize } from '@ethlete/core';

/**
 * The surface plumbing every overlay panel (`et-select-panel`, `et-cascader-panel`,
 * `et-date-picker-panel`) repeats: the pane is detached from its trigger's DOM, so the color
 * context from the trigger location has to be re-applied here (synced in the constructor so the
 * theme lands before the enter animation's first painted frame), and the panel's block size is
 * animated as its content changes. Call in the panel component's constructor with its `#panelBody`
 * view child and resizing class. Requires `ProvideColorDirective` as a host directive.
 */
export const injectOverlaySurfaceContext = (options: {
  panelBody: Signal<ElementRef<HTMLElement> | undefined>;
  resizingClass: string;
}) => {
  const ownColorProvider = inject(ProvideColorDirective);
  const contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });

  if (contextColorProvider) {
    ownColorProvider.syncWithProvider(contextColorProvider);
  }

  injectAnimatedBlockSize({ observe: [options.panelBody], resizingClass: options.resizingClass });
};
