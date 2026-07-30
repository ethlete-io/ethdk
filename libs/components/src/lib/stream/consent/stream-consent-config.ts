import { createStaticRootProvider } from '@ethlete/core';

export type StreamConsentConfig = {
  /**
   * The color theme name to apply on the accept button.
   * When set, applies `[etProvideColor]` on the button element.
   */
  acceptButtonColor: string | null;
};

const DEFAULT_STREAM_CONSENT_CONFIG: StreamConsentConfig = {
  acceptButtonColor: null,
};

export const [provideStreamConsentConfig, injectStreamConsentConfig] = createStaticRootProvider<StreamConsentConfig>(
  DEFAULT_STREAM_CONSENT_CONFIG,
  { name: 'StreamConsentConfig' },
);
