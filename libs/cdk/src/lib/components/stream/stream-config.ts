import { Type } from '@angular/core';
import { createStaticRootProvider } from '@ethlete/core';

export type StreamConfig = {
  /**
   * An optional consent component to automatically render around stream player components.
   * When set, any stream player component will use this component as its consent gate.
   *
   * The component must have `[etStreamConsent]` as a `hostDirective` (or equivalent consent
   * directive) so the stream player can read the consent state from the injector tree.
   */
  consentComponent: Type<unknown> | null;

  /**
   * An optional component to render inside every player slot as a PIP overlay.
   */
  pipSlotPlaceholderComponent: Type<unknown> | null;
};

export const [provideStreamConfig, injectStreamConfig] = createStaticRootProvider<StreamConfig>(
  { consentComponent: null, pipSlotPlaceholderComponent: null },
  { name: 'StreamConfig' },
);
