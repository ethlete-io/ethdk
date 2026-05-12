import { createStaticRootProvider } from '@ethlete/core';

export type StreamConsentConfig = {
  /** The heading displayed in the consent placeholder. */
  heading: string;

  /** The description text displayed below the heading. */
  description: string;

  /** The label for the accept button. */
  acceptLabel: string;

  /**
   * The color theme name to apply on the accept button.
   * When set, applies `[etProvideColor]` on the button element.
   */
  acceptButtonColor: string | null;

  /**
   * A function to transform text based on the current locale.
   * Use `provideLocale()` to update the locale dynamically.
   */
  transformer: (text: string, locale: string) => string;
};

const DEFAULT_STREAM_CONSENT_CONFIG: StreamConsentConfig = {
  heading: 'Content blocked',
  description: 'Playback requires your consent. Third-party cookies and data may be used.',
  acceptLabel: 'Allow and play',
  acceptButtonColor: null,
  transformer: (text: string) => text,
};

export const [provideStreamConsentConfig, injectStreamConsentConfig] = createStaticRootProvider<StreamConsentConfig>(
  DEFAULT_STREAM_CONSENT_CONFIG,
  { name: 'StreamConsentConfig' },
);
