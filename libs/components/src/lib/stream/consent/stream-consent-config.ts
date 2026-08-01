import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';

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

const STREAM_CONSENT_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<StreamConsentConfig>(
  DEFAULT_STREAM_CONSENT_CONFIG,
  { name: 'StreamConsentConfig' },
);

export const provideStreamConsentConfig = /* @__PURE__ */ toProvideFn(STREAM_CONSENT_CONFIG_DEF);
export const injectStreamConsentConfig = /* @__PURE__ */ toInjectFn(STREAM_CONSENT_CONFIG_DEF);
