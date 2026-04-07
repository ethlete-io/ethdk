import { Type } from '@angular/core';
import { createStaticRootProvider } from '@ethlete/core';
import { StreamPlayerErrorComponent } from './error';
import { StreamPlayerLoadingComponent } from './loading';

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

  /**
   * An optional component shown while the player is initializing (before `isReady`).
   * It is automatically destroyed once the player fires its ready event.
   *
   * @default `StreamPlayerLoadingComponent`
   */
  loadingComponent: Type<unknown>;

  /**
   * An optional component shown when the player fails to load (e.g. SDK blocked by an ad-blocker).
   * It is automatically destroyed when the player is retried and hid again when retry succeeds.
   *
   * @default `StreamPlayerErrorComponent`
   */
  errorComponent: Type<unknown>;
};

export const [provideStreamConfig, injectStreamConfig] = createStaticRootProvider<StreamConfig>(
  {
    consentComponent: null,
    pipSlotPlaceholderComponent: null,
    loadingComponent: StreamPlayerLoadingComponent,
    errorComponent: StreamPlayerErrorComponent,
  },
  { name: 'StreamConfig' },
);
